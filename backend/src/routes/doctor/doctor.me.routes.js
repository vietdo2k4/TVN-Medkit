import { Router } from "express";
import { pool } from "../../db.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import bcrypt from "bcryptjs";

const r = Router();

const T = (v) => (typeof v === "string" ? v.trim() : v);

// helper: chỉ giữ đường dẫn/URL an toàn như CSDL quy định
function sanitizeAvatarPath(x) {
    const s = T(x || "");
    if (!s) return null;
    // http(s)://...  hoặc /... hoặc ./...
    const ok = /^(https?:\/\/.+|\/\S*|\.\/\S*)$/.test(s);
    return ok ? s : null;
}

// GET /doctor/me  -> hồ sơ + options select
r.get("/me", requireAuth, requireRole("doctor"), async (req, res) => {
    const userId = req.user.id;

    // lấy hồ sơ bác sĩ theo user_id
    const [[doctor]] = await pool.query(
        `SELECT d.id, d.full_name, d.gender, d.phone, d.avatar, d.experience_years,
            d.bio, d.specialty_id, d.hospital_id, d.fee_min
     FROM doctors d
     WHERE d.user_id = ? LIMIT 1`, [userId]
    );

    const [specialties] = await pool.query(
        "SELECT id, name FROM specialties ORDER BY name"
    );
    const [hospitals] = await pool.query(
        "SELECT id, name FROM hospitals ORDER BY name"
    );

    res.json({ doctor, specialties, hospitals });
});

// PUT /doctor/me  -> cập nhật hồ sơ
r.put("/me", requireAuth, requireRole("doctor"), async (req, res) => {
    const userId = req.user.id;

    const body = req.body || {};
    const avatar = sanitizeAvatarPath(body.avatar || body.avatar_path);

    // giữ nguyên cột nào không gửi lên
    const [rows] = await pool.query(
        "SELECT id FROM doctors WHERE user_id = ? LIMIT 1", [userId]
    );
    if (!rows.length) return res.status(404).json({ message: "Không tìm thấy hồ sơ bác sĩ" });
    const docId = rows[0].id;

    const payload = {
        full_name: T(body.full_name),
        gender: T(body.gender) || null,
        phone: T(body.phone) || null,
        avatar,
        specialty_id: body.specialty_id || null,
        hospital_id: body.hospital_id || null,
        experience_years: body.experience_years ?? null,
        bio: T(body.bio) || null,
        fee_min: body.fee_min ?? null,
    };

    // cập nhật có kiểm tra ràng buộc CSDL (regex avatar đã do DB check)
    const sql = `
    UPDATE doctors SET
      full_name = COALESCE(?, full_name),
      gender = ?,
      phone = ?,
      avatar = ?,
      specialty_id = ?,
      hospital_id = ?,
      experience_years = ?,
      bio = ?,
      fee_min = ?
    WHERE id = ?`;
    await pool.query(sql, [
        payload.full_name, payload.gender, payload.phone, payload.avatar,
        payload.specialty_id, payload.hospital_id, payload.experience_years,
        payload.bio, payload.fee_min, docId
    ]);

    // trả về hồ sơ mới
    const [[doctor]] = await pool.query(
        `SELECT id, full_name, gender, phone, avatar, experience_years,
            bio, specialty_id, hospital_id, fee_min
     FROM doctors WHERE id=?`, [docId]
    );
    res.json({ ok: true, doctor });
});

//Thay đổi mật khẩu bác sĩ
r.patch("/me/password", requireAuth, requireRole("doctor"), async (req, res) => {
    try {
        const userId = req.user.id;
        const oldpw = String(req.body?.old_password || "");
        const newpw = String(req.body?.new_password || "");

        if (!oldpw || !newpw) return res.status(400).json({ message: "Thiếu mật khẩu." });
        if (newpw.length < 8) return res.status(400).json({ message: "Mật khẩu mới tối thiểu 8 ký tự." });

        const [[u]] = await pool.query("SELECT password_hash FROM users WHERE id=?", [userId]);
        if (!u) return res.status(404).json({ message: "Tài khoản không tồn tại." });

        const ok = await bcrypt.compare(oldpw, u.password_hash);
        if (!ok) return res.status(400).json({ message: "Mật khẩu hiện tại không đúng." });

        // Không cho dùng lại đúng mật khẩu cũ
        const same = await bcrypt.compare(newpw, u.password_hash);
        if (same) return res.status(400).json({ message: "Mật khẩu mới phải khác mật khẩu hiện tại." });

        const hash = await bcrypt.hash(newpw, 10);
        await pool.query("UPDATE users SET password_hash=? WHERE id=?", [hash, userId]);

        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ message: e.message || "Lỗi máy chủ" });
    }
});

export default r;
