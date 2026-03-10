import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

/* --------------------------------------------------------- *
 * Gợi ý nhanh (dùng cho ô search) – giữ nguyên logic cũ
 * --------------------------------------------------------- */
router.get("/suggest", async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.json({ doctors: [], hospitals: [], specialties: [] });
  const kw = `%${q}%`;
  try {
    const [doctors] = await pool.query(
      `SELECT d.id, d.full_name, s.name AS specialty_name, h.name AS hospital_name,
              COALESCE(d.rating_avg,0) AS rating
       FROM doctors d
       LEFT JOIN specialties s ON s.id = d.specialty_id
       LEFT JOIN hospitals   h ON h.id = d.hospital_id
       WHERE d.full_name LIKE ? OR s.name LIKE ? OR h.name LIKE ?
       ORDER BY rating DESC, d.full_name ASC
       LIMIT 5`, [kw, kw, kw]
    );

    const [hospitals] = await pool.query(
      `SELECT id, name, address, phone
       FROM hospitals
       WHERE name LIKE ? OR address LIKE ?
       ORDER BY name ASC LIMIT 5`, [kw, kw]
    );

    const [specialties] = await pool.query(
      `SELECT id, name FROM specialties
       WHERE name LIKE ? ORDER BY name ASC LIMIT 5`, [kw]
    );

    res.json({ doctors, hospitals, specialties });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Search failed" });
  }
});

/* --------------------------------------------------------- *
 * Tìm kiếm BỆNH VIỆN (mới): /search/hospitals
 * Query:
 *  - q:        từ khóa (tên/địa chỉ)
 *  - region:   north | central | south
 *  - specialty:id (số) hoặc tên chuyên khoa
 *  - page, pageSize
 * --------------------------------------------------------- */

/** Gom một số tỉnh/thành theo vùng để lọc nhanh */
const REGION_MAP = {
  north: [
    "Hà Nội", "Hải Phòng", "Quảng Ninh", "Bắc Ninh", "Bắc Giang", "Ninh Bình", "Hải Dương",
    "Nam Định", "Thái Bình", "Vĩnh Phúc", "Phú Thọ", "Hà Nam", "Hòa Bình", "Sơn La", "Điện Biên",
    "Lào Cai", "Yên Bái", "Tuyên Quang", "Bắc Kạn", "Lạng Sơn", "Cao Bằng", "Thái Nguyên"
  ],
  central: [
    "Thanh Hóa", "Nghệ An", "Hà Tĩnh", "Quảng Bình", "Quảng Trị", "Huế",
    "Đà Nẵng", "Quảng Nam", "Quảng Ngãi", "Bình Định", "Phú Yên", "Khánh Hòa", "Ninh Thuận",
    "Bình Thuận", "Kon Tum", "Gia Lai", "Đắk Lắk", "Đắk Nông", "Lâm Đồng"
  ],
  south: [
    "TP.HCM", "Hồ Chí Minh", "Bình Dương", "Đồng Nai", "Tây Ninh", "Bà Rịa - Vũng Tàu",
    "Long An", "Tiền Giang", "Bến Tre", "Vĩnh Long", "Trà Vinh", "Cần Thơ", "An Giang",
    "Đồng Tháp", "Kiên Giang", "Hậu Giang", "Sóc Trăng", "Bạc Liêu", "Cà Mau", "Bình Phước"
  ],
};

router.get("/hospitals", async (req, res) => {
    try {
      const q = String(req.query.q || "").trim();
      const region = String(req.query.region || "").trim().toLowerCase(); // 'north'|'central'|'south'|''
      // chấp nhận cả specialty_id lẫn specialty để không vỡ FE
      const specialtyRaw = (req.query.specialty_id ?? req.query.specialty ?? "").toString().trim();

      const page = Math.max(1, parseInt(req.query.page || "1", 10));
      const pageSize = Math.max(1, Math.min(50, parseInt(req.query.pageSize || "5", 10)));
      const offset = (page - 1) * pageSize;

      const where = [];
      const params = [];

      // Từ khóa theo tên/địa chỉ
      if (q) {
        where.push("(h.name LIKE ? OR h.address LIKE ?)");
        params.push(`%${q}%`, `%${q}%`);
      }

      // Lọc theo vùng — bỏ h.city, chỉ match theo address hoặc name
      if (region && REGION_MAP[region]) {
        const names = REGION_MAP[region];
        const regionClauses = names.map(() => "(h.address LIKE ? OR h.name LIKE ?)");
        where.push(`(${regionClauses.join(" OR ")})`);
        names.forEach((n) => params.push(`%${n}%`, `%${n}%`));
      }

      // Lọc theo chuyên khoa (qua bảng hospital_specialties)
      let joinSpecialty = "";
      if (specialtyRaw) {
        joinSpecialty =
          " INNER JOIN hospital_specialties hs ON hs.hospital_id = h.id " +
          " INNER JOIN specialties s ON s.id = hs.specialty_id ";
        if (/^\d+$/.test(specialtyRaw)) {
          where.push("s.id = ?");
          params.push(Number(specialtyRaw));
        } else {
          where.push("s.name LIKE ?");
          params.push(`%${specialtyRaw}%`);
        }
      }

      const whereSql = where.length ? " WHERE " + where.join(" AND ") : "";

      // Đếm tổng
      const [countRows] = await pool.query(
        `SELECT COUNT(DISTINCT h.id) AS total
         FROM hospitals h
         ${joinSpecialty}
         ${whereSql}`,
        params
      );
      const total = Number(countRows?.[0]?.total || 0);

      // Lấy danh sách — BỎ h.city khỏi SELECT
      const [rows] = await pool.query(
        `SELECT DISTINCT h.id, h.name, h.address, h.image_url
         FROM hospitals h
         ${joinSpecialty}
         ${whereSql}
         ORDER BY h.name ASC
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset] 
      );

      res.json({ items: rows, total, page, pageSize });
    } catch (e) {
      console.error("search/hospitals error:", e);
      res.status(500).json({ message: "Server error" });
    }
  });

  /* --------------------------------------------------------- *
   * Peek nhanh 1 bệnh viện (panel bên phải trang danh sách)
   * --------------------------------------------------------- */
  router.get("/hospitals/:id/peek", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid id" });

      const [[h]] = await pool.query(
        `SELECT id, name, address, phone, image_url, details
       FROM hospitals WHERE id = ?`, [id]
      );
      if (!h) return res.status(404).json({ message: "Not found" });

      const [photos] = await pool.query(
        `SELECT image_url, caption
       FROM hospital_photos
       WHERE hospital_id = ?
       ORDER BY sort_order, id
       LIMIT 8`, [id]
      );

      res.json({ ...h, photos });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Peek hospital failed" });
    }
  });

  export default router;
