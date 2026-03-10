import { Router } from "express";
import crypto from "crypto";
import { classifyIntentByLLM } from "../../helper/hybrid-intent.js";
import {
    getDoctorByName, getDoctorDetails, getAvailableDays, getSlotsByDate,
    searchHospitals, getHospitalDoctorsBySpec, getHospitalDetails, suggestCare
} from "../../helper/tool-executors.js";
import { explainSymptomsByLLM, explainMedicalConceptByLLM } from "../../helper/medical-explain.js";
import { pool } from "../../db.js";

const router = Router();

// Tạo session id ngẫu nhiên
const ulid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 26);
function buildGreeting(userName = "") {
    const name = userName ? `${userName}` : "bạn";

    const text = `
        Chào ${name},

        Tôi là Medu -TRỢ LÝ AI Y TẾ của TVN Medkit.

        Tôi có thể hỗ trợ bạn:
        - Tìm kiếm BỆNH VIỆN, BÁC SĨ, CHUYÊN KHOA
        - Xem LỊCH KHÁM BÁC SĨ còn trống
        - Hỏi đáp TRIỆU CHỨNG và gợi ý CHUYÊN KHOA phù hợp
        - Xem THÔNG TIN CHI TIẾT về bác sĩ và bệnh viện

        Lưu ý:
        Tôi chỉ hỗ trợ các vấn đề y tế trong hệ thống TVN Medkit.
        Các nội dung ngoài phạm vi sẽ không được trả lời.

        Ví dụ bạn có thể hỏi:
        - Bác sĩ tim mạch tại BV Chợ Rẫy
        - Triệu chứng đau ngực nên khám khoa nào
        `;

    return normalizeChatText(text);
}

// Header chuẩn cho Server-Sent Events (SSE)
const sseHeaders = (res) => {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
};

// Hàm gửi dữ liệu SSE (delta / done / open)
const send = (res, evt, data) => {
    if (evt) res.write(`event: ${evt}\n`);
    res.write(`data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`);
};

//Lấy tên bệnh nhân
async function getPatientNameByUserId(userId) {
    const [[row]] = await pool.query(
        `SELECT full_name FROM patients WHERE user_id=? LIMIT 1`,
        [userId]
    );
    return row?.full_name || "";
}

// Đảm bảo session tồn tại (tạo mới nếu chưa có)
async function ensureSession(userId, sessionId) {
    const sid = sessionId || ulid();
    await pool.execute(
        `INSERT IGNORE INTO chat_sessions(id,user_id) VALUES (?,?)`,
        [sid, userId]
    );
    return sid;
}

// Lưu tin nhắn chat (user / assistant) vào DB
async function saveMsg({ sessionId, userId, role, content, meta = null }) {
    await pool.execute(
        `INSERT INTO chat_messages(session_id,user_id,role,content,meta)
         VALUES (?,?,?,?,?)`,
        [sessionId, userId, role, content, meta ? JSON.stringify(meta) : null]
    );
    await pool.execute(
        `UPDATE chat_sessions SET last_activity=NOW() WHERE id=?`,
        [sessionId]
    );
}

// Load lịch sử chat
async function loadHistory(sessionId, limit = 30) {
    const [rows] = await pool.execute(
        `SELECT role, content
         FROM chat_messages
         WHERE session_id=?
         ORDER BY id DESC
         LIMIT ?`,
        [sessionId, limit]
    );
    return rows.reverse();
}

