import { Router } from "express";
import bcrypt from "bcrypt";
import { pool } from "../db.js";

const router = Router();

// tiện ích phân trang
function paged(req, defLimit = 20) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || defLimit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/*DASHBOARD*/
router.get("/metrics", async (_req, res) => {
  try {
    // counts tổng + số hủy
    const [counts] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users)        AS users,
        (SELECT COUNT(*) FROM doctors)      AS doctors,
        (SELECT COUNT(*) FROM patients)     AS patients,
        (SELECT COUNT(*) FROM appointments) AS appointments,
        (SELECT COUNT(*) FROM hospitals)    AS hospitals,
        (SELECT COUNT(*) FROM specialties)  AS specialties,
        (SELECT COUNT(*) FROM services)     AS services,
        (SELECT COUNT(*) FROM appointments WHERE status='cancelled') AS cancelled
    `);

    // dải tháng cố định: 06/2025 → 12/2025, trả cả total, cancelled, net
    const [monthly] = await pool.query(`
      WITH RECURSIVE m AS (
        SELECT DATE('2025-06-01') d
        UNION ALL
        SELECT DATE_ADD(d, INTERVAL 1 MONTH) FROM m
        WHERE d < DATE('2025-12-01')
      )
      SELECT DATE_FORMAT(m.d,'%Y-%m') ym,
             COALESCE(t.total,0)       AS total,
             COALESCE(t.cancelled,0)   AS cancelled,
             COALESCE(t.total,0) - COALESCE(t.cancelled,0) AS net
      FROM m
      LEFT JOIN (
        SELECT DATE_FORMAT(created_at,'%Y-%m-01') d,
               COUNT(*) AS total,
               SUM(status='cancelled') AS cancelled
        FROM appointments
        GROUP BY DATE_FORMAT(created_at,'%Y-%m-01')
      ) t ON t.d = m.d
      ORDER BY m.d
    `);

    return res.json({ counts: counts[0], monthly });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

/*USERS CRUD*/
router.get("/users", async (req, res) => {
  const { limit, offset } = paged(req);
  const { role, status, q } = req.query;
  const where = [];
  const vals = [];
  if (role) { where.push("u.role=?"); vals.push(role); }
  if (status) { where.push("u.status=?"); vals.push(status); }
  if (q) { where.push("(COALESCE(p.full_name,d.full_name,'') LIKE ? OR u.email LIKE ?)"); vals.push(`%${q}%`, `%${q}%`); }
  try {
    const [rows] = await pool.query(
      `
      SELECT u.id, u.email, u.role, u.status, u.created_at,
             COALESCE(p.full_name,d.full_name) AS full_name
      FROM users u
      LEFT JOIN patients p ON p.user_id=u.id
      LEFT JOIN doctors  d ON d.user_id=u.id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY u.id DESC
      LIMIT ? OFFSET ?
      `,
      [...vals, limit, offset]
    );
    return res.json(rows);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});


router.get("/users/:id", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT u.*, COALESCE(p.full_name,d.full_name) AS full_name
      FROM users u
      LEFT JOIN patients p ON p.user_id=u.id
      LEFT JOIN doctors  d ON d.user_id=u.id
      WHERE u.id=?
      `,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Không tìm thấy" });
    return res.json(rows[0]);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});


