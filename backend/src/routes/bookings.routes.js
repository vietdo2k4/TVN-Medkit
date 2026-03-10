import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { pushNotif } from "../helper/notif.js";

const r = Router();

//POST /api/bookings
r.post("/", requireAuth, async (req, res) => {
  const { doctorId, date, slot } = req.body || {};

  const symptoms_note = (
    req.body?.symptoms_note ??
    req.body?.note ??
    req.body?.reason ??
    ""
  ).toString().slice(0, 255);

  if (!doctorId || !date || !slot) {
    return res.status(400).json({ message: "Thiếu dữ liệu" });
  }

  if (!symptoms_note) {
    return res.status(400).json({ message: "Lý do khám không được để trống" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    //patient_id
    const [[pat]] = await conn.query(
      "SELECT id FROM patients WHERE user_id=? LIMIT 1",
      [req.user.id]
    );
    if (!pat) {
      await conn.rollback();
      return res.status(400).json({ message: "Chưa có hồ sơ bệnh nhân" });
    }

    //lock slot
    const [[sch]] = await conn.query(
      `
      SELECT s.id, s.doctor_id, s.start_time, s.capacity
      FROM schedules s
      WHERE s.doctor_id = ?
        AND DATE(s.start_time) = ?
        AND TIME(s.start_time) = STR_TO_DATE(?, '%H:%i')
        AND ( ? <> CURDATE() OR s.start_time >= NOW() )
      FOR UPDATE
      `,
      [doctorId, date, slot, date]
    );
    if (!sch) {
      await conn.rollback();
      return res.status(404).json({ message: "Không tìm thấy khung giờ" });
    }

    //dọn hold hết hạn 
    await conn.query("DELETE FROM slot_holds WHERE schedule_id=? AND expires_at<=NOW()", [sch.id]);

    const [[mineHold]] = await conn.query(
      "SELECT id FROM slot_holds WHERE schedule_id=? AND user_id=? AND expires_at>NOW() FOR UPDATE",
      [sch.id, req.user.id]
    );
    const hasMyHold = !!mineHold;

    const [[agg]] = await conn.query(
      `SELECT
         (SELECT COUNT(*) FROM appointments WHERE schedule_id=? AND status IN ('pending','confirmed')) AS appt,
         (SELECT COUNT(*) FROM slot_holds  WHERE schedule_id=? AND expires_at>NOW()) AS holdcnt`,
      [sch.id, sch.id]
    );

    const capacity = Number(sch.capacity ?? 1);
    const used = Number(agg.appt || 0) + Number(agg.holdcnt || 0);
    if ((!hasMyHold && used >= capacity) || (hasMyHold && used > capacity)) {
      await conn.rollback();
      return res.status(409).json({ message: "Khung giờ đã hết chỗ" });
    }

    //tạo appointment
    const [ins] = await conn.query(
      `INSERT INTO appointments
         (patient_id, doctor_id, schedule_id, status, symptoms_note, payment_status)
       VALUES (?, ?, ?, 'pending', ?, 'unpaid')`,
      [pat.id, sch.doctor_id, sch.id, symptoms_note]
    );
    const apptId = ins.insertId;

    // xóa hold (nếu có)
    if (hasMyHold) {
      await conn.query("DELETE FROM slot_holds WHERE schedule_id=? AND user_id=?", [sch.id, req.user.id]);
    }

    await conn.commit();

    //thông báo
    const [[info]] = await pool.query(
      `SELECT a.id AS appt_id,
              d.full_name  AS doctor_name,
              d.user_id    AS doctor_user_id,
              h.name       AS hospital_name,
              DATE_FORMAT(s.start_time,'%Y-%m-%d') AS dateISO,
               DATE_FORMAT(s.start_time,'%H:%i')    AS timeHM,
              d.fee_min    AS price
       FROM appointments a
       JOIN doctors   d ON d.id=a.doctor_id
       JOIN hospitals h ON h.id=d.hospital_id
       JOIN schedules s ON s.id=a.schedule_id
       WHERE a.id=?`,
      [apptId]
    );

    // thông báo cho USER: đã đặt thành công
    const msgUser = `Bạn đã đặt lịch ${info.dateISO} • ${info.timeHM} với ${info.doctor_name} (${info.hospital_name}). Mã: ${info.appt_id}`;
    try {
      await pushNotif({
        userId: req.user.id,
        appointmentId: apptId,
        kind: "booked",
        message: msgUser,
      });
    } catch (e) {
      console.warn("pushNotif(user, booked) fail:", e?.message || e);
    }

    // thông báo cho BÁC SĨ: có lịch mới
    if (info.doctor_user_id) {
      const msgDoctor = `Có lịch hẹn mới: ${info.dateISO} • ${info.timeHM}. Mã: ${info.appt_id}`;
      try {
        await pushNotif({
          userId: info.doctor_user_id,
          appointmentId: apptId,
          kind: "booked",
          message: msgDoctor,
        });
      } catch (e) {
        console.warn("pushNotif(doctor, booked) fail:", e?.message || e);
      }
    }

    return res.status(201).json({
      appointmentId: apptId,
      scheduleId: sch.id,
      price: Number(info.price || 0)
    });
  } catch (e) {
    try { await conn.rollback(); } catch { }

    if (e?.code === "ER_DUP_ENTRY") {
      const m = String(e.sqlMessage || "");
      if (m.includes("uk_appt_active_key") || m.includes("uk_appt_sched_active")) {
        return res.status(409).json({ message: "Khung giờ đã hết chỗ" });
      }
      return res.status(409).json({ message: "Khung giờ đã được đặt" });
    }

    console.error("POST /bookings:", e);
    return res.status(500).json({ message: "Lỗi server" });
  } finally {
    conn.release();
  }
});

r.patch("/:id/cancel", requireAuth, async (req, res) => {
  const apptId = Number(req.params.id || 0);
  if (!apptId) return res.status(400).json({ message: "Thiếu id" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // xác định appointment thuộc về user hiện tại
    const [[row]] = await conn.query(
      `SELECT a.id, a.status, a.patient_id, a.doctor_id, a.schedule_id,
              u.id   AS user_id,
              d.user_id AS doctor_user_id,
              p.full_name AS patient_name,
              DATE_FORMAT(s.start_time,'%Y-%m-%d') AS dateISO,
              DATE_FORMAT(s.start_time,'%H:%i')    AS timeHM
       FROM appointments a
       JOIN patients p ON p.id=a.patient_id
       JOIN users    u ON u.id=p.user_id
       JOIN doctors  d ON d.id=a.doctor_id
       JOIN schedules s ON s.id=a.schedule_id
       WHERE a.id=? AND u.id=? LIMIT 1`,
      [apptId, req.user.id]
    );
    if (!row) {
      await conn.rollback();
      return res.status(404).json({ message: "Không tìm thấy phiếu" });
    }
    if (!["pending", "confirmed"].includes(row.status)) {
      await conn.rollback();
      return res.status(409).json({ message: "Trạng thái hiện tại không cho phép hủy" });
    }

    await conn.query("UPDATE appointments SET status='cancelled' WHERE id=?", [apptId]);
    await conn.commit();

    // gửi thông báo
    const msgForDoctor = `Bệnh nhân ${row.patient_name} đã hủy lịch ${row.dateISO} • ${row.timeHM}. Mã: ${apptId}`;
    const msgForPatient = `Bạn đã hủy lịch ${row.dateISO} • ${row.timeHM}. Mã: ${apptId}`;

    try {
      if (row.doctor_user_id)
        await pushNotif({ userId: row.doctor_user_id, appointmentId: apptId, kind: "cancelled", message: msgForDoctor });
      await pushNotif({ userId: req.user.id, appointmentId: apptId, kind: "cancelled", message: msgForPatient });
    } catch (e) {
      console.warn("pushNotif(cancelled) fail:", e?.message || e);
    }

    return res.json({ id: apptId, status: "cancelled" });
  } catch (e) {
    try { await conn.rollback(); } catch { }
    console.error("PATCH /bookings/:id/cancel:", e);
    return res.status(500).json({ message: "Lỗi server" });
  } finally {
    conn.release();
  }
});

export default r;
