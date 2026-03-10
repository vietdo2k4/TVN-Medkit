import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

/**
 * GET /news?category=service|domestic|world&page=1&page_size=12
 * - parse params: validate category, clamp page_size (5..50), tính offset
 */
router.get("/", async (req, res) => {
    try {
        const category = String(req.query.category || "service");
        const page = Math.max(1, parseInt(req.query.page || "1", 10));
        const ps = parseInt(req.query.page_size || "12", 10);
        const pageSize = Math.min(50, Math.max(5, isNaN(ps) ? 12 : ps));
        const offset = (page - 1) * pageSize;

        // query id chuyên mục
        const [catRows] = await pool.query(
            "SELECT id FROM news_categories WHERE key_name=? LIMIT 1", [category]
        );
        const catId = catRows[0]?.id || null;
        if (!catId) {
            res.set("Cache-Control", "public, max-age=60");
            return res.json({ page, page_size: pageSize, total: 0, rows: [] });
        }

        // query count tổng
        const [[countRow]] = await pool.query(
            "SELECT COUNT(*) AS n FROM news_articles WHERE status='published' AND category_id=?",
            [catId]
        );
        const total = countRow?.n || 0;

        // query trang dữ liệu
        const [rows] = await pool.query(
            `SELECT a.title, a.slug, a.summary, a.cover_url, a.published_at,
              a.external_url AS url, s.name AS source
       FROM news_articles a
       LEFT JOIN news_sources s ON s.id = a.source_id
       WHERE a.status='published' AND a.category_id=?
       ORDER BY a.published_at DESC
       LIMIT ? OFFSET ?`,
            [catId, pageSize, offset]
        );

        // response JSON + cache
        res.set("Cache-Control", "public, max-age=60");
        return res.json({ page, page_size: pageSize, total, rows });
    } catch (e) {
        return res.status(500).json({ error: "news_fetch_failed" }); // lỗi chung
    }
});

export default router;