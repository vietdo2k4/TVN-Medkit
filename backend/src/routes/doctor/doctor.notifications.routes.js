import { Router } from "express";
import { pool } from "../../db.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";

const router = Router();

/* GET /doctor/notifications?since=ISO&limit=30
   Trả về { items, unread }.
   since: chỉ lấy mới hơn thời điểm này (phục vụ realtime/badge). */
router.get("/notifications", requireAuth, requireRole("doctor"), async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = Math.min(parseInt(req.query.limit || "30", 10), 50);
        const since = req.query.since ? new Date(req.query.since) : null;

        const cond = ["user_id=?"];
        const args = [userId];
        if (since) { cond.push("sent_at > ?"); args.push(since); }

        const [rows] = await pool.query(
            `SELECT id, message, kind, appointment_id, is_read, sent_at
         FROM notifications
        WHERE ${cond.join(" AND ")}
        ORDER BY sent_at DESC
        LIMIT ?`,
            [...args, limit]
        );

        const [[c]] = await pool.query(
            "SELECT COUNT(*) AS unread FROM notifications WHERE user_id=? AND is_read=FALSE",
            [userId]
        );

        res.json({ items: rows, unread: Number(c?.unread || 0) });
    } catch (e) {
        res.status(500).json({ message: "Server error", error: String(e?.message || e) });
    }
});

/* POST /doctor/notifications/read
   Body: { ids: number[] }  -> đánh dấu đã đọc theo lô */
router.post("/notifications/read", requireAuth, requireRole("doctor"), async (req, res) => {
    try {
        const ids = (req.body?.ids || []).map(Number).filter(Boolean);
        if (!ids.length) return res.json({ updated: 0 });
        const [r] = await pool.query(
            `UPDATE notifications SET is_read=TRUE
         WHERE user_id=? AND id IN (${ids.map(() => "?").join(",")})`,
            [req.user.id, ...ids]
        );
        res.json({ updated: r.affectedRows });
    } catch (e) {
        res.status(500).json({ message: "Server error", error: String(e?.message || e) });
    }
});

/* (tùy chọn) GET /doctor/notifications/unread_count */
router.get("/notifications/unread_count", requireAuth, requireRole("doctor"), async (req, res) => {
    try {
        const [[row]] = await pool.query(
            "SELECT COUNT(*) AS unread FROM notifications WHERE user_id=? AND is_read=FALSE",
            [req.user.id]
        );
        res.json({ unread: Number(row?.unread || 0) });
    } catch (e) {
        res.status(500).json({ message: "Server error", error: String(e?.message || e) });
    }
});

export default router;
