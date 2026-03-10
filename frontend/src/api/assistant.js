const API = import.meta.env.VITE_API_BASE_URL;

//Helper: lấy Authorization header cho API chatbot
function authHeader() {
    return { Authorization: `Bearer ${localStorage.getItem("token") || ""}` };
}

//Gửi tin nhắn tới chatbot AI và nhận phản hồi theo dạng stream (SSE - Server-Sent Events)
export async function streamChat({ message, sessionId, onOpen, onDelta, onTool, onDone }) {
    // Dùng URL để ghép chính xác endpoint, tránh lỗi khi concat string
    const url = new URL("/assistant/chat/stream", API);

    const response = await fetch(url.toString(), {
        method: "POST",
        mode: "cors",
        headers: {
            "Content-Type": "application/json",
            ...authHeader(),
        },
        body: JSON.stringify({ message, sessionId }),
    });

    if (!response.ok || !response.body) {
        // Trường hợp lỗi HTTP: cố gắng log JSON trả về (nếu có)
        try {
            console.error("assistant stream error:", await response.json());
        } catch {
            // ignore
        }
        onDone?.();
        return;
    }

    // Đọc SSE theo từng chunk bytes
    const responseStreamReader = response.body.getReader();
    const textDecoder = new TextDecoder("utf-8");

    // Bộ đệm tích lũy text SSE (một event kết thúc bằng "\n\n")
    let sseBuffer = "";

    while (true) {
        const { value, done } = await responseStreamReader.read();
        if (done) break;

        // Giải mã chunk bytes -> string và nối vào bộ đệm
        sseBuffer += textDecoder.decode(value, { stream: true });

        // Mỗi block (event) cách nhau bởi 1 dòng trống
        const eventBlocks = sseBuffer.split("\n\n");
        // Phần cuối có thể là block dở dang -> giữ lại cho vòng lặp sau
        sseBuffer = eventBlocks.pop() || "";

        for (const block of eventBlocks) {
            const lines = block.split("\n");

            // Tên sự kiện: lấy từ dòng "event: ..."
            const eventHeader = lines.find((l) => l.startsWith("event: "));
            const eventName = eventHeader ? eventHeader.slice(7).trim() : "message";

            // Payload: lấy từ dòng "data: ..." rồi parse JSON
            const dataLine = lines.find((l) => l.startsWith("data: ")) || "data: {}";
            let payload = {};
            try {
                payload = JSON.parse(dataLine.slice(6));
            } catch {
                payload = {}; // nếu parse lỗi, coi như payload rỗng
            }

            // Điều phối callback theo eventName
            if (eventName === "open") onOpen?.(payload);
            else if (eventName === "delta") onDelta?.(payload.token || "");
            else if (eventName === "tool") onTool?.(payload);
            else if (eventName === "done") onDone?.();
        }
    }
}

/**
 * Lấy lịch sử chat theo sessionId.
 * Dùng URLSearchParams để tránh lỗi ghép chuỗi thủ công.
 */
export async function getHistory(sessionId, limit = 50) {
    const url = new URL("/assistant/history", API);
    url.searchParams.set("sessionId", sessionId);
    url.searchParams.set("limit", String(limit));

    const response = await fetch(url.toString(), {
        headers: authHeader(),
        mode: "cors",
    });

    if (!response.ok) {
        return { messages: [] };
    }
    try {
        return await response.json();
    } catch {
        console.warn("assistant history: response is not JSON");
        return { messages: [] };
    }
}

//Xóa lịch sử chat hiện tại và tạo session mới (server trả về sid mới + lời chào).
export async function clearHistory(sessionId) {
    const url = new URL("/assistant/history", API);
    url.searchParams.set("sessionId", sessionId);

    const response = await fetch(url.toString(), {
        method: "DELETE",
        headers: authHeader(),
        mode: "cors",
    });

    if (!response.ok) throw new Error("Xóa lịch sử đoạn chat thất bại");
    return response.json();
}   