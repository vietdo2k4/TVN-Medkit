import express from "express";
import { pool } from "../../db.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";

const router = express.Router();

async function doctorIdOf(userId) {
    const [rows] = await pool.query("SELECT id FROM doctors WHERE user_id=?", [userId]);
    return rows[0]?.id || null;
}

// tiện ích: lưu thông báo
async function notify(user_id, kind, message, appointment_id = null) {
    try {
        await pool.query(
            `INSERT INTO notifications(user_id, message, kind, appointment_id, sent_at)
       VALUES(?,        ?,       ?,    ?,              NOW())
       ON DUPLICATE KEY UPDATE
         message  = VALUES(message),
         sent_at  = VALUES(sent_at),
         is_read  = 0,
         updated_at = NOW()`,
            [user_id, message, kind, appointment_id]
        );
    } catch (e) {
        console.error("notify err (upsert)", e);
    }
}

// GET /doctor/appointments (giữ nguyên, có bookedAt)
router.get("/", requireAuth, requireRole("doctor"), async (req, res) => {
    try {
        const docId = await doctorIdOf(req.user.id);
        if (!docId) return res.status(403).json({ message: "Không tìm thấy hồ sơ bác sĩ" });

        const q = (req.query.q || "").trim();
        const status = (req.query.status || "").trim().toLowerCase();
        const from = req.query.from || null;
        const to = req.query.to || null;

        const page = Math.max(1, parseInt(req.query.page || "1", 10));
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || "10", 10)));
        const off = (page - 1) * limit;

        const where = ["a.doctor_id=?"];
        const args = [docId];

        if (q) { where.push("(p.full_name LIKE ? OR a.id LIKE ?)"); args.push(`%${q}%`, `%${q}%`); }
        if (status) { where.push("a.status=?"); args.push(status); }
        if (from) { where.push("DATE(s.start_time) >= ?"); args.push(from); }
        if (to) { where.push("DATE(s.start_time) <= ?"); args.push(to); }

        const whereSQL = where.length ? "WHERE " + where.join(" AND ") : "";

        const [rows] = await pool.query(
            `SELECT a.id, a.status, a.payment_status, a.symptoms_note,
                    a.cancel_reason,
                    a.created_at AS booked_at,
                    p.full_name AS patient_name,
                    DATE(s.start_time) AS day, DATE_FORMAT(s.start_time, '%H:%i') AS time,
                    s.start_time, s.end_time, s.room,
                    h.name AS hospital_name
         FROM appointments a
         JOIN patients  p ON p.id=a.patient_id
         JOIN schedules s ON s.id=a.schedule_id
         JOIN doctors   d ON d.id=a.doctor_id
    LEFT JOIN hospitals h ON h.id=d.hospital_id
        ${whereSQL}
     ORDER BY s.start_time DESC
        LIMIT ? OFFSET ?`,
            [...args, limit, off]
        );

        const [[{ total }]] = await pool.query(
            `SELECT COUNT(*) AS total
         FROM appointments a
         JOIN schedules s ON s.id=a.schedule_id
         JOIN patients  p ON p.id=a.patient_id
        ${whereSQL}`, args
        );

        const whereNoStatus = where.filter(w => w !== "a.status=?");
        const argsNoStatus = status ? args.filter(x => x !== status) : args;

        const [countsRows] = await pool.query(
            `SELECT a.status, COUNT(*) cnt
         FROM appointments a
         JOIN schedules s ON s.id=a.schedule_id
         JOIN patients  p ON p.id=a.patient_id
       ${whereNoStatus.length ? "WHERE " + whereNoStatus.join(" AND ") : ""}
       GROUP BY a.status`,
            argsNoStatus
        );

        res.json({
            items: rows.map(r => ({
                id: r.id,
                patientName: r.patient_name,
                date: r.day,
                time: r.time,
                room: r.room,
                hospitalName: r.hospital_name,
                status: r.status,
                paymentStatus: r.payment_status,
                note: r.symptoms_note,
                bookedAt: r.booked_at,
                cancel_reason: r.cancel_reason,
            })),
            page, limit, total,
            counts: Object.fromEntries(countsRows.map(x => [x.status, x.cnt])),
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Lỗi tải danh sách" });
    }
});

// GET /doctor/appointments/:id  -> bổ sung FULL thông tin bệnh nhân
router.get("/:id", requireAuth, requireRole("doctor"), async (req, res) => {
    try {
        const docId = await doctorIdOf(req.user.id);
        const id = Number(req.params.id || 0);
        const [rows] = await pool.query(
            `SELECT a.id, a.status, a.payment_status, a.symptoms_note,a.cancel_reason,
              a.created_at AS booked_at,
              p.full_name AS patient_name, p.gender, p.dob, p.phone, p.address, p.insurance_no,
              DATE(s.start_time) AS day, TIME(s.start_time) AS time,
              s.start_time, s.end_time, s.room,
              d.full_name AS doctor_name, d.fee_min,
              h.name AS hospital_name,
              sp.name AS specialty_name
         FROM appointments a
         JOIN patients    p  ON p.id=a.patient_id
         JOIN schedules   s  ON s.id=a.schedule_id
         JOIN doctors     d  ON d.id=a.doctor_id
    LEFT JOIN hospitals  h  ON h.id=d.hospital_id
    LEFT JOIN specialties sp ON sp.id=d.specialty_id
        WHERE a.id=? AND a.doctor_id=?`,
            [id, docId]
        );
        if (!rows[0]) return res.status(404).json({ message: "Không tìm thấy phiếu" });
        res.json(rows[0]);
    } catch {
        res.status(500).json({ message: "Lỗi tải chi tiết" });
    }
});

