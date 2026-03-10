import { Router } from "express";
import {pool} from "../../db.js";                 
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";

const r = Router();
r.use(requireAuth, requireRole("doctor"));

// ===== utils =====
const TIME_00_30 = /^([01]\d|2[0-3]):(00|30):?00?$/;
const TIME_00_30_SHORT = /^([01]\d|2[0-3]):(00|30)$/;

function normTime(t) {
    if (!t) return null;
    const s = String(t).trim();
    if (TIME_00_30.test(s)) return s.length === 5 ? s + ":00" : s;
    if (TIME_00_30_SHORT.test(s)) return s + ":00";
    return null;
}
function sessionOf(hhmmss) {
    const h = Number(String(hhmmss).slice(0, 2));
    if (h < 12) return "morning";
    if (h < 18) return "afternoon";
    return "evening";
}

// new: kiểm tra giao nhau với slot hiện có
async function hasOverlap(conn, did, startISO, minutes) {
    const [rows] = await conn.query(
        `SELECT 1
       FROM schedules
      WHERE doctor_id=?
        AND start_time < DATE_ADD(?, INTERVAL ? MINUTE)
        AND DATE_ADD(start_time, INTERVAL slot_minutes MINUTE) > ?
      LIMIT 1`,
        [did, startISO, minutes, startISO]
    );
    return rows.length > 0;
}

// lấy doctor_id từ user_id
async function doctorIdOf(userId, conn = pool) {
    const [[row]] = await conn.query("SELECT id FROM doctors WHERE user_id=? LIMIT 1", [userId]);
    if (!row) throw new Error("Doctor profile not found");
    return row.id;
}


r.get("/whoami", requireAuth, requireRole("doctor"), async (req, res) => {
    const [[row]] = await pool.query(
        "SELECT full_name FROM doctors WHERE user_id=? LIMIT 1",
        [req.user.id]
    );
    res.json({ display_name: row?.full_name || "Bác sĩ" });
});


// ===== 1) Tạo slot theo NGÀY, danh sách giờ tự chọn =====
r.post("/schedules/custom", async (req, res) => {
    const did = await doctorIdOf(req.user.id);
    const date = (req.body?.date || "").trim();           // "YYYY-MM-DD"
    const times = Array.isArray(req.body?.times) ? req.body.times : [];
    const room = (req.body?.room || "").trim();
    const slot_minutes = 60;  // cố định
    const capacity = 1;       // không dùng trên UI nhưng vẫn lưu

    if (!room) return res.status(400).json({ message: "Thiếu phòng" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || times.length === 0)
        return res.status(400).json({ message: "Thiếu date hoặc times" });

    // now/today dạng chuỗi để khớp múi giờ MySQL
    const [[nowdb]] = await pool.query(
        "SELECT DATE_FORMAT(CURDATE(),'%Y-%m-%d') AS today, DATE_FORMAT(NOW(),'%Y-%m-%d %H:%i:%s') AS now_str"
    );
    const today = nowdb.today;     // "YYYY-MM-DD"
    const nowISO = nowdb.now_str;  // "YYYY-MM-DD HH:MM:SS"

    const inserted = [];
    const skipped = []; // {time, reason}
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        for (const raw of times) {
            const hhmmss = normTime(raw);
            if (!hhmmss) { skipped.push({ time: raw, reason: "invalid_time" }); continue; }

            const start = `${date} ${hhmmss}`;
            if (date === today && start <= nowISO) { skipped.push({ time: hhmmss, reason: "past_time" }); continue; }

            if (await hasOverlap(conn, did, start, slot_minutes)) {
                skipped.push({ time: hhmmss, reason: "overlap" }); continue;
            }

            await conn.query(
                `INSERT INTO schedules(doctor_id, session, start_time, room, capacity, slot_minutes)
         VALUES (?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE room=VALUES(room), updated_at=NOW()`,
                [did, sessionOf(hhmmss), start, room, capacity, slot_minutes]
            );
            inserted.push(hhmmss);
        }
        await conn.commit();
        res.json({ ok: true, date, inserted, skipped, room });
    } catch (e) {
        try { await conn.rollback(); } catch { }
        console.error("POST /doctor/schedules/custom:", e);
        res.status(500).json({ message: "Lỗi server" });
    } finally { conn.release(); }
});