// Chuẩn hoá text dài cho chat (không thụt lề)
function normalizeChatText(text = "") {
    return text
        .split("\n")
        .map(line => line.trim())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

// Format phí khám hiển thị
function feeText(min) {
    return min ? `${Number(min).toLocaleString("vi-VN")} đ` : "—";
}

// Tách tên bệnh viện từ câu hỏi tự nhiên
function extractHospitalName(text = "") {
    // Ưu tiên phần sau "bệnh viện"
    const m = text.match(/bệnh\s*viện\s+(.+)/i);
    if (m && m[1]) return m[1].trim();

    // Fallback: các tên phổ biến (viết tắt)
    if (/chợ\s*rẫy/i.test(text)) return "Chợ Rẫy";
    if (/bạch\s*mai/i.test(text)) return "Bạch Mai";

    return "";

}

function normalizeHospitalKeyword(name = "") {
    return name
        .replace(/^bv\s*/i, "")
        .replace(/bệnh\s*viện\s*/i, "")
        .trim();
}




//Chuẩn hóa tên chuyên khoa
function normalizeSpecialty(raw = "") {
    return raw
        .toLowerCase()
        .replace(/chuyên\s*/i, "")
        .replace(/thuộc\s*/i, "")
        .replace(/khoa\s*/i, "")
        .replace(/chuyên\s*khoa\s*/i, "")
        .replace(/\s+/g, " ")
        .trim();
}

// Làm sạch tiền tố học hàm/học vị khỏi tên bác sĩ
function cleanDoctorName(fullName = "") {
    let s = String(fullName).trim();
    const prefix =
        /^(?:PGS\.?\s*TS\.?|GS\.?\s*TS\.?|TS\.?\s*BS\.?|BSCKII\.?|BSCKI\.?|BS\.?CKII\.?|BS\.?CKI\.?|GS\.?|PGS\.?|TS\.?|ThS\.?|BS\.?)(\s+|$)/i;
    while (prefix.test(s)) s = s.replace(prefix, "").trim();
    return s.replace(/\s+/g, " ");
}

function extractDoctorName(text = "") {
    const m = text.match(/(?:bác sĩ|bs|doctor)\s+([A-Za-zÀ-ỹ .]+)/i);
    return m ? cleanDoctorName(m[1]) : cleanDoctorName(text);
}
// Định dạng dd/mm/yy
function toDDMMYY(isoDate) {
    if (!isoDate) return "";
    const [y, m, d] = String(isoDate).split("-");
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${String(y).slice(-2)}`;
}

// Parse miền / tỉnh / thành
function parseRegionCity(text = "") {
    const out = { region: "", city: "", province: "" };
    const plain = text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

    const r = plain.match(/\bmien\s+(bac|trung|nam)\b/);
    if (r) out.region = r[1];

    const c = text.match(
        /(?:t[ỉi]nh|th[àa]nh ph[oố]|tp\.?)\s+([A-Za-zÀ-ỹ .\-]+)$/i
    );
    if (c) {
        const loc = c[1].trim();
        out.city = loc;
        out.province = loc;
    } else {
        const known = text.match(
            /\b(Hà Nội|Hanoi|TP\.?HCM|Hồ Chí Minh|Sài Gòn|Đà Nẵng|Huế|Hải Phòng)\b/i
        );
        if (known) out.city = out.province = known[1];
    }
    return out;
}

// Chuẩn hoá mô tả dài để hiển thị trong chat
function formatHospitalDetails(raw = "") {
    if (!raw) return "Đang cập nhật.";

    // Bỏ các dấu gạch đầu dòng dư thừa
    let text = raw
        .replace(/^\s*[-•]+/gm, "")     // bỏ "- ", "• " đầu dòng
        .replace(/\n{2,}/g, "\n")       // gộp nhiều dòng trống
        .trim();

    // Chia thành đoạn ngắn cho dễ đọc
    const lines = text.split("\n").slice(0, 6); // lấy 5–6 dòng đầu
    return lines.join("\n");
}

// Chuẩn hoá mô tả/bio bác sĩ để hiển thị trong chat
function formatDoctorBio(raw = "") {
    if (!raw) return "- Đang cập nhật thông tin giới thiệu.";

    return raw
        .replace(/^\s*[-•]+/gm, "")
        .replace(/\n{2,}/g, "\n")
        .split("\n")
        .map(l => l.trim())
        .filter(Boolean)
        .slice(0, 6)
        .map(l => `- ${l}`)
        .join("\n");
}

// Xác định intent để quyết định: DB-only hay AI
function pickIntentRule(text = "") {
    const t = text.toLowerCase();

    //1. LỊCH KHÁM BÁC SĨ (DB-only)
    if (/(lịch|slot|giờ|ca)/.test(t) && /(bác sĩ|bs|doctor)/.test(t))
        return "doctor_schedule";

    //2. THÔNG TIN CHI TIẾT BÁC SĨ
    if (/(thông tin|chi tiết)/.test(t) && /(bác sĩ|bs)/.test(t))
        return "doctor_details";

    //3. BÁC SĨ THEO CHUYÊN KHOA + KHU VỰC
    if (
        /(bác sĩ|bs)/.test(t) &&
        /(tim mạch|da liễu|nhi|ngoại|nội|hô hấp|tiêu hoá|cơ xương khớp)/.test(t) &&
        /(miền|khu vực|bắc|trung|nam)/.test(t)
    )
        return "doctors_by_specialty_region";

    //4. THÔNG TIN CHI TIẾT BỆNH VIỆN
    if (/(thông tin|chi tiết|có gì)/.test(t) && /bệnh\s*viện/.test(t))
        return "hospital_details";

    //5. DANH SÁCH BÁC SĨ TẠI BỆNH VIỆN
    if (/(bác sĩ|chuyên khoa|khoa)/.test(t) && /bệnh\s*viện/.test(t))
        return "hospital_doctors";

    //6. TÌM / GỢI Ý BỆNH VIỆN
    if (/bệnh\s*viện/.test(t))
        return "hospital_info";

    //7. TRIỆU CHỨNG Y TẾ (FIX QUAN TRỌNG)
    if (/(đau|sốt|ho|khó thở|mệt|buồn nôn|nôn|tiêu chảy|đau bụng|chóng mặt)/.test(t))
        return "symptom_soft_ai";

    //8. GỢI Ý CHUYÊN KHOA
    if (/(nên khám|khám khoa|chuyên khoa nào)/.test(t))
        return "suggest_specialty";

    //9. GIẢI THÍCH KHÁI NIỆM Y KHOA
    if (/(là gì|nghĩa là|giải thích)/.test(t))
        return "medical_explain";

    //10. HƯỚNG DẪN ĐẶT LỊCH
    if (/(hướng dẫn|cách).*(đặt lịch|đặt khám)/.test(t))
        return "booking_guide";

    return "out_of_scope";
}

//MAIN SSE
router.post("/chat/stream", async (req, res) => {
    const userId = req.user.id;
    const { message, sessionId } = req.body || {};
    if (!message?.trim())
        return res.status(400).json({ error: "message required" });

    sseHeaders(res);

    const sid = await ensureSession(userId, sessionId);
    send(res, "open", { sessionId: sid });

    await saveMsg({ sessionId: sid, userId, role: "user", content: message });

    let intent = pickIntentRule(message);

    // Rule FAIL → fallback sang LLM
    if (intent === "out_of_scope") {
        const ai = await classifyIntentByLLM(message);

        if (ai.intent !== "out_of_scope" && ai.confidence >= 0.7) {
            intent = ai.intent;
        }
    }

    try {

        //DB-ONLY: LỊCH KHÁM BÁC SĨ
        if (intent === "doctor_schedule") {
            const m = message.match(/(?:bác sĩ|bs|doctor)\s+(.+)/i);
            const nameLike = extractDoctorName(message);

            if (nameLike.length < 3) {
                const txt = "Vui lòng nhập tên bác sĩ rõ hơn (ít nhất 3 ký tự).";
                send(res, "delta", { token: txt });
                await saveMsg({ sessionId: sid, userId, role: "assistant", content: txt });
                send(res, "done", {});
                return res.end();
            }

            const docs = await getDoctorByName({ name: nameLike });
            if (docs.length > 1) {
                let out = "Tôi tìm thấy nhiều bác sĩ phù hợp, bạn vui lòng chọn:\n";
                docs.forEach((d, i) => {
                    out += `${i + 1}) ${cleanDoctorName(d.full_name)} · ${d.hospital || "—"} · ${d.specialty || "—"}\n`;
                });
                out += "\nBạn có thể hỏi lại theo cú pháp: \"thông tin bác sĩ [tên] tại [bệnh viện]\"";

                send(res, "delta", { token: out });
                await saveMsg({ sessionId: sid, userId, role: "assistant", content: out });
                send(res, "done", {});
                return res.end();
            }

            const doc = docs?.[0];
            if (!doc) {
                const txt = `Không tìm thấy bác sĩ phù hợp với tên “${nameLike}”.`;
                send(res, "delta", { token: txt });
                await saveMsg({ sessionId: sid, userId, role: "assistant", content: txt });
                send(res, "done", {});
                return res.end();
            }

            const days = await getAvailableDays(doc.id);
            if (!days.length) {
                const txt = `Hiện chưa còn slot trống cho ${doc.full_name} trong 60 ngày tới.`;
                send(res, "delta", { token: txt });
                await saveMsg({ sessionId: sid, userId, role: "assistant", content: txt });
                send(res, "done", {});
                return res.end();
            }

            let out = `Lịch trống của ${doc.full_name} (${doc.specialty || "—"} · ${doc.hospital || "—"}):\n`;
            for (const d of days.slice(0, 10)) {
                const slots = await getSlotsByDate(doc.id, d);
                if (slots.length) {
                    out += `\n• ${toDDMMYY(d)}: ${slots.map(s => s.time).join(", ")}`;
                }
            }

            send(res, "delta", { token: out });
            await saveMsg({ sessionId: sid, userId, role: "assistant", content: out });
            send(res, "done", {});
            return res.end();
        }


        //DB-ONLY: BÁC SĨ THEO CHUYÊN KHOA + KHU VỰC

        if (intent === "doctors_by_specialty_region") {
            const spec = normalizeSpecialty(message);
            const loc = parseRegionCity(message);

            const hospitals = await searchHospitals({
                region: loc.region,
                limit: 20
            });

            if (!hospitals.length) {
                const txt = "Không tìm thấy bệnh viện phù hợp theo khu vực này.";
                send(res, "delta", { token: txt });
                await saveMsg({ sessionId: sid, userId, role: "assistant", content: txt });
                send(res, "done", {});
                return res.end();
            }

            let out = `Một số bác sĩ ${spec} tại khu vực miền ${loc.region}:\n`;
            let count = 0;

            for (const h of hospitals) {
                const docs = await getHospitalDoctorsBySpec(h.id, spec);
                for (const d of docs) {
                    out += `- ${cleanDoctorName(d.full_name)} · ${h.name}\n`;
                    if (++count >= 10) break;
                }
                if (count >= 10) break;
            }

            if (count === 0) {
                out = `Chưa tìm thấy bác sĩ ${spec} theo khu vực bạn yêu cầu.\n`;
                out += `Tôi sẽ gợi ý một số bác sĩ ${spec} trên toàn hệ thống:\n`;

                const fallback = await suggestCare({ specialty: spec });
                fallback.doctors.slice(0, 5).forEach((d, i) => {
                    out += `${i + 1}) ${cleanDoctorName(d.full_name)} · ${d.hospital || "—"}\n`;
                });
            }

            send(res, "delta", { token: out });
            await saveMsg({ sessionId: sid, userId, role: "assistant", content: out });
            send(res, "done", {});
            return res.end();
        }

        //DB-ONLY: THÔNG TIN CHI TIẾT BÁC SĨ
        if (intent === "doctor_details") {
            const nameLike = extractDoctorName(message);

            if (nameLike.length < 3) {
                const txt = "Vui lòng nhập tên bác sĩ rõ hơn.";
                send(res, "delta", { token: txt });
                send(res, "done", {});
                return res.end();
            }

            const docs = await getDoctorByName({ name: nameLike });
            const d = docs?.[0];

            if (!d) {
                const txt = "Không tìm thấy thông tin bác sĩ phù hợp.";
                send(res, "delta", { token: txt });
                send(res, "done", {});
                return res.end();
            }

            const detail = await getDoctorDetails(d.id);
            const bio = formatDoctorBio(detail.bio);

            const out = [
                `BÁC SĨ ${cleanDoctorName(detail.full_name).toUpperCase()}`,
                ``,
                `- Nơi công tác: ${detail.hospital || "—"}`,
                `- Chuyên khoa: ${d.specialty || "—"}`,
                `- Kinh nghiệm: ${detail.experience_years || "—"} năm`,
                `- Phí khám: ${feeText(detail.fee_min)}`,
                ``,
                `GIỚI THIỆU NGẮN:`,
                bio,
                ``,
                `Lưu ý: Thông tin mang tính tham khảo, vui lòng liên hệ cơ sở y tế để xác nhận.`,
            ].join("\n");

            send(res, "delta", { token: out });
            await saveMsg({ sessionId: sid, userId, role: "assistant", content: out });
            send(res, "done", {});
            return res.end();
        }

        // DB-ONLY: THÔNG TIN CHI TIẾT BỆNH VIỆN
        if (intent === "hospital_details") {
            const hospitalName = normalizeHospitalKeyword(extractHospitalName(message));

            if (!hospitalName) {
                const txt = "Bạn vui lòng cho biết rõ tên bệnh viện cần xem chi tiết.";
                send(res, "delta", { token: txt });
                send(res, "done", {});
                return res.end();
            }

            const hs = await searchHospitals({ q: hospitalName, limit: 1 });
            if (!hs.length) {
                const txt = `Không tìm thấy bệnh viện phù hợp với tên “${hospitalName}”.`;
                send(res, "delta", { token: txt });
                send(res, "done", {});
                return res.end();
            }

            const h = await getHospitalDetails(hs[0].id);

            const desc = formatHospitalDetails(h.details);

            let out =
                `BỆNH VIỆN ${h.name.toUpperCase()}
                Địa chỉ: ${h.address}
                Số bác sĩ: ${h.doctors_count}

                CÁC CHUYÊN KHOA:
                `;

            h.specialties.forEach(sp => {
                out += `- ${sp.name}: ${sp.doctors_count} bác sĩ\n`;
            });

            out += `
                GIỚI THIỆU:
                ${desc}

                Lưu ý: Thông tin có thể thay đổi theo thời gian.
            `.trim();

            send(res, "delta", { token: out });
            await saveMsg({ sessionId: sid, userId, role: "assistant", content: out });
            send(res, "done", {});
            return res.end();
        }


        //DB-ONLY: GỢI Ý BỆNH VIỆN
        if (intent === "hospital_info") {
            const kwRaw = (message.match(/bệnh\s*viện\s+(.+)/i) || [])[1]?.trim() || "";
            const loc = parseRegionCity(message);

            let q = kwRaw;
            if (loc.region || loc.city || loc.province) q = "";

            let items = await searchHospitals({
                q,
                region: loc.region,
                city: loc.city,
                province: loc.province,
                limit: 10
            });

            if (!items.length && kwRaw) {
                items = await searchHospitals({
                    q: "",
                    region: loc.region,
                    city: loc.city,
                    province: loc.province,
                    limit: 10
                });
            }

            if (!items.length) {
                const txt = "Chưa tìm được bệnh viện phù hợp. Bạn có thể nêu rõ khu vực để tôi gợi ý.";
                send(res, "delta", { token: txt });
                send(res, "done", {});
                return res.end();
            }

            const top = items.slice(0, 5).map(
                (h, i) => `${i + 1}) ${h.name} — ${h.address} · ${h.doctors_count} bác sĩ`
            ).join("\n");

            const txt = `Gợi ý bệnh viện:\n${top}`;
            send(res, "delta", { token: txt });
            await saveMsg({ sessionId: sid, userId, role: "assistant", content: txt });
            send(res, "done", {});
            return res.end();
        }

        //Hướng dẫn đặt lịch khám
        if (intent === "booking_guide") {
            const text = `
                    HƯỚNG DẪN ĐẶT LỊCH KHÁM TRÊN TVN MEDKIT

                    Bước 1: Tìm bác sĩ hoặc cơ sở y tế
                    - Sử dụng chức năng tìm kiếm để nhập tên bác sĩ, chuyên khoa hoặc bệnh viện.

                    Bước 2: Xem chi tiết và chọn ngày khám
                    - Mở trang chi tiết bác sĩ để xem lịch trống theo ngày.
                    - Chọn ngày và khung giờ phù hợp trong 60 ngày tới.

                    Bước 3: Giữ slot và nhập thông tin
                    - Chọn khung giờ, hệ thống sẽ giữ slot tạm thời.
                    - Nhập thông tin cá nhân và mô tả triệu chứng (nếu có).

                    Bước 4: Xác nhận đặt lịch
                    - Kiểm tra lại thông tin và nhấn Đặt lịch.
                    - Bạn sẽ nhận được thông báo xác nhận sau khi đặt thành công.
                    `;

            const out = normalizeChatText(text);

            send(res, "delta", { token: out });
            await saveMsg({ sessionId: sid, userId, role: "assistant", content: out });
            send(res, "done", {});
            return res.end();
        }

        //HỎI TRIỆU CHỨNG Y TẾ
        if (intent === "symptom_soft_ai") {
            const explain = await explainSymptomsByLLM(message);
            const { specialty, doctors } = await suggestCare({ symptoms: message });

            // Nếu rule trả về "Nội tổng quát", ưu tiên gợi ý mềm
            const finalSpecialty =
                specialty === "Nội tổng quát"
                    ? "Nội tổng quát (đánh giá ban đầu)"
                    : specialty;

            let out = `${explain}\n\nBạn có thể cân nhắc khám chuyên khoa: ${finalSpecialty}.\n`;

            if (doctors?.length) {
                out += "\nMột số bác sĩ phù hợp:\n";
                doctors.slice(0, 5).forEach((d, i) => {
                    out += `${i + 1}) ${cleanDoctorName(d.full_name)} · ${d.hospital || "—"}\n`;
                });
            }

            out += "\nLưu ý: Thông tin chỉ mang tính tham khảo, bạn nên đi khám trực tiếp.";

            send(res, "delta", { token: out });
            await saveMsg({ sessionId: sid, userId, role: "assistant", content: out });
            send(res, "done", {});
            return res.end();
        }

        //GỢI Ý CHUYÊN KHOA
        if (intent === "suggest_specialty") {
            const { specialty } = await suggestCare({ symptoms: message });

            const out = `Với vấn đề bạn nêu, chuyên khoa phù hợp là: ${specialty}.
                Bạn có thể đặt lịch khám với bác sĩ thuộc chuyên khoa này trên TVN Medkit.`;

            send(res, "delta", { token: out });
            await saveMsg({ sessionId: sid, userId, role: "assistant", content: out });
            send(res, "done", {});
            return res.end();
        }

        //GIẢI THÍCH KHÁI NIỆM Y KHOA
        if (intent === "medical_explain") {
            const explain = await explainMedicalConceptByLLM(message);
            const out = normalizeChatText(explain);

            send(res, "delta", { token: out });
            await saveMsg({ sessionId: sid, userId, role: "assistant", content: out });
            send(res, "done", {});
            return res.end();
        }

        //NGOÀI PHẠM VI
        const txt = "Mình chỉ hỗ trợ các vấn đề y tế trên TVN Medkit (triệu chứng, bác sĩ, bệnh viện).";
        send(res, "delta", { token: txt });
        await saveMsg({ sessionId: sid, userId, role: "assistant", content: txt });
        send(res, "done", {});
        return res.end();

    } catch (err) {
        console.error(err);
        const txt = "Xin lỗi, có lỗi khi xử lý yêu cầu của bạn.";
        send(res, "delta", { token: txt });
        await saveMsg({ sessionId: sid, userId, role: "assistant", content: txt });
        send(res, "done", {});
        res.end();
    }
});


//LỊCH SỬ CHAT
router.get("/history", async (req, res) => {
    const userId = req.user.id;
    const { sessionId, limit = 50 } = req.query || {};
    if (!sessionId)
        return res.status(400).json({ error: "sessionId required" });

    const [[row]] = await pool.query(
        `SELECT user_id FROM chat_sessions WHERE id=?`,
        [sessionId]
    );

    if (!row || row.user_id !== userId) {
        const newSid = ulid();
        await pool.execute(
            `INSERT INTO chat_sessions(id,user_id) VALUES (?,?)`,
            [newSid, userId]
        );

        const userName = await getPatientNameByUserId(userId);
        const GREETING = buildGreeting(userName);
        await saveMsg({
            sessionId: newSid,
            userId,
            role: "assistant",
            content: GREETING
        });
        return res.json({
            sessionId: newSid,
            messages: [{ role: "assistant", content: GREETING }]
        });
    }

    const rows = await loadHistory(sessionId, Number(limit) || 50);
    res.json({ sessionId, messages: rows });
});


//Xóa lịch sử chat
router.delete("/history", async (req, res) => {
    const userId = req.user.id;
    const { sessionId } = req.query || {};
    if (!sessionId)
        return res.status(400).json({ error: "sessionId required" });

    const [[row]] = await pool.query(
        `SELECT user_id FROM chat_sessions WHERE id=?`,
        [sessionId]
    );
    if (!row) return res.status(404).json({ error: "not_found" });
    if (row.user_id !== userId)
        return res.status(403).json({ error: "forbidden" });

    await pool.execute(`DELETE FROM chat_messages WHERE session_id=?`, [sessionId]);
    await pool.execute(`DELETE FROM chat_sessions WHERE id=?`, [sessionId]);

    const newSid = ulid();
    await pool.execute(
        `INSERT INTO chat_sessions(id,user_id) VALUES (?,?)`,
        [newSid, userId]
    );

    const userName = await getPatientNameByUserId(userId);
    const GREETING = buildGreeting(userName);
    await saveMsg({
        sessionId: newSid,
        userId,
        role: "assistant",
        content: GREETING
    });

    res.json({
        sessionId: newSid,
        messages: [{ role: "assistant", content: GREETING }]
    });
});

export default router;
