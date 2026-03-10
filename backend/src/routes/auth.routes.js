import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";

const router = Router();

const makeToken = (u) =>
    jwt.sign({ sub: u.id, role: u.role }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES || "7d",
    });
const toUserPayload = (r) => ({ id: r.id, role: r.role, email: r.email });

// Sinh OTP 6 số
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

//Hiệu lực OTP: 5 phút
function otpExpiry() {
    return new Date(Date.now() + 5 * 60 * 1000);
}
//Đăng ký
router.post("/register", async (req, res) => {
    const { full_name, email, password } = req.body || {};
    if (!full_name || !email || !password)
        return res.status(400).json({ message: "Thiếu dữ liệu" });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [dup] = await conn.query("SELECT id FROM users WHERE email=? LIMIT 1", [email]);
        if (dup.length) {
            await conn.rollback();
            return res.status(409).json({ message: "Email đã tồn tại" });
        }

        const hash = await bcrypt.hash(password, 10);

        const [uRes] = await conn.query(
            "INSERT INTO users(email,password_hash,role,status) VALUES(?,?,'patient','pending')",
            [email, hash]
        );

        const userId = uRes.insertId;

        await conn.query(
            "INSERT INTO patients(user_id,full_name) VALUES(?,?)",
            [userId, full_name]
        );

        // ===== OTP =====
        const otp = generateOTP();
        const expiresAt = otpExpiry();

        await conn.query(
            "INSERT INTO email_otps(user_id,email,otp_code,expires_at) VALUES(?,?,?,?)",
            [userId, email, otp, expiresAt]
        );

        await conn.commit();


        return res.json({
            code: "OTP_SENT",
            message: "Vui lòng kiểm tra email để xác nhận"
        })
    } catch (e) {
        await conn.rollback();
        console.error(e);
        return res.status(500).json({ message: "Lỗi máy chủ" });
    } finally {
        conn.release();
    }
});

//Đăng nhập
router.post("/login", async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password)
        return res.status(400).json({ message: "Thiếu dữ liệu" });

    try {
        const [rows] = await pool.query(
            "SELECT id,email,password_hash,role,status FROM users WHERE email=? LIMIT 1",
            [email]
        );
        if (!rows.length)
            return res.status(401).json({ message: "Email hoặc mật khẩu sai" });

        const user = rows[0];
        if (user.status === "pending")
            return res.status(403).json({ message: "Email chưa được xác thực" });

        if (user.status === "blocked")
            return res.status(423).json({ message: "Tài khoản bị khoá" });

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return res.status(401).json({ message: "Email hoặc mật khẩu sai" });

        const token = makeToken(user);
        return res.json({ token, user: toUserPayload(user) });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: "Lỗi máy chủ" });
    }
});

router.post("/verify-email", async (req, res) => {
    const { email, otp } = req.body || {};
    if (!email || !otp)
        return res.status(400).json({ message: "Thiếu dữ liệu" });

    try {
        const [rows] = await pool.query(
            `SELECT * FROM email_otps
             WHERE email=? AND otp_code=? AND is_used=0
               AND expires_at > NOW()
             ORDER BY id DESC
             LIMIT 1`,
            [email, otp]
        );

        if (!rows.length)
            return res.status(400).json({ message: "OTP không hợp lệ hoặc đã hết hạn" });

        const row = rows[0];

        await pool.query("UPDATE email_otps SET is_used=1 WHERE id=?", [row.id]);
        await pool.query("UPDATE users SET status='active' WHERE id=?", [row.user_id]);

        return res.json({ success: true });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: "Lỗi máy chủ" });
    }
});

router.post("/resend-otp", async (req, res) => {
    const { email } = req.body || {};
    if (!email)
        return res.status(400).json({ message: "Thiếu email" });

    try {
        const [[user]] = await pool.query(
            "SELECT id,status FROM users WHERE email=? LIMIT 1",
            [email]
        );

        if (!user || user.status !== "pending")
            return res.status(400).json({ message: "Không thể gửi lại OTP" });

        const otp = generateOTP();
        const expiresAt = otpExpiry();

        await pool.query(
            "INSERT INTO email_otps(user_id,email,otp_code,expires_at) VALUES(?,?,?,?)",
            [user.id, email, otp, expiresAt]
        );

        // TODO: sendMail(email, otp)
        console.log("RESEND OTP:", otp);

        return res.json({ success: true });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: "Lỗi máy chủ" });
    }
});

export default router;
