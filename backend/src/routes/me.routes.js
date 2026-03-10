import { Router } from "express";
import { pool } from "../db.js";
import { pushNotif } from "../helper/notif.js";
import { requireAuth } from "../middleware/auth.js";
import bcrypt from "bcryptjs";

const router = Router();

/** GET /me -> thông tin tài khoản + hồ sơ bệnh nhân */
router.get("/me", requireAuth, async (req, res) => {
    const id = req.user.id;
    try {
        const [[user]] = await pool.query(
            "SELECT id, email, role, status, created_at FROM users WHERE id=? LIMIT 1",
            [id]
        );
        if (!user) return res.status(404).json({ message: "Không tìm thấy tài khoản" });

        const [[rawProfile]] = await pool.query(
            "SELECT full_name, gender, dob, phone, address, insurance_no FROM patients WHERE user_id=? LIMIT 1",
            [id]
        );

        // profile luôn có field, fallback null; gộp email để FE điền trực tiếp
        const profile = {
            full_name: rawProfile?.full_name ?? null,
            gender: rawProfile?.gender ?? null,
            dob: rawProfile?.dob ?? null,
            phone: rawProfile?.phone ?? null,
            address: rawProfile?.address ?? null,
            insurance_no: rawProfile?.insurance_no ?? null,
            email: user.email ?? null,
        };

        res.json({ user, profile });
    } catch (e) {
        console.error("[GET /me]", e);
        res.status(500).json({ message: "Không lấy được thông tin" });
    }
});

/** GET /me/patient -> lấy hồ sơ bệnh nhân */
router.get("/me/patient", requireAuth, async (req, res) => {
    try {
        const [[row]] = await pool.query(
            "SELECT full_name, gender, dob, phone, address, insurance_no FROM patients WHERE user_id=? LIMIT 1",
            [req.user.id]
        );
        res.json(row || {});
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Không lấy được hồ sơ" });
    }
});

/** PUT /me/patient -> cập nhật hồ sơ bệnh nhân (upsert) */
router.put("/me/patient", requireAuth, async (req, res) => {
    const { full_name, gender, dob, phone, address, insurance_no } = req.body || {};
    try {
        await pool.query(
            `
      INSERT INTO patients (user_id, full_name, gender, dob, phone, address, insurance_no)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        full_name=VALUES(full_name),
        gender=VALUES(gender),
        dob=VALUES(dob),
        phone=VALUES(phone),
        address=VALUES(address),
        insurance_no=VALUES(insurance_no),
        updated_at=NOW()
      `,
            [req.user.id, full_name, gender, dob || null, phone, address, insurance_no]
        );

        const [[row]] = await pool.query(
            "SELECT full_name, gender, dob, phone, address, insurance_no FROM patients WHERE user_id=? LIMIT 1",
            [req.user.id]
        );
        res.json(row || {});
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Cập nhật hồ sơ thất bại" });
    }
});

// Lấy danh sách phiếu khám của user hiện tại
router.get("/me/appointments", requireAuth, async (req, res) => {
    const userId = req.user.id;
    const { status = "all" } = req.query;

    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || "10", 10)));
    const offset = (page - 1) * limit;

    try {
        // map user -> patient_id
        const [[pat]] = await pool.query(
            "SELECT id FROM patients WHERE user_id=? LIMIT 1", [userId]
        );
        if (!pat) return res.json({ page, limit, total: 0, total_pages: 0, items: [], available_statuses: [] });
        const patientId = pat.id;

        // các trạng thái hợp lệ cho bệnh nhân này
        const [distinctRows] = await pool.query(
            "SELECT DISTINCT LOWER(status) AS status FROM appointments WHERE patient_id=?",
            [patientId]
        );
        const validStatuses = new Set(distinctRows.map(r => r.status).filter(Boolean));


        let where = "a.patient_id = ?";
        const params = [patientId];

        if (status !== "all" && validStatuses.has(String(status).toLowerCase())) {
            where += " AND LOWER(a.status) = ?";
            params.push(String(status).toLowerCase());
        }

        // total
        const [[{ total }]] = await pool.query(
            `SELECT COUNT(*) AS total FROM appointments a WHERE ${where}`, params
        );

        // list
        params.push(limit, offset);
        const [rows] = await pool.query(
            `
      SELECT
        a.id,
        LOWER(a.status)          AS status,
        LOWER(a.payment_status)  AS payment_status,
        a.created_at             AS created_at,  
        DATE_FORMAT(sc.start_time,'%Y-%m-%d') AS date,
        TIME_FORMAT(sc.start_time,'%H:%i')    AS time,
        d.full_name  AS doctor_name,
        h.name       AS hospital_name,
        -- lấy 1 tên dịch vụ đại diện của bác sĩ (nếu có)
        MIN(s.name)  AS service_name
      FROM appointments a
      JOIN schedules  sc ON sc.id = a.schedule_id
      JOIN doctors    d  ON d.id  = a.doctor_id
      LEFT JOIN hospitals h ON h.id = d.hospital_id
      LEFT JOIN doctor_services ds ON ds.doctor_id = d.id
      LEFT JOIN services s ON s.id = ds.service_id
      WHERE ${where}
      GROUP BY a.id, a.status, a.payment_status, a.created_at, sc.start_time, d.full_name, h.name
      ORDER BY a.created_at DESC, a.id DESC 
      LIMIT ? OFFSET ?`,
            params
        );

        res.json({
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
            items: rows,
            available_statuses: Array.from(validStatuses),
        });
    } catch (e) {
        console.error("[/me/appointments]", e);
        res.status(500).json({ message: "Không lấy được danh sách phiếu khám", error: e.sqlMessage || e.message });
    }
});

