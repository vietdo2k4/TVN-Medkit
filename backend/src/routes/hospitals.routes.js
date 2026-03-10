import express from "express";
import { pool } from "../db.js";

const router = express.Router();

const toInt = (v, d = 0) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : d;
};

/**
 * GET /api/hospitals/featured?limit=4|8|12
 * dùng cho carousel cơ sở yêu thích
 */
router.get("/featured", async (req, res) => {
    try {
        const limit = Math.min(Math.max(toInt(req.query.limit, 8), 1), 24);

        const sql = `
                    SELECT
                        h.id,
                        h.name,
                        h.address,
                        h.phone,
                        h.image_url,
                        COALESCE(ROUND(AVG(d.rating_avg),1), 4.0) AS rating_avg,
                        COUNT(d.id)                              AS doctors_count
                    FROM hospitals h
                    LEFT JOIN doctors d ON d.hospital_id = h.id
                    GROUP BY h.id
                    ORDER BY doctors_count DESC,
                            (rating_avg IS NULL),
                            rating_avg DESC,
                            h.id DESC
                    LIMIT ?`;
        const [rows] = await pool.query(sql, [limit]);
        res.json(rows);
    } catch (err) {
        console.error("GET /hospitals/featured:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// GET /hospitals/options  -> {id,name,city}
router.get("/options", async (_req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, name,
              TRIM(SUBSTRING_INDEX(address, ',', -1)) AS city
       FROM hospitals
       ORDER BY name ASC`
        );
        res.json(rows);
    } catch (e) {
        console.error("GET /hospitals/options", e);
        res.status(500).json({ message: "Server error" });
    }
});


/**
 * GET /api/hospitals/:id
 * chi tiết bệnh viện + thống kê + ảnh phụ + bác sĩ
 */
router.get("/:id", async (req, res) => {
    try {
        const id = toInt(req.params.id, 0);
        if (!id) return res.status(400).json({ message: "Invalid id" });

        // thông tin cơ bản
        const [[hosp]] = await pool.query(
            `SELECT id, name, address, phone, image_url, details
                FROM hospitals
                WHERE id = ?
                LIMIT 1`,
            [id]
        );
        if (!hosp) return res.status(404).json({ message: "Not found" });

        // thống kê tổng hợp từ bảng doctors
        const [[agg]] = await pool.query(
            `SELECT
                COALESCE(ROUND(AVG(d.rating_avg),1), 0) AS rating_avg,
                SUM(d.rating_count)                   AS rating_count,
                COUNT(d.id)                           AS doctors_count
            FROM doctors d
            WHERE d.hospital_id = ?`,
            [id]
        );

        // chuyên khoa của bệnh viện (kèm icon_path để FE dùng bộ icon có sẵn)
        const [specialties] = await pool.query(
        `   SELECT 
                sp.id, sp.name, sp.slug, sp.icon_path,
                COUNT(d.id) AS doctors_count
            FROM hospital_specialties hs
            JOIN specialties sp 
                    ON sp.id = hs.specialty_id
            LEFT JOIN doctors d 
                    ON d.hospital_id = hs.hospital_id
                AND d.specialty_id = sp.id
            WHERE hs.hospital_id = ?
            GROUP BY sp.id
            ORDER BY sp.name`,
            [id]
        );


        const [topDoctors] = await pool.query(
            `SELECT
         d.id, d.full_name, d.avatar,
         sp.name AS specialty_name,
         h.name  AS hospital_name,
         d.fee_min, d.rating_avg, d.rating_count
       FROM doctors d
       LEFT JOIN specialties sp ON sp.id = d.specialty_id
       JOIN hospitals   h  ON h.id = d.hospital_id
       WHERE d.hospital_id = ?
       ORDER BY d.rating_count DESC, d.rating_avg DESC, d.id DESC
       LIMIT 8`,
            [id]
        );

        // ảnh phụ
        const [photos] = await pool.query(
            `SELECT id, image_url, caption
       FROM hospital_photos
       WHERE hospital_id = ?
       ORDER BY sort_order ASC, id ASC
       LIMIT 20`,
            [id]
        );

        // trả về: thông tin + thống kê + ảnh + chuyên khoa + bác sĩ
        res.json({
            ...hosp,
            ...agg,
            photos,
            specialties,
            top_doctors: topDoctors
        });
    } catch (err) {
        console.error("GET /hospitals/:id", err);
        res.status(500).json({ message: "Server error" });
    }
});

// * GET /api/hospitals/:id/doctors?specialty_id=XX
//  * Trả về danh sách bác sĩ của một bệnh viện theo chuyên khoa
router.get("/:id/doctors", async (req, res) => {
    try {
        const hospitalId = toInt(req.params.id, 0);
        const specId = toInt(req.query.specialty_id, 0);
        if (!hospitalId || !specId) {
            return res.status(400).json({ message: "Không có bác sĩ nào" });
        }

        const sql = `
      SELECT
        d.id,
        d.full_name,
        d.avatar,
        sp.name AS specialty_name,
        h.name  AS hospital_name,
        d.fee_min,
        d.rating_avg,
        d.rating_count
      FROM doctors d
      JOIN hospitals   h  ON h.id = d.hospital_id
      JOIN specialties sp ON sp.id = d.specialty_id
      WHERE d.hospital_id = ? AND d.specialty_id = ?
      ORDER BY d.rating_count DESC, d.rating_avg DESC, d.id DESC
      LIMIT 100
    `;
        const [rows] = await pool.query(sql, [hospitalId, specId]);
        res.json(rows);
    } catch (err) {
        console.error("GET /hospitals/:id/doctors", err);
        res.status(500).json({ message: "Server error" });
    }
});


/**
 * (optional) GET /api/hospitals?q=
 * dùng cho các trang khác nếu cần
 */
router.get("/", async (req, res) => {
    const q = String(req.query.q || "").trim();
    const like = `%${q}%`;
    const sql = q
        ? "SELECT id, name, address, phone, image_url FROM hospitals WHERE name LIKE ? OR address LIKE ? ORDER BY name LIMIT 50"
        : "SELECT id, name, address, phone, image_url FROM hospitals ORDER BY name LIMIT 50";
    try {
        const [rows] = await pool.query(sql, q ? [like, like] : []);
        res.json(rows);
    } catch (err) {
        console.error("GET /hospitals", err);
        res.status(500).json({ message: "Server error" });
    }
});



export default router;