// ===== 2) Tạo slot theo NHIỀU NGÀY (from→to, danh sách giờ) =====
r.post("/schedules/generate-range", async (req, res) => {
    const did = await doctorIdOf(req.user.id);
    const from = (req.body?.from || "").trim();
    const to = (req.body?.to || "").trim();
    const times = Array.isArray(req.body?.times) ? req.body.times : [];
    const room = (req.body?.room || "").trim();
    const slot_minutes = 60;
    const capacity = 1;

    if (!room) return res.status(400).json({ message: "Thiếu phòng" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || times.length === 0)
        return res.status(400).json({ message: "Thiếu from/to hoặc times" });

    const start = new Date(from + "T00:00:00");
    const end = new Date(to + "T00:00:00");
    if (start > end) return res.status(400).json({ message: "from>to" });

    const days = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayLocal = d.toLocaleDateString("en-CA"); // YYYY-MM-DD (local, tránh lệch UTC)
        days.push(dayLocal); // inclusive
    }

    const conn = await pool.getConnection();
    try {
        const [[nowdb]] = await conn.query(
            "SELECT DATE_FORMAT(CURDATE(),'%Y-%m-%d') AS today, DATE_FORMAT(NOW(),'%Y-%m-%d %H:%i:%s') AS now_str"
        );
        const today = nowdb.today;
        const nowISO = nowdb.now_str;

        await conn.beginTransaction();

        const result = { ok: true, inserted: 0, skipped: { overlap: [], past_time: [], invalid_time: [] }, effected_days: [] };

        for (const day of days) {
            let dayInserted = 0;
            for (const raw of times) {
                const hhmmss = normTime(raw);
                if (!hhmmss) { result.skipped.invalid_time.push({ day, time: raw }); continue; }

                const startISO = `${day} ${hhmmss}`;
                if (day === today && startISO <= nowISO) { result.skipped.past_time.push({ day, time: hhmmss }); continue; }

                if (await hasOverlap(conn, did, startISO, slot_minutes)) {
                    result.skipped.overlap.push({ day, time: hhmmss }); continue;
                }

                await conn.query(
                    `INSERT INTO schedules(doctor_id, session, start_time, room, capacity, slot_minutes)
           VALUES (?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE room=VALUES(room), updated_at=NOW()`,
                    [did, sessionOf(hhmmss), startISO, room, capacity, slot_minutes]
                );
                result.inserted += 1;
                dayInserted += 1;
            }
            result.effected_days.push({ day, inserted: dayInserted });
        }

        await conn.commit();
        res.json(result);
    } catch (e) {
        try { await conn.rollback(); } catch { }
        console.error("POST /doctor/schedules/generate-range:", e);
        res.status(500).json({ message: "Lỗi server" });
    } finally { conn.release(); }
});

// ===== 3) List & Delete (giữ nguyên, chỉ dùng pool) =====
r.get("/schedules", async (req, res) => {
    const { from = "", to = "" } = req.query;
    const did = await doctorIdOf(req.user.id);
    const p = [did];
    let where = "s.doctor_id=?";
    if (from) { where += " AND DATE(s.start_time) >= ?"; p.push(from); }
    if (to) { where += " AND DATE(s.start_time) <= ?"; p.push(to); }

    const [rows] = await pool.query(
        `SELECT s.id, s.start_time, s.end_time, s.room, s.capacity,
            IFNULL(ap.appt_active,0) AS appt_cnt,
            IFNULL(sh.hold_active,0) AS hold_cnt,
            (s.start_time < NOW()) AS is_past
       FROM schedules s
  LEFT JOIN (
       SELECT schedule_id, COUNT(*) appt_active
         FROM appointments
        WHERE status IN ('pending','confirmed')
        GROUP BY schedule_id
  ) ap ON ap.schedule_id = s.id
  LEFT JOIN (
       SELECT schedule_id, COUNT(*) hold_active
         FROM slot_holds
        WHERE expires_at > NOW()
        GROUP BY schedule_id
  ) sh ON sh.schedule_id = s.id
      WHERE ${where}
      ORDER BY s.start_time`,
        p
    );
    res.json(rows);
});

r.delete("/schedules/:id", async (req, res) => {
    const id = +req.params.id;
    const conn = await pool.getConnection();
    try {
        const did = await doctorIdOf(req.user.id, conn);
        await conn.beginTransaction();

        const [[x]] = await conn.query(
            `SELECT s.id,
              (s.start_time <= NOW()) AS is_past,
              IFNULL(ap.appt_active,0) AS appt_cnt,
              IFNULL(sh.hold_active,0) AS hold_cnt
         FROM schedules s
    LEFT JOIN (
           SELECT schedule_id, COUNT(*) appt_active
             FROM appointments
            WHERE status IN ('pending','confirmed')
            GROUP BY schedule_id
    ) ap ON ap.schedule_id = s.id
    LEFT JOIN (
           SELECT schedule_id, COUNT(*) hold_active
             FROM slot_holds
            WHERE expires_at > NOW()
            GROUP BY schedule_id
    ) sh ON sh.schedule_id = s.id
        WHERE s.id=? AND s.doctor_id=?
        FOR UPDATE`,
            [id, did]
        );
        if (!x) { await conn.rollback(); return res.status(404).json({ message: "Không tìm thấy slot" }); }
        if (x.is_past) { await conn.rollback(); return res.status(409).json({ message: "Slot đã qua giờ, không thể xoá" }); }
        if ((x.appt_cnt || 0) > 0 || (x.hold_cnt || 0) > 0) {
            await conn.rollback(); return res.status(409).json({ message: "Slot đã có đặt/giữ, không thể xoá" });
        }

        await conn.query("DELETE FROM schedules WHERE id=? AND doctor_id=?", [id, did]);
        await conn.commit();
        res.json({ ok: true });
    } catch (e) {
        try { await conn.rollback(); } catch { }
        console.error("DELETE /doctor/schedules/:id:", e);
        res.status(500).json({ message: "Lỗi server" });
    } finally { conn.release(); }
});

export default r;