router.post("/users", async (req, res) => {
  const { email, password, role = "patient", status = "active" } = req.body || {};
  if (!email) return res.status(400).json({ message: "Thiếu email" });
  try {
    const hash = password ? await bcrypt.hash(password, 10) : await bcrypt.hash(Math.random().toString(36), 10);
    const [r1] = await pool.query(
      `INSERT INTO users(email,password_hash,role,status) VALUES(?,?,?,?)`,
      [email, hash, role, status]
    );
    return res.status(201).json({ id: r1.insertId, email, role, status });
  } catch (e) {
    console.error(e);
    if (e?.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Email đã tồn tại" });
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

router.patch("/users/:id", async (req, res) => {
  const { email, role, status, password } = req.body || {};
  const sets = [];
  const vals = [];
  try {
    if (email) { sets.push("email=?"); vals.push(email); }
    if (role) { sets.push("role=?"); vals.push(role); }
    if (status) { sets.push("status=?"); vals.push(status); }
    if (password) { sets.push("password_hash=?"); vals.push(await bcrypt.hash(password, 10)); }
    if (!sets.length) return res.json({ ok: true });
    vals.push(req.params.id);
    await pool.query(`UPDATE users SET ${sets.join(",")}, updated_at=NOW() WHERE id=?`, vals);
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    // chặn xóa bác sĩ còn lịch hẹn tương lai
    const [aff] = await pool.query(
      `
      SELECT d.id AS doctor_id, EXISTS(
        SELECT 1
        FROM appointments a
        JOIN schedules s ON s.id=a.schedule_id
        WHERE a.doctor_id=d.id
          AND s.start_time >= NOW()
          AND a.status IN ('pending','confirmed')
      ) AS has_future
      FROM users u LEFT JOIN doctors d ON d.user_id=u.id
      WHERE u.id=?
      `,
      [req.params.id]
    );
    if (aff.length && aff[0].doctor_id && aff[0].has_future) {
      return res.status(409).json({ message: "Doctor còn lịch hẹn trong tương lai" });
    }
    await pool.query(`DELETE FROM users WHERE id=?`, [req.params.id]);
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

/*DOCTORS CRUD + tạo tài khoản*/
router.get("/doctors", async (req, res) => {
  const { limit, offset } = paged(req);
  const { q, hospitalId, specialtyId } = req.query;
  const where = [];
  const vals = [];
  if (q) { where.push("d.full_name LIKE ?"); vals.push(`%${q}%`); }
  if (hospitalId) { where.push("d.hospital_id=?"); vals.push(hospitalId); }
  if (specialtyId) { where.push("d.specialty_id=?"); vals.push(specialtyId); }
  try {
    const [rows] = await pool.query(
      `
      SELECT d.*, h.name AS hospital_name, s.name AS specialty_name, u.email AS account_email
      FROM doctors d
      LEFT JOIN hospitals h ON h.id=d.hospital_id
      LEFT JOIN specialties s ON s.id=d.specialty_id
      LEFT JOIN users u ON u.id=d.user_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY d.id DESC
      LIMIT ? OFFSET ?
      `,
      [...vals, limit, offset]
    );
    return res.json(rows);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

router.get("/doctors/:id", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT d.*, h.name AS hospital_name, s.name AS specialty_name, u.email AS account_email
      FROM doctors d
      LEFT JOIN hospitals h ON h.id=d.hospital_id
      LEFT JOIN specialties s ON s.id=d.specialty_id
      LEFT JOIN users u ON u.id=d.user_id
      WHERE d.id=?
      `,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Không tìm thấy" });
    return res.json(rows[0]);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

router.post("/doctors", async (req, res) => {
  const {
    full_name, gender, dob, phone, avatar, license_no,
    experience_years, bio, specialty_id, hospital_id, fee_min, fee_max
  } = req.body || {};
  if (!full_name) return res.status(400).json({ message: "Thiếu tên bác sĩ" });
  try {
    const [rs] = await pool.query(
      `
      INSERT INTO doctors(full_name, gender, dob, phone, avatar, license_no,
        experience_years, bio, specialty_id, hospital_id, fee_min, fee_max)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
      `,
      [full_name, gender, dob, phone, avatar, license_no,
        experience_years, bio, specialty_id, hospital_id, fee_min, fee_max]
    );
    return res.status(201).json({ id: rs.insertId });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

router.patch("/doctors/:id", async (req, res) => {
  const allow = ["full_name", "gender", "dob", "phone", "avatar", "license_no", "experience_years", "bio", "specialty_id", "hospital_id", "fee_min", "fee_max"];
  const sets = [];
  const vals = [];
  try {
    for (const k of allow) if (k in req.body) { sets.push(`${k}=?`); vals.push(req.body[k]); }
    if (!sets.length) return res.json({ ok: true });
    vals.push(req.params.id);
    await pool.query(`UPDATE doctors SET ${sets.join(",")}, updated_at=NOW() WHERE id=?`, vals);
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

//Xóa bác sĩ khỏi hệ thống -> nếu có tài khoản => xóa luôn
router.delete("/doctors/:id", async (req, res) => {
  const id = req.params.id;
  const conn = await pool.getConnection();

  try {
    // 1) Lấy thông tin bác sĩ (kèm user_id nếu có)
    const [[doc]] = await conn.query(
      `SELECT id, user_id FROM doctors WHERE id=?`,
      [id]
    );
    if (!doc) { conn.release(); return res.status(404).json({ message: "Không tìm thấy" }); }

    // 2) Chặn xóa nếu còn lịch hẹn tương lai (pending/confirmed)
    const [[fut]] = await conn.query(
      `
      SELECT EXISTS(
        SELECT 1
        FROM appointments ap
        JOIN schedules s ON s.id=ap.schedule_id
        WHERE ap.doctor_id=?
          AND s.start_time >= NOW()
          AND ap.status IN ('pending','confirmed')
      ) AS has_future
      `,
      [id]
    );
    if (fut.has_future) { conn.release(); return res.status(409).json({ message: "🚫Không xóa được do bác sĩ vẫn còn lịch hẹn" }); }

    //Transaction: xóa bác sĩ -> xóa tài khoản user (nếu role=doctor)
    await conn.beginTransaction();

    // Xóa bác sĩ trước để tránh ràng buộc FK (doctors.user_id -> users.id)
    await conn.query(`DELETE FROM doctors WHERE id=?`, [id]);

    // Nếu có tài khoản gắn kèm thì xóa luô
    if (doc.user_id) {
      await conn.query(
        `DELETE FROM users WHERE id=? AND role='doctor'`,
        [doc.user_id]
      );
    }

    await conn.commit();
    return res.json({ ok: true });
  } catch (e) {
    try { await conn.rollback(); } catch { }
    console.error(e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  } finally {
    conn.release();
  }
});

//Tạo tài khoản cho bác sĩ
router.post("/doctors/:id/create-account", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email) return res.status(400).json({ message: "Thiếu email" });
  try {
    const [rows] = await pool.query(`SELECT user_id FROM doctors WHERE id=?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Không tìm thấy" });
    if (rows[0].user_id) return res.status(409).json({ message: "Doctor đã có tài khoản" });

    const hash = await bcrypt.hash(password || Math.random().toString(36), 10);
    const [u] = await pool.query(
      `INSERT INTO users(email,password_hash,role,status) VALUES(?,?,'doctor','active')`,
      [email, hash]
    );
    await pool.query(`UPDATE doctors SET user_id=? WHERE id=?`, [u.insertId, req.params.id]);
    return res.status(201).json({ userId: u.insertId, email });
  } catch (e) {
    console.error(e);
    if (e?.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Email đã tồn tại" });
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

/*HOSPITALS CRUD*/
router.get("/hospitals", async (req, res) => {
  const { limit, offset } = paged(req);
  const { q } = req.query;
  const where = q ? "WHERE name LIKE ?" : "";
  const vals = q ? [`%${q}%`, limit, offset] : [limit, offset];
  try {
    // SELECT * đã bao gồm image_url, details
    const [rows] = await pool.query(
      `SELECT * FROM hospitals ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      vals
    );
    return res.json(rows);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

router.post("/hospitals", async (req, res) => {
  const { name, address, phone, image_url = null, details = null } = req.body || {};
  if (!name) return res.status(400).json({ message: "Thiếu tên cơ sở" });
  try {
    const [rs] = await pool.query(
      `INSERT INTO hospitals(name,address,phone,image_url,details) VALUES(?,?,?,?,?)`,
      [name, address, phone, image_url, details]
    );
    return res.status(201).json({ id: rs.insertId });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

router.patch("/hospitals/:id", async (req, res) => {
  // cập nhật linh hoạt, có gì cập nhật nấy
  const allow = ["name", "address", "phone", "image_url", "details"];
  const sets = [];
  const vals = [];
  try {
    for (const k of allow) {
      if (k in req.body) {
        sets.push(`${k}=?`);
        vals.push(req.body[k]);
      }
    }
    if (!sets.length) return res.json({ ok: true });
    vals.push(req.params.id);
    await pool.query(
      `UPDATE hospitals SET ${sets.join(",")}, updated_at=NOW() WHERE id=?`,
      vals
    );
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

router.delete("/hospitals/:id", async (req, res) => {
  try {
    const [x] = await pool.query(`SELECT COUNT(*) c FROM doctors WHERE hospital_id=?`, [req.params.id]);
    if (x[0].c) return res.status(409).json({ message: "Hospital còn bác sĩ trực thuộc" });
    await pool.query(`DELETE FROM hospitals WHERE id=?`, [req.params.id]);
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ message: "Lỗi máy chủ" }); }
});

// Chi tiết 1 hospital kèm photos + specialties
router.get("/hospitals/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const [[hosp]] = await pool.query(`SELECT * FROM hospitals WHERE id=?`, [id]);
    if (!hosp) return res.status(404).json({ message: "Không tìm thấy" });

    const [photos] = await pool.query(
      `SELECT id, image_url, caption, sort_order
       FROM hospital_photos
       WHERE hospital_id=?
       ORDER BY sort_order, id`, [id]
    );
    const [specs] = await pool.query(
      `SELECT s.id, s.name
       FROM specialties s
       JOIN hospital_specialties hs ON hs.specialty_id=s.id
       WHERE hs.hospital_id=? ORDER BY s.name`, [id]
    );
    return res.json({ ...hosp, photos, specialties: specs });
  } catch (e) { console.error(e); return res.status(500).json({ message: "Lỗi máy chủ" }); }
});


// ẢNH PHỤ BV
router.get("/hospitals/:id/photos", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, image_url, caption, sort_order
       FROM hospital_photos
       WHERE hospital_id=?
       ORDER BY sort_order, id`, [req.params.id]
    );
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ message: "Lỗi máy chủ" }); }
});

router.post("/hospitals/:id/photos", async (req, res) => {
  const { image_url, caption = null, sort_order = 0 } = req.body || {};
  if (!image_url) return res.status(400).json({ message: "Thiếu image_url" });
  try {
    const [rs] = await pool.query(
      `INSERT INTO hospital_photos(hospital_id,image_url,caption,sort_order)
       VALUES(?,?,?,?)`,
      [req.params.id, image_url, caption, sort_order]
    );
    res.status(201).json({ id: rs.insertId });
  } catch (e) { console.error(e); res.status(500).json({ message: "Lỗi máy chủ" }); }
});

router.patch("/hospitals/:id/photos/:photoId", async (req, res) => {
  const sets = [], vals = [];
  for (const k of ["image_url", "caption", "sort_order"]) {
    if (k in req.body) { sets.push(`${k}=?`); vals.push(req.body[k]); }
  }
  if (!sets.length) return res.json({ ok: true });
  try {
    vals.push(req.params.id, req.params.photoId);
    await pool.query(
      `UPDATE hospital_photos
       SET ${sets.join(", ")}, created_at=created_at
       WHERE hospital_id=? AND id=?`, vals);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ message: "Lỗi máy chủ" }); }
});

router.delete("/hospitals/:id/photos/:photoId", async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM hospital_photos WHERE hospital_id=? AND id=?`,
      [req.params.id, req.params.photoId]
    );
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ message: "Lỗi máy chủ" }); }
});

// CHUYÊN KHOA ↔ CƠ SỞ
router.get("/hospitals/:id/specialties", async (req, res) => {
  try {
    const [all] = await pool.query(`SELECT id, name FROM specialties ORDER BY name`);
    const [linked] = await pool.query(
      `SELECT specialty_id FROM hospital_specialties WHERE hospital_id=?`,
      [req.params.id]
    );
    const linkedSet = new Set(linked.map(x => x.specialty_id));
    res.json({
      all,
      selectedIds: all.filter(x => linkedSet.has(x.id)).map(x => x.id)
    });
  } catch (e) { console.error(e); res.status(500).json({ message: "Lỗi máy chủ" }); }
});

//nhận mảng specialtyIds, đồng bộ
router.post("/hospitals/:id/specialties", async (req, res) => {
  const { specialtyIds = [] } = req.body || {};
  if (!Array.isArray(specialtyIds)) return res.status(400).json({ message: "specialtyIds phải là array" });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`DELETE FROM hospital_specialties WHERE hospital_id=?`, [req.params.id]);
    if (specialtyIds.length) {
      const values = specialtyIds.map(spId => [req.params.id, spId]);
      await conn.query(
        `INSERT INTO hospital_specialties(hospital_id, specialty_id) VALUES ?`,
        [values]
      );
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ message: "Lỗi máy chủ" });
  } finally { conn.release(); }
});

/*SERVICES + DOCTOR_SERVICES*/
router.get("/services", async (req, res) => {
  const { limit, offset } = paged(req);
  const { q } = req.query;
  const where = q ? "WHERE name LIKE ?" : "";
  const vals = q ? [`%${q}%`, limit, offset] : [limit, offset];
  try {
    const [rows] = await pool.query(`SELECT * FROM services ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, vals);
    return res.json(rows);
  } catch (e) { console.error(e); return res.status(500).json({ message: "Lỗi máy chủ" }); }
});


router.post("/services", async (req, res) => {
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ message: "Thiếu tên dịch vụ" });
  try {
    const [rs] = await pool.query(`INSERT INTO services(name,description) VALUES(?,?)`, [name, description]);
    return res.status(201).json({ id: rs.insertId });
  } catch (e) { console.error(e); return res.status(500).json({ message: "Lỗi máy chủ" }); }
});


router.patch("/services/:id", async (req, res) => {
  const { name, description } = req.body || {};
  try {
    await pool.query(`UPDATE services SET name=?, description=?, updated_at=NOW() WHERE id=?`,
      [name, description, req.params.id]);
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ message: "Lỗi máy chủ" }); }
});


router.delete("/services/:id", async (req, res) => {
  try {
    await pool.query(`DELETE FROM services WHERE id=?`, [req.params.id]);
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ message: "Lỗi máy chủ" }); }
});


