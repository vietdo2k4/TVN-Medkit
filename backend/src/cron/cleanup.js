import { pool } from "../db.js";
export async function cleanupHolds() {
    try {
        const [r] = await pool.query("DELETE FROM slot_holds WHERE expires_at<=NOW() LIMIT 2000");
        if (r.affectedRows) console.log("[cron] cleanupHolds:", r.affectedRows);
    } catch (e) { console.warn("cleanupHolds fail", e.message); }
}

//Auto-cancel nếu quá 60' sau giờ khám mà chưa khám
export async function autoCancelNoShow() {
    try {
        const [r] = await pool.query(`
      UPDATE appointments a
      JOIN schedules s ON s.id = a.schedule_id
      SET a.status='cancelled',
          a.cancel_reason = COALESCE(a.cancel_reason, 'Bệnh nhân vắng mặt'),
          a.updated_at = NOW()
      WHERE a.status IN ('pending','confirmed')
        AND NOW() > DATE_ADD(s.start_time, INTERVAL 60 MINUTE)
    `);
        if (r.affectedRows) console.log("[cron] autoCancelNoShow:", r.affectedRows);
    } catch (e) {
        console.error("[cron] autoCancelNoShow fail:", e.message);
    }
}