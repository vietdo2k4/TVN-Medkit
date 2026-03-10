import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const r = Router();

/**
 * POST /api/holds
 * Body:
 *   - { scheduleId, firm?: boolean }
 *   - hoặc { doctorId, date:"YYYY-MM-DD", slot:"HH:mm", firm?: boolean }
 *
 * firm=false  -> giữ "mềm" 60s khi chỉ bấm CHỌN
 * firm=true   -> khóa "cứng" 5 phút khi bấm TIẾP TỤC (sang checkout)
 */
r.post("/", requireAuth, async (req, res) => {
    let scheduleId = Number(req.body?.scheduleId || 0);
    const { doctorId, date, slot, firm = false } = req.body || {};

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Nếu chưa có scheduleId thì tìm theo doctor/date/slot
        if (!scheduleId) {
            const [[s]] = await conn.query(
                `SELECT id AS schedule_id
         FROM schedules
         WHERE doctor_id=? AND date=? AND time=? LIMIT 1`,
                [doctorId, date, slot]
            );
            if (!s) {
                await conn.rollback();
                return res.status(404).json({ message: "Không tìm thấy khung giờ" });
            }
            scheduleId = s.schedule_id;
        }

        // 1) Khóa hàng schedule để tuần tự hóa thao tác trên cùng slot
        const [[sch]] = await conn.query(
            "SELECT id, capacity FROM schedules WHERE id=? FOR UPDATE",
            [scheduleId]
        );
        if (!sch) { await conn.rollback(); return res.status(404).json({ message: "Không tìm thấy khung giờ" }); }

        // 2) Dọn hold hết hạn và khóa các hold hiện hữu của slot này
        await conn.query("DELETE FROM slot_holds WHERE schedule_id=? AND expires_at<=NOW()", [scheduleId]);
        await conn.query("SELECT id FROM slot_holds WHERE schedule_id=? AND expires_at>NOW() FOR UPDATE", [scheduleId]);



        // Sức chứa = capacity; số đã dùng = appt active + holds active
        const [[agg]] = await conn.query(
            `SELECT
         (SELECT COUNT(*) FROM appointments
            WHERE schedule_id=? AND status IN ('pending','confirmed')) AS appt_cnt,
         (SELECT COUNT(*) FROM slot_holds
            WHERE schedule_id=? AND expires_at>NOW()) AS hold_cnt,
         (SELECT capacity FROM schedules WHERE id=?) AS capacity`,
            [scheduleId, scheduleId, scheduleId]
        );

        if (!agg?.capacity) {
            await conn.rollback();
            return res.status(404).json({ message: "Không tìm thấy khung giờ" });
        }

        // 3) Kiểm tra hold của chính user còn hạn
        const [[mine]] = await conn.query(
            `SELECT id FROM slot_holds WHERE schedule_id=? AND user_id=? AND expires_at>NOW() LIMIT 1`,
            [scheduleId, req.user.id]
        );


        // Nếu chưa có hold của chính mình và đã full -> chặn
        if (!mine && (Number(agg.appt_cnt || 0) + Number(agg.hold_cnt || 0)) >= Number(agg.capacity || 1)) {
            await conn.rollback();
            return res.status(409).json({ message: "Khung giờ đã có người chọn/đang giữ" });
        }

        // TTL: hold cứng 5 phút
        const ttlMs = firm ? 5 * 60 * 1000 : 60 * 1000;
        const expiresAt = new Date(Date.now() + ttlMs);

        await conn.query(
            `INSERT INTO slot_holds(schedule_id, user_id, expires_at)
       VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE expires_at=VALUES(expires_at)`,
            [scheduleId, req.user.id, expiresAt]
        );

        await conn.commit();
        res.json({ scheduleId, expiresAt: expiresAt.toISOString() });
    } catch (e) {
        try { await conn.rollback(); } catch { }
        console.error("POST /holds", e);
        res.status(500).json({ message: "Lỗi server" });
    } finally {
        conn.release();
    }
});

/** DELETE /api/holds/:scheduleId — thả giữ sớm khi bỏ chọn/đổi ngày/thoát */
r.delete("/:scheduleId", requireAuth, async (req, res) => {
    await pool.query(
        "DELETE FROM slot_holds WHERE schedule_id=? AND user_id=?",
        [req.params.scheduleId, req.user.id]
    );
    res.json({ ok: true });
});

export default r;