// Thống kê số phiếu theo trạng thái
router.get("/me/appointments/stats", requireAuth, async (req, res) => {
    try {
        const [[pat]] = await pool.query(
            "SELECT id FROM patients WHERE user_id=? LIMIT 1", [req.user.id]
        );
        if (!pat) return res.json([]);
        const patientId = pat.id;

        const [rows] = await pool.query(
            `
      SELECT LOWER(status) AS status, COUNT(*) AS count
      FROM appointments
      WHERE patient_id = ?
      GROUP BY LOWER(status)
      `,
            [patientId]
        );
        res.json(rows);
    } catch (e) {
        console.error("[/me/appointments/stats]", e);
        res.status(500).json({ message: "Không lấy được thống kê", error: e.sqlMessage || e.message });
    }
});

// Chi tiết 1 phiếu
router.get("/me/appointments/:id", requireAuth, async (req, res) => {
    try {
        const [[pat]] = await pool.query(
            "SELECT id, full_name FROM patients WHERE user_id=? LIMIT 1",
            [req.user.id]
        );
        if (!pat) return res.status(404).json({ message: "Không tìm thấy phiếu" });

        const apptId = Number(req.params.id);

        const [rows] = await pool.query(
            `
      SELECT
        a.id,
        LOWER(a.status)          AS status,           
        LOWER(a.payment_status)  AS payment_status,   
        a.symptoms_note,
        a.cancel_reason, 
        DATE_FORMAT(sc.start_time,'%Y-%m-%d') AS date,
        TIME_FORMAT(sc.start_time,'%H:%i')    AS time,
        d.full_name   AS doctor_name,
        h.name        AS hospital_name,
        sp.name       AS specialty_name,
        MIN(s.name)   AS service_name,
        d.fee_min     AS price,  
        ?             AS patient_name
      FROM appointments a
      JOIN schedules   sc ON sc.id = a.schedule_id
      JOIN doctors     d  ON d.id  = a.doctor_id
      LEFT JOIN hospitals  h  ON h.id = d.hospital_id
      LEFT JOIN specialties sp ON sp.id = d.specialty_id
      LEFT JOIN doctor_services ds ON ds.doctor_id = d.id
      LEFT JOIN services s ON s.id = ds.service_id
      WHERE a.id = ? AND a.patient_id = ?
      GROUP BY a.id, a.status, a.payment_status, a.created_at, sc.start_time, d.full_name, h.name, 
                sp.name, a.symptoms_note, a.cancel_reason, d.fee_min
      LIMIT 1
      `,
            [pat.full_name, apptId, pat.id]
        );

        if (!rows.length) return res.status(404).json({ message: "Không tìm thấy phiếu" });
        res.json(rows[0]);
    } catch (e) {
        console.error("[/me/appointments/:id]", e);
        res.status(500).json({ message: "Không lấy được chi tiết phiếu", error: e.sqlMessage || e.message });
    }
});


