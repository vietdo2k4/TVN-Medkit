import { Router } from "express";
import { pool } from "../db.js";

const r = Router();
const toInt = (v, d = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
const like = (s) => `%${String(s || "").trim()}%`;

/* GET /doctors  — list + filter */
r.get("/", async (req, res) => {
  try {
    const { q, specialty, city, price, hospital } = req.query;
    const limit = Math.min(Math.max(toInt(req.query.limit, 12), 1), 60);
    const offset = Math.max(toInt(req.query.offset, 0), 0);

    const where = [];
    const p = [];

    if (q) {
      where.push("(d.full_name LIKE ? OR sp.name LIKE ? OR h.name LIKE ?)");
      p.push(like(q), like(q), like(q));
    }

    if (specialty) {
      if (/^\d+$/.test(String(specialty))) { where.push("d.specialty_id=?"); p.push(toInt(specialty)); }
      else { where.push("sp.name LIKE ?"); p.push(like(specialty)); }
    }

    if (city) { where.push("h.address LIKE ?"); p.push(like(city)); }

    // filter theo cơ sở y tế (id hoặc tên)
    if (hospital) {
      if (/^\d+$/.test(String(hospital))) { where.push("d.hospital_id = ?"); p.push(toInt(hospital)); }
      else { where.push("h.name LIKE ?"); p.push(like(hospital)); }
    }

    // filter theo giá
    if (price === "lt300") {
      where.push("(d.fee_min IS NOT NULL AND d.fee_min < 300000)");
    } else if (price === "300-500") {
      where.push("(d.fee_min IS NOT NULL AND d.fee_max IS NOT NULL AND d.fee_min >= 300000 AND d.fee_max <= 500000)");
    } else if (price === "gt500") {
      where.push("(d.fee_max IS NOT NULL AND d.fee_max > 500000)");
    }

    const ws = where.length ? "WHERE " + where.join(" AND ") : "";
    const baseFrom = `
      FROM doctors d
      LEFT JOIN specialties sp ON sp.id = d.specialty_id
      LEFT JOIN hospitals   h  ON h.id = d.hospital_id
      ${ws}
    `;

    // total
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${baseFrom}`, p);

    // page data
    const [rows] = await pool.query(
      `SELECT d.id, d.full_name, d.avatar,
              sp.name AS specialty_name,
              h.name  AS hospital_name, h.address AS hospital_address,
              COALESCE(d.rating_avg,0) AS rating_avg, d.rating_count,
              d.fee_min, d.fee_max,
              SUBSTRING_INDEX(TRIM(SUBSTRING_INDEX(h.address, ',', -1)), ',', 1) AS city
       ${baseFrom}
       ORDER BY (d.rating_avg IS NULL), d.rating_avg DESC, d.rating_count DESC, d.id DESC
       LIMIT ? OFFSET ?`,
      [...p, limit, offset]
    );

    res.json({ items: rows, total, limit, offset });
  } catch (e) {
    console.error("GET /doctors:", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

/* GET /doctors/featured  — carousel trang chủ */
r.get("/featured", async (req, res) => {
  try {
    const limit = Math.min(Math.max(toInt(req.query.limit, 8), 1), 24);
    const [rows] = await pool.query(
      `SELECT d.id, d.full_name, d.avatar,
              sp.name AS specialty_name, h.name AS hospital_name,
              d.rating_avg, d.rating_count, d.fee_min, d.fee_max
       FROM doctors d
       LEFT JOIN specialties sp ON sp.id=d.specialty_id
       LEFT JOIN hospitals   h  ON h.id=d.hospital_id
       ORDER BY d.rating_count DESC, (d.rating_avg IS NULL), d.rating_avg DESC, d.id DESC
       LIMIT ?`, [limit]
    );
    res.json(rows);
  } catch (e) {
    console.error("GET /doctors/featured:", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

/* GET /doctors/:id  — chi tiết */
r.get("/:id", async (req, res) => {
  const id = +req.params.id;
  const [rows] = await pool.query(
    `SELECT
        d.id, d.full_name AS name, d.avatar, d.bio,
        d.experience_years, d.phone, d.rating_avg, d.rating_count,
        d.fee_min, d.fee_max,
        sp.id   AS specialty_id,
        sp.name AS specialty,
        h.id    AS hospital_id,
        h.name  AS hospital,
        h.address AS hospital_address
     FROM doctors d
     LEFT JOIN specialties sp ON sp.id = d.specialty_id
     LEFT JOIN hospitals   h  ON h.id = d.hospital_id
     WHERE d.id = ?`, [id]
  );
  if (!rows.length) return res.status(404).json({ message: "Không tìm thấy bác sĩ" });
  res.json(rows[0]);
});

/* GET /api/doctors/:id/available-days — ngày còn slot trống trong 60 ngày
   TÍNH CẢ HOLD (slot_holds.expires_at>NOW()) */
r.get("/:id/available-days", async (req, res) => {
  const id = +req.params.id;
  const [rows] = await pool.query(
    `SELECT DATE(s.start_time) AS day,
            SUM(s.capacity) AS total_capacity,
            SUM(IFNULL(ap.appt_active,0) + IFNULL(sh.hold_active,0)) AS used
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
     WHERE s.doctor_id = ?
       AND s.start_time >= CURDATE()
       AND s.start_time <  DATE_ADD(CURDATE(), INTERVAL 60 DAY)
     GROUP BY DATE(s.start_time)
     HAVING used < total_capacity
     ORDER BY day`,
    [id]
  );
  res.json(rows.map(x => x.day));
});

/* GET /api/doctors/:id/slots?date=YYYY-MM-DD — slot rảnh theo ngày*/
r.get("/:id/slots", async (req, res) => {
  const id = +req.params.id;
  const date = String(req.query.date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ message: "Thiếu hoặc sai định dạng date" });
  }

  try {
    const uid = req.user?.id || 0;

    const [rows] = await pool.query(
      `WITH ap AS (
         SELECT schedule_id, COUNT(*) ap_cnt
         FROM appointments
         WHERE status IN ('pending','confirmed')
         GROUP BY schedule_id
       ),
       hd AS (
         SELECT schedule_id,
                SUM(CASE WHEN expires_at>NOW() THEN 1 ELSE 0 END) hold_cnt,
                SUM(CASE WHEN expires_at>NOW() AND user_id<>? THEN 1 ELSE 0 END) hold_other_cnt
         FROM slot_holds
         GROUP BY schedule_id
       )
       SELECT
         s.id AS scheduleId,
         TIME_FORMAT(s.start_time,'%H:%i') AS time,
         IF(HOUR(s.start_time)<12,'morning','afternoon') AS session,
         s.capacity,
         IFNULL(ap.ap_cnt,0) AS ap_cnt,
         IFNULL(hd.hold_other_cnt,0) AS hold_other_cnt
       FROM schedules s
       LEFT JOIN ap ON ap.schedule_id = s.id
       LEFT JOIN hd ON hd.schedule_id = s.id
       WHERE s.doctor_id = ?
         AND DATE(s.start_time) = ?
         AND ( ? <> CURDATE() OR s.start_time >= NOW() )
         -- CHỈ GIỮ slot CÒN CHỖ: appt < capacity (KHÔNG tính hold)
         AND IFNULL(ap.ap_cnt,0) < s.capacity
       ORDER BY s.start_time`,
      [uid, id, date, date]
    );

    const result = rows.map(r => ({
      scheduleId: r.scheduleId,
      time: r.time,
      session: r.session,
      // Server đã loại slot FULL → booked luôn false để FE đỡ phải lọc
      booked: false,
      // đang có người khác giữ → FE mờ đi nhưng vẫn cho click
      held: Number(r.hold_other_cnt || 0) > 0,
    }));

    return res.json(result);
  } catch (e) {
    console.error("GET /doctors/:id/slots", e);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});


export default r;