router.get("/doctor-services", async (req, res) => {
  const { hospitalId, doctorId } = req.query;
  const where = [];
  const vals = [];
  if (doctorId) { where.push("ds.doctor_id=?"); vals.push(doctorId); }
  if (hospitalId) { where.push("d.hospital_id=?"); vals.push(hospitalId); }
  try {
    const [rows] = await pool.query(
      `
      SELECT ds.doctor_id, d.full_name AS doctor_name, d.hospital_id,
             ds.service_id, s.name AS service_name, ds.price
      FROM doctor_services ds
      JOIN doctors d  ON d.id=ds.doctor_id
      JOIN services s ON s.id=ds.service_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY d.full_name, s.name
      `,
      vals
    );
    return res.json(rows);
  } catch (e) { console.error(e); return res.status(500).json({ message: "Lỗi máy chủ" }); }
});

router.post("/doctor-services", async (req, res) => {
  const { doctor_id, service_id, price } = req.body || {};
  if (!doctor_id || !service_id) return res.status(400).json({ message: "Thiếu dữ liệu" });
  try {
    await pool.query(
      `
      INSERT INTO doctor_services(doctor_id,service_id,price)
      VALUES(?,?,?)
      ON DUPLICATE KEY UPDATE price=VALUES(price)
      `,
      [doctor_id, service_id, price]
    );
    return res.status(201).json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ message: "Lỗi máy chủ" }); }
});

