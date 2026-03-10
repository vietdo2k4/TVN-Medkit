import { pool } from "../db.js";
import { sendMail } from "./mail.js";

/** kind: booked | confirmed | cancelled | upcoming_24h | upcoming_2h | other */
export async function pushNotif({ userId, appointmentId = null, kind = "other", message, subject }) {
    await pool.query(
        `INSERT INTO notifications(user_id, message, kind, appointment_id, sent_at, is_read)
     VALUES (?,?,?,?, NOW(), 0)
     ON DUPLICATE KEY UPDATE
       message=VALUES(message),
       sent_at=VALUES(sent_at),
       updated_at=NOW()`,
        [userId, message, kind, appointmentId]
    );

    // Lấy email user
    const [[u]] = await pool.query("SELECT email FROM users WHERE id=? LIMIT 1", [userId]);
    const email = u?.email;
    if (!email) return;

    // Subject mặc định theo kind nếu không override
    const mapSubject = {
        booked: "TVN Medkit — Đặt lịch thành công",
        confirmed: "TVN Medkit — Lịch khám đã được xác nhận",
        cancelled: "TVN Medkit — Lịch khám đã hủy",
        upcoming_24h: "TVN Medkit — Nhắc lịch khám (còn 24 giờ)",
        upcoming_2h: "TVN Medkit — Nhắc lịch khám (còn 2 giờ)",
        other: "TVN Medkit — Thông báo",
    };
    const sbj = subject || mapSubject[kind] || mapSubject.other;

    // HTML tối giản
    const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6">
      <h3>${sbj}</h3>
      <p>${message}</p>
      <p style="color:#888">Bạn có thể xem chi tiết tại trang Thông báo trên TVN Medkit.</p>
    </div>
  `;
    await sendMail(email, sbj, html);
}
