import { Router } from "express";
import { pool } from "../../db.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";

const r = Router();


/** Lấy doctor_id từ user hiện tại */
async function getDoctorId(userId) {
    const [[row]] = await pool.query(
        "SELECT id FROM doctors WHERE user_id=? LIMIT 1",
        [userId]
    );
    return row?.id || null;
}

/** Lọc theo ngày khám */
function normalizeRange(q) {
    const from = q.from || q.date_from || q.start || null;
    const to = q.to || q.date_to || q.end || null;
    return { from, to };
}

const STATUS_VI = {
    completed: "Đã khám",
    cancelled: "Đã hủy",
    confirmed: "Đã xác nhận",
    pending: "Chờ xác nhận",
    no_show: "Vắng",
};
const viStatus = (s) => STATUS_VI[s] || s;

/** Xuất CSV theo cấu hình cột { key, label } */
function toCSV(columns, rows) {
    const header = columns.map((c) => c.label).join(",");
    const body = rows
        .map((row) =>
            columns
                .map(({ key }) => {
                    let v = row[key];
                    if (v == null) v = "";
                    v = String(v);
                    if (v.includes('"') || v.includes(",") || v.includes("\n")) {
                        v = `"${v.replace(/"/g, '""')}"`;
                    }
                    return v;
                })
                .join(",")
        )
        .join("\n");
    return `${header}\n${body}\n`;
}

r.use(requireAuth, requireRole("doctor"));

r.get("/revenue-excel", async (req, res) => {
    const docId = await getDoctorId(req.user.id);
    if (!docId) return res.status(404).json({ message: "Không tìm thấy bác sĩ" });

    const { from, to } = normalizeRange(req.query);

    const params = [docId];
    let where =
        "a.doctor_id = ? AND a.status='completed' AND a.payment_status='paid'";
    if (from && to) {
        where +=
            " AND s.start_time >= STR_TO_DATE(?, '%Y-%m-%d') AND s.start_time < DATE_ADD(STR_TO_DATE(?, '%Y-%m-%d'), INTERVAL 1 DAY)";
        params.push(from, to);
    }

    const [rows] = await pool.query(
        `
    SELECT
      DATE_FORMAT(a.created_at,'%Y-%m-%d %H:%i:%s') AS booked_at,  -- Ngày đặt
      DATE_FORMAT(s.start_time,'%Y-%m-%d')          AS date,       -- Ngày khám
      DATE_FORMAT(s.start_time,'%H:%i')             AS time,       -- Giờ khám
      p.full_name                                   AS patient_name,
      a.status,
      d.fee_min                                     AS fee_vnd
    FROM appointments a
      JOIN schedules s ON s.id = a.schedule_id
      JOIN patients  p ON p.id = a.patient_id
      JOIN doctors   d ON d.id = a.doctor_id
    WHERE ${where}
    ORDER BY a.created_at DESC
  `,
        params
    );

    // STT + map trạng thái -> TV
    const data = rows.map((r, i) => ({
        stt: i + 1,
        booked_at: r.booked_at,
        date: r.date,
        time: r.time,
        patient_name: r.patient_name,
        status: viStatus(r.status),
        fee_vnd: r.fee_vnd,
    }));

    const columns = [
        { key: "stt", label: "STT" },
        { key: "booked_at", label: "Ngày đặt" },
        { key: "date", label: "Ngày khám" },
        { key: "time", label: "Giờ khám" },
        { key: "patient_name", label: "Tên bệnh nhân" },
        { key: "status", label: "Trạng thái" },
        { key: "fee_vnd", label: "Phí khám (VND)" },
    ];
    const csv = toCSV(columns, data);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
        "Content-Disposition",
        `attachment; filename="revenue_detail_${from || "all"}_${to || "all"}.csv"`
    );
    res.status(200).send("\uFEFF" + csv); // BOM để Excel đọc tiếng Việt đúng
});

export default r;