router.delete("/doctor-services", async (req, res) => {
  const { doctor_id, service_id } = req.body || {};
  if (!doctor_id || !service_id) return res.status(400).json({ message: "Thiếu dữ liệu" });
  try {
    await pool.query(`DELETE FROM doctor_services WHERE doctor_id=? AND service_id=?`, [doctor_id, service_id]);
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ message: "Lỗi máy chủ" }); }
});

/*SPECIALTIES CRUD (lọc theo hospital tùy chọn + icon_path)*/
function toSlug(s = "") {
  return String(s)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 190);
}

// List + filter by q, paginate
router.get("/specialties", async (req, res) => {
  const { limit, offset } = paged(req, 20);
  const q = (req.query.q || "").trim();
  const where = [];
  const vals = [];
  if (q) { where.push("name LIKE ?"); vals.push(`%${q}%`); }
  try {
    const [rows] = await pool.query(
      `SELECT id, name, slug, description, icon_path, icon_updated_at
       FROM specialties
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...vals, limit, offset]
    );
    res.json(rows);
  } catch (e) {
    console.error(e); res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

// Create
router.post("/specialties", async (req, res) => {
  const { name, description, icon_path } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ message: "Thiếu tên chuyên khoa" });
  const slug = toSlug(name);
  try {
    const [rs] = await pool.query(
      `INSERT INTO specialties (name, slug, description, icon_path, icon_updated_at)
       VALUES (?,?,?,?, ${icon_path ? "NOW()" : "NULL"})`,
      [name.trim(), slug, description || null, icon_path || null]
    );
    res.status(201).json({ id: rs.insertId });
  } catch (e) {
    // duplicate name/slug → 409
    if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Tên/slug đã tồn tại" });
    console.error(e); res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

// Detail
router.get("/specialties/:id", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, slug, description, icon_path, icon_updated_at
       FROM specialties WHERE id=?`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Không tìm thấy" });
    res.json(rows[0]);
  } catch (e) {
    console.error(e); res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

// Update
router.patch("/specialties/:id", async (req, res) => {
  const allow = ["name", "description", "icon_path"];
  const sets = [];
  const vals = [];
  if ("name" in req.body) { sets.push("name=?"); vals.push(req.body.name); sets.push("slug=?"); vals.push(toSlug(req.body.name)); }
  if ("description" in req.body) { sets.push("description=?"); vals.push(req.body.description || null); }
  if ("icon_path" in req.body) { sets.push("icon_path=?"); vals.push(req.body.icon_path || null); sets.push("icon_updated_at=NOW()"); }
  if (!sets.length) return res.json({ ok: true });
  try {
    await pool.query(`UPDATE specialties SET ${sets.join(", ")} WHERE id=?`, [...vals, req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Tên/slug đã tồn tại" });
    console.error(e); res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

// Delete (chặn nếu đang được bác sĩ tham chiếu)
router.delete("/specialties/:id", async (req, res) => {
  try {
    const [ref] = await pool.query("SELECT 1 FROM doctors WHERE specialty_id=? LIMIT 1", [req.params.id]);
    if (ref.length) return res.status(409).json({ message: "Đang được sử dụng bởi bác sĩ" });
    await pool.query("DELETE FROM specialties WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e); res.status(500).json({ message: "Lỗi máy chủ" });
  }
});


/*APPOINTMENTS – liệt kê, đổi trạng thái, đổi lịch*/
router.get("/appointments", async (req, res) => {
  const { limit, offset } = paged(req);
  const { status, hospitalId, doctorId, from, to, q } = req.query;
  const where = [];
  const vals = [];
  if (status) { where.push("a.status=?"); vals.push(status); }
  if (doctorId) { where.push("a.doctor_id=?"); vals.push(doctorId); }
  if (hospitalId) { where.push("d.hospital_id=?"); vals.push(hospitalId); }
  if (from) { where.push("s.start_time>=?"); vals.push(from); }
  if (to) { where.push("s.start_time<?"); vals.push(to); }
  if (q) { where.push("p.full_name LIKE ?"); vals.push(`%${q}%`); }
  try {
    const [rows] = await pool.query(
      `
      SELECT a.id, a.status, a.payment_status, a.created_at,
             s.start_time, s.end_time,
             d.full_name AS doctor_name, h.name AS hospital_name,
             p.full_name AS patient_name
      FROM appointments a
      JOIN schedules  s ON s.id=a.schedule_id
      JOIN doctors    d ON d.id=a.doctor_id
      JOIN hospitals  h ON h.id=d.hospital_id
      JOIN patients   p ON p.id=a.patient_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY s.start_time DESC
      LIMIT ? OFFSET ?
      `,
      [...vals, limit, offset]
    );
    return res.json(rows);
  } catch (e) { console.error(e); return res.status(500).json({ message: "Lỗi máy chủ" }); }
});

router.patch("/appointments/:id/status", async (req, res) => {
  const { status } = req.body || {};
  const allow = new Set(["pending", "confirmed", "completed", "cancelled", "no_show"]);
  if (!allow.has(status)) return res.status(400).json({ message: "Trạng thái không hợp lệ" });
  try {
    await pool.query(`UPDATE appointments SET status=?, updated_at=NOW() WHERE id=?`, [status, req.params.id]);
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ message: "Lỗi máy chủ" }); }
});

router.post("/appointments/:id/reschedule", async (req, res) => {
  const { schedule_id } = req.body || {};
  if (!schedule_id) return res.status(400).json({ message: "Thiếu schedule_id" });
  try {
    await pool.query(`UPDATE appointments SET schedule_id=?, updated_at=NOW() WHERE id=?`, [schedule_id, req.params.id]);
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    // conflict do slot full/unique
    if (e?.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Slot đã đầy hoặc trùng" });
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});



export default router;  
