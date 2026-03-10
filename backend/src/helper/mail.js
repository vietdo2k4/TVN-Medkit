import nodemailer from "nodemailer";

const {
    SMTP_HOST = "smtp.gmail.com",
    SMTP_PORT = "587",
    SMTP_USER,
    SMTP_PASS,
    MAIL_FROM = `"TVN Medkit" <no-reply@tvn-medkit.local>`,
} = process.env;

// Singleton transporter có POOL
let transporter = null;
export function getMailer() {
    if (transporter) return transporter;
    transporter = nodemailer.createTransport({
        pool: true,                              // bật connection pool
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465,
        auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,

        // tinh chỉnh an toàn cho Gmail/Workspace
        maxConnections: 5,                       // 5 cho Gmail/Workspace
        maxMessages: 100,                        // tái sử dụng connection
        rateDelta: 1000,                         // cửa sổ tính rate (ms)
        rateLimit: 10,                           // tối đa X mail / rateDelta
        connectionTimeout: 10000,
        socketTimeout: 10000,
    });
    return transporter;
}

// Đóng pool khi tắt app (graceful)
export function closeMailer() {
    if (!transporter) return;
    try { transporter.close(); } catch { }
    transporter = null;
}

// API sẵn dùng: giữ nguyên chữ ký
export async function sendMail(to, subject, html) {
    if (!to) return;
    try {
        await getMailer().sendMail({
            from: MAIL_FROM,
            to,
            subject: subject || "Thông báo từ TVN Medkit",
            html: html || "<p>Bạn có thông báo mới.</p>",
        });
    } catch (e) {
        // Không làm fail request chính
        console.warn("[mail] send fail:", e.message);
    }
}
