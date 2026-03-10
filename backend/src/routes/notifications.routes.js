import { Router } from "express";
import { pool } from "../db.js";
import auth from "../middleware/auth.js";

const router = Router();

// GET /api/notifications?page=1&limit=6&unread=0|1
router.get("/", auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const unread = req.query.unread === "1";
        const page = Math.max(1, parseInt(req.query.page || "1", 10));
        const limit = Math.min(parseInt(req.query.limit || "6", 10), 50);
        const off = (page - 1) * limit;

        const params = [userId];
        let where = "user_id = ?";
        if (unread) { where += " AND is_read = FALSE"; }

        const [[{ total }]] = await pool.query(
            `SELECT COUNT(*) AS total FROM notifications WHERE ${where}`,
            params
        );

        const [rows] = await pool.query(
            `SELECT id, message, kind, appointment_id, is_read, sent_at AS created_at
         FROM notifications
        WHERE ${where}
        ORDER BY sent_at DESC
        LIMIT ? OFFSET ?`,
            [...params, limit, off]
        );

        res.json({
            items: rows,
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
        });
    } catch (e) {
        res.status(500).json({ message: "Server error", error: String(e?.message || e) });
    }
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", auth, async (req, res) => {
    try {
        const [r] = await pool.query(
            "UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?",
            [req.params.id, req.user.id]
        );
        if (!r.affectedRows) return res.status(404).json({ message: "Not found" });
        res.json({ id: Number(req.params.id), is_read: true });
    } catch (e) {
        res.status(500).json({ message: "Server error", error: String(e?.message || e) });
    }
});

// POST /api/notifications/read-all  { before?: ISOString }
router.post("/read-all", auth, async (req, res) => {
    try {
        const params = [req.user.id];
        let sql = "UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE";
        if (req.body?.before) { sql += " AND sent_at <= ?"; params.push(req.body.before); }
        const [r] = await pool.query(sql, params);
        res.json({ updated: r.affectedRows });
    } catch (e) {
        res.status(500).json({ message: "Server error", error: String(e?.message || e) });
    }
});

// GET /api/notifications/unread_count
router.get("/unread_count", auth, async (req, res) => {
    try {
        const [[row]] = await pool.query(
            "SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = FALSE",
            [req.user.id]
        );
        res.json(row);
    } catch (e) {
        res.status(500).json({ message: "Server error", error: String(e?.message || e) });
    }
});

export default router;