// Hủy phiếu khám: POST /api/me/appointments/:id/cancel
router.post("/me/appointments/:id/cancel", requireAuth, async (req, res) => {
    try {
        const apptId = Number(req.params.id);
        const [[pat]] = await pool.query(
            "SELECT id, full_name FROM patients WHERE user_id=? LIMIT 1",
            [req.user.id]
        );
        if (!pat) return res.status(400).json({ message: "Chưa có hồ sơ bệnh nhân" });

        // Lấy thông tin phiếu
        const [rows] = await pool.query(
            `
      SELECT a.id, a.patient_id, a.status, a.payment_status, sc.start_time
      FROM appointments a
      JOIN schedules sc ON sc.id = a.schedule_id
      WHERE a.id=? AND a.patient_id=? LIMIT 1
      `,
            [apptId, pat.id]
        );
        if (!rows.length) return res.status(404).json({ message: "Không tìm thấy phiếu" });

        const appt = rows[0];
        if (appt.status === "cancelled")
            return res.status(409).json({ message: "Phiếu đã hủy trước đó" });
        if (appt.status === "completed")
            return res.status(409).json({ message: "Phiếu đã hoàn thành, không thể hủy" });

        // Không cho hủy nếu đã tới giờ khám
        const now = new Date();
        const start = new Date(appt.start_time);
        if (start <= now)
            return res.status(409).json({ message: "Đã tới giờ khám, không thể hủy" });

        // Cập nhật trạng thái
        await pool.query(
            "UPDATE appointments SET status='cancelled', cancel_reason=?, updated_at=NOW() WHERE id=?",
            [(req.body?.reason || "").toString().slice(0, 255) || "user: cancel", apptId]
        );

        // Lấy đầy đủ thông tin để gửi cho cả user & bác sĩ ---
        const [[info]] = await pool.query(
            `
            SELECT a.id AS appt_id,
                    d.full_name AS doctor_name,
                    h.name      AS hospital_name,
                    d.user_id   AS doctor_user_id,
                    p.full_name    AS patient_name,
                DATE_FORMAT(s.start_time,'%Y-%m-%d') AS dateISO,
                DATE_FORMAT(s.start_time,'%H:%i')    AS timeHM
            FROM appointments a
            JOIN doctors   d ON d.id=a.doctor_id
            JOIN hospitals h ON h.id=d.hospital_id
            JOIN schedules s ON s.id=a.schedule_id
            JOIN patients  p ON p.id=a.patient_id
            WHERE a.id=?
            `,
            [apptId]
        );

        // Thông báo cho người dùng 
        const msgPatient = `Bạn đã hủy lịch ${info.dateISO} • ${info.timeHM} với ${info.doctor_name} (${info.hospital_name}). Mã: ${info.appt_id}.`;
        await pushNotif({
            userId: req.user.id,
            appointmentId: apptId,
            kind: "cancelled",
            message: msgPatient,
            subject: "TVN Medkit — Bạn đã hủy lịch"
        });

        // Thông báo cho bác sĩ
        if (info?.doctor_user_id) {
            const msgDoctor = `Bệnh nhân ${info.patient_name} đã hủy lịch ${info.dateISO} • ${info.timeHM}. Mã: ${info.appt_id}.`;
            await pushNotif({
                userId: info.doctor_user_id,
                appointmentId: apptId,
                kind: "cancelled",
                message: msgDoctor,
                subject: "TVN Medkit — Bệnh nhân đã hủy lịch"
            });
        }

        // Trả về trạng thái mới cho FE cập nhật ngay
        res.json({ id: apptId, status: "cancelled", payment_status: appt.payment_status });
    } catch (e) {
        console.error("cancel appt", e);
        res.status(500).json({ message: "Hủy phiếu thất bại" });
    }
});

async function changePasswordHandler(req, res) {
    try {
        // Chấp nhận cả 2 schema body (để tương thích trong giai đoạn chuyển đổi)
        const cur = String(req.body?.old_password ?? req.body?.currentPassword ?? "");
        const next = String(req.body?.new_password ?? req.body?.newPassword ?? "");

        if (!cur || !next)
            return res.status(400).json({ message: "Thiếu mật khẩu hiện tại hoặc mật khẩu mới" });
        if (next.length < 8)
            return res.status(400).json({ message: "Mật khẩu mới tối thiểu 8 ký tự" });

        // Lấy hash hiện tại (hỗ trợ cả password_hash lẫn password)
        const [[user]] = await pool.query(
            "SELECT id, password_hash FROM users WHERE id=? LIMIT 1",
            [req.user.id]
        );
        if (!user) return res.status(404).json({ message: "Không tìm thấy tài khoản" });

        const currentHash = user.password_hash;
        if (!currentHash)
            return res.status(409).json({ message: "Tài khoản không có mật khẩu để đổi" });

        const ok = await bcrypt.compare(cur, currentHash);
        if (!ok) return res.status(400).json({ message: "Mật khẩu hiện tại không đúng" });

        const same = await bcrypt.compare(next, currentHash);
        if (same) return res.status(400).json({ message: "Mật khẩu mới phải khác mật khẩu hiện tại" });

        const newHash = await bcrypt.hash(next, 10);

        // Cập nhật an toàn: thử các biến thể để phù hợp mọi schema
        const tries = [
            "UPDATE users SET password_hash=?, updated_at=NOW() WHERE id=?",
            "UPDATE users SET password_hash=? WHERE id=?",
            "UPDATE users SET password=?, updated_at=NOW() WHERE id=?",
            "UPDATE users SET password=? WHERE id=?",
        ];
        let done = false;
        for (const sql of tries) {
            try {
                await pool.query(sql, [newHash, req.user.id]);
                done = true; break;
            } catch { /* thử câu tiếp theo */ }
        }
        if (!done) return res.status(500).json({ message: "Đổi mật khẩu thất bại" });

        return res.json({ ok: true, message: "Đổi mật khẩu thành công" });
    } catch (e) {
        console.error("[PATCH /me/password]", e);
        return res.status(500).json({ message: "Đổi mật khẩu thất bại" });
    }
}

router.patch("/me/password", requireAuth, changePasswordHandler);

export default router;