router.patch("/:id", requireAuth, requireRole("doctor"), async (req, res) => {
    try {
        const docId = await doctorIdOf(req.user.id);
        const id = Number(req.params.id || 0);
        const action = String(req.body?.action || "").toLowerCase();
        const reason = (req.body?.reason || "").toString().slice(0, 255);

        if (!["confirm", "cancel", "complete", "no_show"].includes(action))
            return res.status(400).json({ message: "Hành động không hợp lệ" });

        // lấy thêm user bệnh nhân + tên BS + tên CSYT để soạn nội dung mail
        const [[row]] = await pool.query(
            `SELECT a.id, a.status,
              s.start_time, s.end_time,
              d.user_id   AS doctor_user_id,
              p.user_id   AS patient_user_id,
              p.full_name AS patient_name,
              d.full_name AS doctor_name,
              h.name      AS hospital_name
         FROM appointments a
         JOIN schedules s ON s.id=a.schedule_id
         JOIN doctors   d ON d.id=a.doctor_id
         JOIN patients  p ON p.id=a.patient_id
    LEFT JOIN hospitals h ON h.id=d.hospital_id
        WHERE a.id=? AND a.doctor_id=?`,
            [id, docId]
        );
        if (!row) return res.status(404).json({ message: "Không tìm thấy phiếu" });

        // ---- time helpers: an toàn với chuỗi MySQL "YYYY-MM-DD HH:mm:ss"
        const toDate = (x) =>
            x instanceof Date ? x : new Date(String(x || "").replace(" ", "T"));
        const pad = (n) => String(n).padStart(2, "0");
        const splitYmdHm = (d) => ({
            dateISO: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
            timeHM: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
        });

        const now = new Date();
        const start = toDate(row.start_time);
        const end = toDate(row.end_time);
        const st = row.status;
        const bad = (m) => res.status(400).json({ message: m });

        if (action === "confirm") { if (st !== "pending") return bad("Chỉ xác nhận từ chờ khám"); if (now >= start) return bad("Đã quá giờ bắt đầu"); }
        if (action === "cancel") { if (!["pending", "confirmed"].includes(st)) return bad("Không thể hủy"); if (now >= start) return bad("Đã quá giờ bắt đầu"); }
        if (action === "complete") { if (st !== "confirmed") return bad("Chỉ hoàn thành từ đã xác nhận"); if (now < start) return bad("Chưa tới giờ khám"); }
        if (action === "no_show") { if (st !== "confirmed") return bad("Chỉ đánh vắng từ đã xác nhận"); if (now < end) return bad("Chưa quá giờ kết thúc"); }

        const newStatus =
            action === "confirm" ? "confirmed" :
                action === "cancel" ? "cancelled" :
                    action === "complete" ? "completed" :
                        "no_show";

        if (action === "cancel") {
            await pool.query(
                `UPDATE appointments
            SET status=?, cancel_reason=?, updated_at=NOW()
          WHERE id=? AND doctor_id=?`,
                [newStatus, (reason || "doctor: cancel"), id, docId]
            );
        } else {
            await pool.query(
                `UPDATE appointments
            SET status=?, updated_at=NOW()
          WHERE id=? AND doctor_id=?`,
                [newStatus, id, docId]
            );
        }

        // --- NOTIFY ---
        const { dateISO, timeHM } = splitYmdHm(start);
        const hosp = row.hospital_name ? ` (${row.hospital_name})` : "";
        const patientName = row.patient_name || "bệnh nhân";

        // 1) Log nhanh cho BÁC SĨ (bảng notifications)
        //    -> thay thế thông điệp generic bằng câu tiếng Việt yêu cầu
        try {
            const logKind =
                action === "cancel" ? "cancelled" :
                    action === "no_show" ? "other" :
                        action === "complete" ? "other" : "booked";

            let logMsg = `Phiếu #${id} cập nhật: ${newStatus}`;
            if (action === "confirm") logMsg = `Bạn đã xác nhận phiếu khám ${id} cho bệnh nhân ${patientName}.`;
            if (action === "complete") logMsg = `Đã hoàn thành lịch khám ${dateISO} • ${timeHM} với bệnh nhân ${patientName}.`;

            await notify(row.doctor_user_id, logKind, logMsg, id);
        } catch (e) {
            console.error("[doctor/appointments] notify failed:", e);
        }

        // 2) Thông báo cho BỆNH NHÂN (web + email) khi XÁC NHẬN / HỦY
        if (action === "confirm" || action === "cancel") {
            try {
                const kind = action === "confirm" ? "confirmed" : "cancelled";
                const msg =
                    action === "confirm"
                        ? `Lịch khám ${dateISO} • ${timeHM} với ${row.doctor_name}${hosp} đã được bác sĩ xác nhận. Mã: ${id}.`
                        : `Lịch khám ${dateISO} • ${timeHM} với ${row.doctor_name}${hosp} đã bị hủy. Mã: ${id}.`;

                const { pushNotif } = await import("../../helper/notif.js");
                await pushNotif({
                    userId: row.patient_user_id,
                    appointmentId: id,
                    kind,
                    message: msg,
                    subject: kind === "confirmed"
                        ? "TVN Medkit — Lịch khám đã được xác nhận"
                        : "TVN Medkit — Lịch khám đã hủy",
                });
            } catch (e) {
                console.error("[doctor/appointments] pushNotif(patient) failed:", e);
            }

            // 2.1) TB cho BÁC SĨ khi bác sĩ tự HỦY
            if (action === "cancel" && row.doctor_user_id) {
                try {
                    const { pushNotif } = await import("../../helper/notif.js");
                    const msgDoctor = `Bạn đã hủy lịch ${dateISO} • ${timeHM}${hosp}. Mã: ${id}.`;
                    await pushNotif({
                        userId: row.doctor_user_id,
                        appointmentId: id,
                        kind: "cancelled",
                        message: msgDoctor,
                        subject: "TVN Medkit — Bạn đã hủy lịch",
                    });
                } catch (e) {
                    console.error("[doctor/appointments] pushNotif(doctor cancel) failed:", e);
                }
            }

            // 2.2) TB cho BÁC SĨ khi bác sĩ XÁC NHẬN
            if (action === "confirm" && row.doctor_user_id) {
                try {
                    const { pushNotif } = await import("../../helper/notif.js");
                    const msgDoctor = `Bạn đã xác nhận phiếu khám cho bệnh nhân ${patientName}.`;
                    await pushNotif({
                        userId: row.doctor_user_id,
                        appointmentId: id,
                        kind: "doctor_confirmed",
                        message: msgDoctor,
                        subject: "TVN Medkit — Bạn đã xác nhận lịch",
                    });
                } catch (e) {
                    console.error("[doctor/appointments] pushNotif(doctor confirm) failed:", e);
                }
            }
        }

        // 3) TB cho BÁC SĨ khi HOÀN THÀNH
        if (action === "complete" && row.doctor_user_id) {
            try {
                const { pushNotif } = await import("../../helper/notif.js");
                const msgDoctor = `Đã hoàn thành lịch khám với bệnh nhân ${patientName}.`;
                await pushNotif({
                    userId: row.doctor_user_id,
                    appointmentId: id,
                    kind: "doctor_completed",
                    message: msgDoctor,
                    subject: "TVN Medkit — Hoàn thành lịch khám",
                });
            } catch (e) {
                console.error("[doctor/appointments] pushNotif(doctor complete) failed:", e);
            }
        }

        // 4) TỰ HỦY: gửi mail + thông báo hệ thống cho BỆNH NHÂN
        try {
            const isAutoCancel =
                action === "cancel" && (
                    /auto/i.test(reason) || req.body?.auto === true || req.body?.autoCancel === true
                );

            if (isAutoCancel) {
                const { pushNotif } = await import("../../helper/notif.js");
                const msgAuto = `Lịch khám ${dateISO} • ${timeHM} với ${row.doctor_name}${hosp} đã bị hệ thống tự hủy do quá hạn/không xác nhận. Mã: ${id}.`;
                await pushNotif({
                    userId: row.patient_user_id,
                    appointmentId: id,
                    kind: "auto_cancelled",
                    message: msgAuto,
                    subject: "TVN Medkit — Lịch khám bị tự hủy",
                });
            }
        } catch (e) {
            console.error("[doctor/appointments] pushNotif(auto cancel) failed:", e);
        }
        res.json({ id, status: newStatus });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Cập nhật trạng thái thất bại" });
    }
});

// PATCH /doctor/appointments/:id/payment 
router.patch("/:id/payment", requireAuth, requireRole("doctor"), async (req, res) => {
    try {
        const docId = await doctorIdOf(req.user.id);
        const id = Number(req.params.id || 0);
        const pay = String(req.body?.payment_status || "").toLowerCase();
        if (!["paid", "unpaid", "refunded"].includes(pay))
            return res.status(400).json({ message: "payment_status không hợp lệ" });

        const [[ap]] = await pool.query(`SELECT status FROM appointments WHERE id=? AND doctor_id=?`, [id, docId]);
        if (!ap) return res.status(404).json({ message: "Không tìm thấy phiếu" });
        if (ap.status === "cancelled") return res.status(400).json({ message: "Phiếu đã hủy. Không thể cập nhật thanh toán" });

        await pool.query(`UPDATE appointments SET payment_status=?, updated_at=NOW() WHERE id=? AND doctor_id=?`, [pay, id, docId]);
        res.json({ id, payment_status: pay });
    } catch {
        res.status(500).json({ message: "Cập nhật thanh toán thất bại" });
    }
});

export default router;


