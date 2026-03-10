import { pool } from "../db.js";

export async function searchDoctors({ q = "", specialty, hospital, limit = 5 }) {
    const sql = `
    SELECT d.id, d.full_name, s.name AS specialty, h.name AS hospital,
           d.fee_min, d.fee_max, d.rating_avg
    FROM doctors d
    LEFT JOIN specialties s ON s.id=d.specialty_id
    LEFT JOIN hospitals   h ON h.id=d.hospital_id
    WHERE (?='' OR d.full_name LIKE CONCAT('%',?,'%'))
      AND (?='' OR s.name      LIKE CONCAT('%',?,'%'))
      AND (?='' OR h.name      LIKE CONCAT('%',?,'%'))
    ORDER BY (d.rating_avg IS NULL), d.rating_avg DESC, d.id DESC
    LIMIT ?`;
    const [rows] = await pool.execute(sql, [
        q, q, specialty || "", specialty || "", hospital || "", hospital || "", Number(limit) || 5,
    ]);
    return rows;
}

export async function getDoctorByName({ name }) {
    const [rows] = await pool.execute(
        `SELECT d.*, s.name AS specialty, h.name AS hospital
     FROM doctors d
     LEFT JOIN specialties s ON s.id=d.specialty_id
     LEFT JOIN hospitals   h ON h.id=d.hospital_id
     WHERE d.full_name LIKE CONCAT('%',?,'%')
     ORDER BY (d.rating_avg IS NULL), d.rating_avg DESC, d.id DESC
     LIMIT 5`, [name]
    );
    return rows;
}


const SYMPTOM_MAP = [
    { kw: ["đau ngực", "hồi hộp", "khó thở"], spec: "Tim mạch" },
    { kw: ["ho kéo dài", "hen", "copd", "khó thở"], spec: "Hô hấp" },
    { kw: ["đau bụng", "ợ nóng", "tiêu chảy", "gan mật"], spec: "Tiêu hoá" },
    { kw: ["đau khớp", "thoái hoá", "gối", "lưng"], spec: "Cơ xương khớp" },
    { kw: ["đái tháo đường", "tiểu nhiều", "khát"], spec: "Nội tiết" },
];

export async function suggestCare({ symptoms, specialty }) {
    let spec = specialty || null;
    if (!spec) {
        const txt = (symptoms || "").toLowerCase();
        const hit = SYMPTOM_MAP.find((x) => x.kw.some((k) => txt.includes(k)));
        spec = hit?.spec || "Nội tổng quát";
    }
    const [rows] = await pool.execute(
        `SELECT d.id, d.full_name, h.name AS hospital, s.name AS specialty,
            d.rating_avg, d.fee_min, d.fee_max
     FROM doctors d
     JOIN specialties s ON s.id=d.specialty_id
     LEFT JOIN hospitals h ON h.id=d.hospital_id
     WHERE s.name = ?
     ORDER BY (d.rating_avg IS NULL), d.rating_avg DESC, d.id DESC
     LIMIT 5`, [spec]
    );
    return { specialty: spec, doctors: rows };
}


export function cleanDoctorName(name = "") {
    return String(name)
        .replace(/\b(GS|PGS|TS|ThS|BS|BSCKI?I?)\.?\s*/gi, "")
        .replace(/\s+/g, " ")
        .trim();
}
export async function findDoctorByName(raw) {
    const q = cleanDoctorName(raw);
    if (!q) return null;
    const like = `%${q}%`;
    const [rows] = await pool.query(
        `SELECT d.id, d.full_name, s.name AS specialty, h.name AS hospital
     FROM doctors d
     LEFT JOIN specialties s ON s.id=d.specialty_id
     LEFT JOIN hospitals   h ON h.id=d.hospital_id
     WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(d.full_name,
           'GS.', ''),'PGS.', ''),'TS.', ''),'ThS.', ''),'BS.', '') LIKE ?
     ORDER BY d.rating_count DESC, d.rating_avg DESC, d.id DESC
     LIMIT 1`, [like]
    );
    return rows[0] || null;
}

