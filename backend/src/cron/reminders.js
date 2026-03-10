import { pool } from "../db.js";
import { pushNotif } from "../helper/notif.js";

function between(val, a, b) { return val >= a && val <= b; }

export function startReminderJob() {
    async function tick() {
        try {
            // Lấy các lịch còn hiệu lực để gửi nhắc 24h/2h
            const [rows] = await pool.query(`
                SELECT a.id AS appt_id, a.patient_id, p.user_id AS patient_user_id,
                    d.full_name AS doctor_name, h.name AS hospital_name,
                    s.start_time
                FROM appointments a
                JOIN schedules  s ON s.id=a.schedule_id
                JOIN patients   p ON p.id=a.patient_id
                JOIN doctors    d ON d.id=a.doctor_id
                LEFT JOIN hospitals h ON h.id=d.hospital_id
                WHERE a.status IN ('pending','confirmed')
            `);

            const now = new Date();

            for (const r of rows) {
                const start = new Date(r.start_time);
                const diffHours = Math.round((start - now) / 36e5); // giờ (xấp xỉ)

                const dateISO = start.toISOString().slice(0, 10);
                const timeHM = start.toTimeString().slice(0, 5);

                // 24h: khoảng [23..25]
                if (between(diffHours, 23, 25)) {
                    const msg = `Nhắc lịch: Ngày mai ${dateISO} • ${timeHM} bạn có lịch với ${r.doctor_name} (${r.hospital_name}). Mã: ${r.appt_id}.`;
                    await pushNotif({
                        userId: r.patient_user_id,
                        appointmentId: r.appt_id,
                        kind: "upcoming_24h",
                        message: msg,
                    });
                }
            }



            // 2h: khoảng [1..3]
            const cand = [];
            for (const r of rows) {
                const diffHours = Math.round((new Date(r.start_time) - now) / 36e5);
                if (diffHours >= 1 && diffHours <= 3) cand.push(r);
            }
            if (cand.length) {
                const ids = cand.map(x => x.appt_id);
                const [sentList] = await pool.query(
                    `SELECT appointment_id FROM notifications
                    WHERE kind='upcoming_2h' AND appointment_id IN (${ids.map(() => "?").join(",")})`,
                    ids
                );
                const sentSet = new Set(sentList.map(x => x.appointment_id));

                for (const r of cand) {
                    if (sentSet.has(r.appt_id)) continue; // đã gửi -> bỏ qua
                    const start = new Date(r.start_time);
                    const timeHM = start.toTimeString().slice(0, 5);
                    await pushNotif({
                        userId: r.patient_user_id,
                        appointmentId: r.appt_id,
                        kind: "upcoming_2h",
                        message: `Nhắc lịch: Còn khoảng 2 giờ (${timeHM}) bạn có lịch với ${r.doctor_name} (${r.hospital_name}). Mã: ${r.appt_id}.`,
                        subject: "TVN Medkit — Nhắc lịch còn 2 giờ trước khi khám",
                    });
                }
            }

            //AUTO-CANCEL: quá thời gian khám 1 giờ -> hủy với lý do "Bệnh nhân vắng mặt"
            const runAt = new Date();

            // 1) Chọn các phiếu đã quá giờ khám > 60' vẫn còn pending/confirmed
            const [late] = await pool.query(`
                    SELECT a.id AS appt_id,
                            p.user_id AS patient_user_id, p.full_name AS patient_name,
                            d.user_id AS doctor_user_id, d.full_name AS doctor_name,
                            h.name AS hospital_name,
                            DATE(s.start_time) AS day, TIME(s.start_time) AS timeHM
                        FROM appointments a
                        JOIN schedules  s ON s.id=a.schedule_id
                        JOIN patients   p ON p.id=a.patient_id
                        JOIN doctors    d ON d.id=a.doctor_id
                        LEFT JOIN hospitals h ON h.id=d.hospital_id
                        WHERE a.status IN ('pending','confirmed')
                        AND s.start_time < (NOW() - INTERVAL 1 HOUR)
                        LIMIT 500
                    `);
            if (late.length) {
                const ids = late.map(x => x.appt_id);

                // 2) Update lí do hủy (chỉ đổi những phiếu vẫn còn pending/confirmed)
                await pool.query(`
                        UPDATE appointments
                        SET status='cancelled',
                            cancel_reason='Bệnh nhân vắng mặt',
                            updated_at=NOW()
                        WHERE id IN ( ${ids.map(() => "?").join(",")} )
                        AND status IN ('pending','confirmed')
                        `, ids);

                // 3) Gửi thông báo cho 2 phía, chỉ với các dòng vừa được cập nhật trong tick này
                //Lọc theo updated_at >= runAt
                const [justUpdated] = await pool.query(`
                        SELECT a.id AS appt_id,
                                p.user_id AS patient_user_id, p.full_name AS patient_name,
                                d.user_id AS doctor_user_id, d.full_name AS doctor_name,
                                h.name AS hospital_name,
                                DATE(s.start_time) AS day, TIME(s.start_time) AS timeHM
                        FROM appointments a
                        JOIN schedules  s ON s.id=a.schedule_id
                        JOIN patients   p ON p.id=a.patient_id
                        JOIN doctors    d ON d.id=a.doctor_id
                        LEFT JOIN hospitals h ON h.id=d.hospital_id
                        WHERE a.id IN ( ${ids.map(() => "?").join(",")} )
                            AND a.status='cancelled'
                            AND a.cancel_reason='Bệnh nhân vắng mặt'
                            AND a.updated_at >= ?
                        `, [...ids, runAt]);

                for (const r of justUpdated) {
                    const hosp = r.hospital_name ? ` (${r.hospital_name})` : "";
                    const msgP = `Lịch khám ${r.day} • ${r.timeHM} với ${r.doctor_name}${hosp} đã bị hủy do vắng mặt. Mã: ${r.appt_id}.`;
                    const msgD = `Bệnh nhân ${r.patient_name} vắng mặt. Lịch ${r.day} • ${r.timeHM} đã hủy. Mã: ${r.appt_id}.`;
                    const tasks = [];
                    if (r.patient_user_id) tasks.push(pushNotif({
                        userId: r.patient_user_id, appointmentId: r.appt_id,
                        kind: "cancelled", message: msgP, subject: "TVN Medkit — Lịch bị hủy do vắng mặt"
                    }));
                    if (r.doctor_user_id) tasks.push(pushNotif({
                        userId: r.doctor_user_id, appointmentId: r.appt_id,
                        kind: "cancelled", message: msgD, subject: "TVN Medkit — Bệnh nhân vắng mặt"
                    }));
                    await Promise.all(tasks);
                }
            }

        } catch (e) {
            console.warn("[reminders] tick fail:", e.message);
        }
    }

    // chạy ngay khi boot + lặp mỗi 10 phút
    tick();
    setInterval(tick, 10 * 60 * 1000);
}
