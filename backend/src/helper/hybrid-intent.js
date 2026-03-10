import { groqStream } from "./groq.js";

/**
 * Danh sách intent được phép LLM trả về
 * (guardrail: LLM nói gì ngoài danh sách → vứt)
 */
const ALLOWED_INTENTS = [
    "doctor_schedule",
    "doctor_details",
    "doctors_by_specialty_region",
    "hospital_details",
    "hospital_doctors",
    "hospital_info",
    "symptom_soft_ai",
    "suggest_specialty",
    "booking_guide",
    "out_of_scope"
];

/*
 * Prompt CHỈ DÙNG ĐỂ PHÂN LOẠI INTENT 
 */

const INTENT_CLASSIFY_PROMPT = `
Bạn là hệ thống PHÂN LOẠI INTENT cho chatbot y tế.

Chỉ trả về JSON DUY NHẤT, KHÔNG thêm chữ.

Schema:
{
  "intent": "<string>",
  "confidence": <number từ 0 đến 1>
}

Danh sách intent hợp lệ:
${ALLOWED_INTENTS.join(", ")}

Quy tắc:
- Nếu không chắc → intent = "out_of_scope"
- Không suy đoán quá mức
`.trim();

/**
 * Gọi LLM để phân loại intent
 */
export async function classifyIntentByLLM(userText) {
    try {
        const stream = await groqStream({
            messages: [
                { role: "system", content: INTENT_CLASSIFY_PROMPT },
                { role: "user", content: userText }
            ],
            temperature: 0
        });

        let raw = "";

        for await (const chunk of stream) {
            raw += chunk.choices?.[0]?.delta?.content || "";
        }

        const parsed = JSON.parse(raw);

        // Guardrail cấp 1: schema
        if (
            !parsed ||
            typeof parsed.intent !== "string" ||
            typeof parsed.confidence !== "number"
        ) {
            return { intent: "out_of_scope", confidence: 0 };
        }

        // Guardrail cấp 2: whitelist intent
        if (!ALLOWED_INTENTS.includes(parsed.intent)) {
            return { intent: "out_of_scope", confidence: 0 };
        }

        return parsed;
    } catch (err) {
        console.error("LLM intent classify failed:", err);
        return { intent: "out_of_scope", confidence: 0 };
    }
}