export async function getAvailableDays(doctorId) {
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
     ) ap ON ap.schedule_id=s.id
     LEFT JOIN (
       SELECT schedule_id, COUNT(*) hold_active
       FROM slot_holds
       WHERE expires_at > NOW()
       GROUP BY schedule_id
     ) sh ON sh.schedule_id=s.id
     WHERE s.doctor_id=? AND s.start_time>=CURDATE()
       AND s.start_time<DATE_ADD(CURDATE(), INTERVAL 60 DAY)
     GROUP BY DATE(s.start_time)
     HAVING used < total_capacity
     ORDER BY day`, [doctorId]
    );
    return rows.map(r => r.day);
}

export async function getDoctorDetails(doctorId) {
    const [[row]] = await pool.query(
        `SELECT d.full_name, d.experience_years, d.bio,
                d.fee_min, d.fee_max,
                h.name AS hospital
         FROM doctors d
         LEFT JOIN hospitals h ON h.id = d.hospital_id
         WHERE d.id = ?
         LIMIT 1`,
        [doctorId]
    );
    return row || null;
}

export async function getSlotsByDate(doctorId, dateISO) {
    const [rows] = await pool.query(
        `WITH ap AS (
       SELECT schedule_id, COUNT(*) ap_cnt
       FROM appointments
       WHERE status IN ('pending','confirmed')
       GROUP BY schedule_id
     ),
     hd AS (
       SELECT schedule_id,
              SUM(CASE WHEN expires_at>NOW() THEN 1 ELSE 0 END) hold_cnt
       FROM slot_holds
       GROUP BY schedule_id
     )
     SELECT s.id AS scheduleId,
            TIME_FORMAT(s.start_time,'%H:%i') AS time,
            IF(HOUR(s.start_time)<12,'morning','afternoon') AS session,
            s.capacity,
            IFNULL(ap.ap_cnt,0) AS ap_cnt,
            IFNULL(hd.hold_cnt,0) AS hold_cnt
     FROM schedules s
     LEFT JOIN ap ON ap.schedule_id=s.id
     LEFT JOIN hd ON hd.schedule_id=s.id
     WHERE s.doctor_id=? AND DATE(s.start_time)=?
       AND (? <> CURDATE() OR s.start_time >= NOW())
       AND IFNULL(ap.ap_cnt,0) < s.capacity
     ORDER BY s.start_time`,
        [doctorId, dateISO, dateISO]
    );
    return rows.map(r => ({ scheduleId: r.scheduleId, time: r.time, session: r.session }));
}

/*Bệnh viện: gợi ý theo miền/tỉnh/thành phố*/
function normVN(s = "") {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();
}
function hasKeyword(hay = "", needles = []) {
    const H = normVN(hay);
    return needles.some(n => H.includes(normVN(n)));
}
const REGION_MAP = {
    bac: [
        "Hà Nội", "Hải Phòng", "Quảng Ninh", "Bắc Ninh", "Bắc Giang", "Hải Dương", "Hưng Yên", "Hà Nam", "Nam Định", "Ninh Bình", "Thái Bình",
        "Thái Nguyên", "Phú Thọ", "Vĩnh Phúc", "Tuyên Quang", "Hà Giang", "Cao Bằng", "Bắc Kạn", "Lạng Sơn", "Điện Biên", "Lai Châu", "Sơn La", "Hòa Bình", "Yên Bái", "Lào Cai"
    ],
    trung: [
        "Thanh Hóa", "Nghệ An", "Hà Tĩnh", "Quảng Bình", "Quảng Trị", "Thừa Thiên Huế",
        "Đà Nẵng", "Quảng Nam", "Quảng Ngãi", "Bình Định", "Phú Yên", "Khánh Hòa", "Ninh Thuận", "Bình Thuận",
        "Kon Tum", "Gia Lai", "Đắk Lắk", "Đắk Nông", "Lâm Đồng"
    ],
    nam: [
        "TP.HCM", "Hồ Chí Minh", "Sài Gòn", "Bình Dương", "Bình Phước", "Tây Ninh", "Bà Rịa - Vũng Tàu",
        "Long An", "Tiền Giang", "Bến Tre", "Trà Vinh", "Vĩnh Long", "Đồng Tháp", "An Giang", "Kiên Giang",
        "Cần Thơ", "Hậu Giang", "Sóc Trăng", "Bạc Liêu", "Cà Mau"
    ],
};

//lọc theo địa chỉ; region: bac|trung|nam; limit: số lượng trả về
export async function searchHospitals({ q = "", city = "", province = "", region = "", limit = 10 } = {}) {
    const q0 = String(q || "").trim();
    const loc = String(city || province || "").trim();

    // Nếu đã có region/city/province hoặc q chứa các từ mô tả vị trí → bỏ q để tránh siết WHERE
    const generic = /(mi[eê]n|khu vực|tại|ở)\b/i.test(q0);
    const qEff = (generic || region || loc) ? "" : q0;

    const likeQ = `%${qEff}%`;
    const likeC = `%${loc}%`;

    const [rows] = await pool.query(
        `SELECT h.id, h.name, h.address, h.phone, h.image_url,
            COALESCE(ROUND(AVG(d.rating_avg),1),0) AS rating_avg,
            COUNT(d.id) AS doctors_count
            FROM hospitals h
            LEFT JOIN doctors d ON d.hospital_id=h.id
            WHERE (?='' OR h.name LIKE ? OR h.address LIKE ?)
            AND (?='' OR h.address LIKE ?)
            GROUP BY h.id
            ORDER BY doctors_count DESC, rating_avg DESC, h.id DESC
            LIMIT 200`,
        [qEff, likeQ, likeQ, loc, likeC]
    );

    let list = rows;

    if (region) {
        const key = normVN(region).includes("trung") ? "trung"
            : normVN(region).includes("nam") ? "nam"
                : "bac";
        const needles = REGION_MAP[key] || [];
        list = rows.filter(h => hasKeyword(h.address + " " + h.name, needles));
    }

    return list.slice(0, Number(limit) || 10);
}

export async function getHospitalDetails(hospitalId) {
    const [[h]] = await pool.query(
        `SELECT id, name, address, phone, image_url, details
     FROM hospitals WHERE id=? LIMIT 1`, [hospitalId]
    );
    if (!h) return null;

    const [[agg]] = await pool.query(
        `SELECT COALESCE(ROUND(AVG(d.rating_avg),1),0) AS rating_avg,
            SUM(d.rating_count) AS rating_count,
            COUNT(d.id) AS doctors_count
     FROM doctors d WHERE d.hospital_id=?`, [hospitalId]
    );

    const [specialties] = await pool.query(
        `SELECT sp.id, sp.name, sp.slug, sp.icon_path, COUNT(d.id) AS doctors_count
     FROM doctors d
     JOIN specialties sp ON sp.id=d.specialty_id
     WHERE d.hospital_id=?
     GROUP BY sp.id
     ORDER BY sp.name`, [hospitalId]
    );

    return { ...h, ...agg, specialties };
}

export async function getHospitalDoctorsBySpec(hospitalId, spec) {
    const specId = /^\d+$/.test(String(spec || "")) ? Number(spec) : null;
    const [rows] = await pool.query(
        `SELECT d.id, d.full_name, d.avatar,
            sp.name AS specialty_name, h.name AS hospital_name,
            d.fee_min, d.rating_avg, d.rating_count
     FROM doctors d
     JOIN hospitals   h ON h.id=d.hospital_id
     JOIN specialties sp ON sp.id=d.specialty_id
     WHERE d.hospital_id=? AND ( (? IS NOT NULL AND sp.id=?) OR sp.name LIKE ? )
     ORDER BY d.rating_count DESC, d.rating_avg DESC, d.id DESC
     LIMIT 100`,
        [hospitalId, specId, specId, `%${String(spec || "").trim()}%`]
    );
    return rows;
}
