import { groqStream, ASSISTANT_SYSTEM_PROMPT } from "./groq.js";

/**
 * PROMPT DÙNG RIÊNG CHO GIẢI THÍCH Y KHOA
 * Bám CHẶT prompt bạn đã chốt
 */
const MEDICAL_EXPLAIN_PROMPT = `
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
- Nêu các dấu hiệu cần đi khám.

YÊU CẦU CÁCH TRẢ LỜI:
- Ngắn gọn, trung lập, dễ hiểu.
- Không dùng từ ngữ gây hoang mang.
- Không đưa ra kết luận bệnh.

Chỉ trả lời nội dung giải thích, KHÔNG chào hỏi.
`.trim();

// mô tả các triệu chứng phổ biến
 
export async function explainSymptomsByLLM(text) {
    return callMedicalLLM(`
Người dùng mô tả triệu chứng sau:
"${text}"

Hãy mô tả:
- Triệu chứng này thường gặp trong những trường hợp nào (mức độ phổ biến).
- Khi nào nên đi khám bác sĩ.
`);
}


//Giải thích KHÁI NIỆM / BỆNH LÝ CƠ BẢN

export async function explainMedicalConceptByLLM(text) {
    return callMedicalLLM(`
Người dùng hỏi về khái niệm y khoa:
"${text}"

Hãy giải thích khái niệm này theo cách dễ hiểu cho người không chuyên.
`);
}

//Hàm gọi Groq CHUNG (guardrail tập trung)

async function callMedicalLLM(userPrompt) {
    try {
        const stream = await groqStream({
            messages: [
                { role: "system", content: MEDICAL_EXPLAIN_PROMPT },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.2
        });

        let out = "";

        for await (const chunk of stream) {
            out += chunk.choices?.[0]?.delta?.content || "";
        }

        return out.trim();
    } catch (err) {
        console.error("medical explain LLM error:", err);
        return "Thông tin y khoa mang tính tham khảo. Bạn nên trao đổi trực tiếp với bác sĩ để được tư vấn cụ thể.";
    }
}
