import Groq from "groq-sdk";

export const GROQ_MODEL = "llama-3.1-8b-instant";

export const ASSISTANT_SYSTEM_PROMPT = `
Bạn là trợ lý AI y tế của TVN Medkit.

QUY ĐỊNH BẮT BUỘC:
- Chỉ cung cấp thông tin y khoa cơ bản, mang tính tham khảo.
- KHÔNG chẩn đoán bệnh.
- KHÔNG kết luận chắc chắn tình trạng sức khỏe.
- KHÔNG kê đơn, không nêu thuốc hay liều dùng.
- KHÔNG thay thế tư vấn của bác sĩ.

ĐƯỢC PHÉP:
- Mô tả triệu chứng phổ biến.
- Giải thích khái niệm y khoa cơ bản.
- Nhắc người dùng nên đi khám khi cần thiết.

Luôn giữ giọng trung lập, an toàn.
`.trim();

export function buildMessages(history, userTurn) {
  const cleaned = (history || []).filter(m => m.role !== "tool");
  return [
    { role: "system", content: ASSISTANT_SYSTEM_PROMPT },
    ...cleaned,
    { role: "user", content: userTurn },
  ];
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function groqStream({ messages, temperature = 0.2 }) {
  return groq.chat.completions.create({ model: GROQ_MODEL, stream: true, temperature, messages });
}
