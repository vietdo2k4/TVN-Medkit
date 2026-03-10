import express from "express";
import { pool } from "../../db.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";

const router = express.Router();

async function doctorIdOf(userId) {
    const [rows] = await pool.query("SELECT id FROM doctors WHERE user_id=?", [userId]);
    return rows[0]?.id || null;
}

function toDate(s) {
    // YYYY-MM-DD -> Date at local 00:00
    if (!s) return null;
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
}

// GET /doctor/metrics?range=7|14|30&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/", requireAuth, requireRole("doctor"), async (req, res) => {
    try {
        const docId = await doctorIdOf(req.user.id);
        if (!docId) return res.status(403).json({ message: "Không tìm thấy hồ sơ bác sĩ" });

        const range = Math.max(1, Math.min(30, parseInt(req.query.range || "7", 10)));
        const fromQ = toDate(req.query.from);
        const toQ = toDate(req.query.to); // inclusive
        // khoảng thời gian dùng cho dailyCounts
        const endDate = toQ || new Date(); // hôm nay
        const startDate = fromQ || new Date(endDate); startDate.setDate(endDate.getDate() - (range - 1));

        const fromStr = startDate.toLocaleDateString("en-CA");
        const toStr = endDate.toLocaleDateString("en-CA"); // inclusive

        // bộ lọc chung theo schedules.start_time trong khoảng
        const filterSQL = `
      a.doctor_id = ?
      AND DATE(s.start_time) >= ?
      AND DATE(s.start_time) <= ?
    `;
        const args = [docId, fromStr, toStr];

        // 1) đếm theo trạng thái (không giới hạn ngày để tổng quan) → thêm query all=1 sẽ bỏ filter
        const allTime = String(req.query.all || "0") === "1";
        const whereStatus = allTime ? "a.doctor_id=?" : filterSQL;
        const argsStatus = allTime ? [docId] : args;

        const [statusRows] = await pool.query(
            `SELECT a.status, COUNT(*) AS c
         FROM appointments a
         JOIN schedules s ON s.id=a.schedule_id
        WHERE ${whereStatus}
        GROUP BY a.status`,
            argsStatus
        );
        const counts = Object.fromEntries(statusRows.map(r => [r.status, Number(r.c)]));
        for (const k of ["pending", "confirmed", "completed", "cancelled", "no_show"]) if (!(k in counts)) counts[k] = 0;

        // 2) bệnh nhân duy nhất đã khám (giới hạn trong khoảng ngày)
        const [[{ uniq }]] = await pool.query(
            `SELECT COUNT(DISTINCT a.patient_id) AS uniq
         FROM appointments a
         JOIN schedules s ON s.id=a.schedule_id
        WHERE ${filterSQL} AND a.status='completed'`,
            args
        );

        // 3) doanh thu đã thanh toán (ước theo fee_min) trong khoảng
        const [[{ rev }]] = await pool.query(
            `SELECT COALESCE(SUM(d.fee_min),0) AS rev
         FROM appointments a
         JOIN doctors d  ON d.id=a.doctor_id
         JOIN schedules s ON s.id=a.schedule_id
        WHERE ${filterSQL}
          AND a.status='completed'
          AND a.payment_status='paid'`,
            args
        );

        // 4) dailyCounts trong khoảng
        const [daily] = await pool.query(
            `SELECT DATE(s.start_time) AS d, COUNT(*) AS c
         FROM appointments a
         JOIN schedules s ON s.id=a.schedule_id
        WHERE ${filterSQL}
        GROUP BY DATE(s.start_time)
        ORDER BY DATE(s.start_time)`,
            args
        );
        const map = Object.fromEntries(daily.map(x => [x.d instanceof Date ? x.d.toLocaleDateString("en-CA") : x.d, Number(x.c)]));

        const days = [];
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            days.push(d.toLocaleDateString("en-CA"));
        }
        const dailyCounts = days.map(d => ({ date: d, count: map[d] || 0 }));

        res.json({
            range, from: fromStr, to: toStr,
            counts,
            uniquePatients: Number(uniq || 0),
            totalRevenue: Number(rev || 0),
            dailyCounts
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Lỗi tải thống kê" });
    }
});

export default router;
