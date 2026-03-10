import { useEffect, useRef, useState } from "react";
import { streamChat, getHistory, clearHistory } from "../../api/assistant";
import AIBotLogo from "./AIBotLogo";
import "../../styles/assistant.css";

// Lấy userId từ JWT để gắn session chat
//Helper: Decode JWT token để lấy user ID (mỗi user có session chat riêng)
function getCurrentUid() {
  const t = localStorage.getItem("token");
  if (!t) return "guest"; //Nếu chưa login → user = "guest"
  try {

    //payload chứa thông tin user (id, role...)
    const p = JSON.parse(atob(t.split(".")[1])); //Decode phần payload (base64)
    return p.id || p.userId || p.sub || "guest";
  } catch {
    return "guest";
  }
}

// Key session theo user
const sidKey = () => `assistant_sid_${getCurrentUid()}`;
//Đọc sessionId từ localStorage
const readSid = () => localStorage.getItem(sidKey());
//Ghi sessionId vào localStorage
const writeSid = (v) => localStorage.setItem(sidKey(), v);



// Tạo session mới
//Helper: Tạo sessionId ngẫu nhiên (dạng "sid_abc123...")
function newSid() {
  //Dùng crypto.randomUUID() nếu có, không thì dùng Math.random
  const r = (crypto?.randomUUID?.() || Math.random().toString(36)).replace(/-/g, "");
  return `sid_${r.slice(0, 10)}`;
}

// Init session - Khởi tạo hoặc lấy session đã có
//Helper: Lấy session hiện có hoặc tạo mới nếu chưa có
function initSid() {
  let v = readSid();
  if (!v) {
    v = newSid();
    writeSid(v);
  }
  return v;
}

// Format giờ phút (HH:mm)
//Helper: Format timestamp thành "HH:mm" (ví dụ: "14:30")
function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

//Format timestamp thành "DD/MM/YYYY T2, 14:30"
function fmtDividerTime(ts) {
  if (!ts || isNaN(ts)) return "";

  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";

  const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

  return `${String(d.getDate()).padStart(2, "0")}/` +
    `${String(d.getMonth() + 1).padStart(2, "0")}/` +
    `${d.getFullYear()} ${days[d.getDay()]}, ${fmtTime(ts)}`;
}


// Kiểm tra có hiển thị divider không
//Hiện divider khi: (1) Là tin của user, (2) Khoảng cách >5 phút
function shouldShowTimeDivider(prev, curr) {
  if (curr?.role === "user") return true; //Luôn hiện divider trước tin nhắn của user
  if (!prev?.ts || !curr?.ts) return true; //Nếu thiếu timestamp → hiện
  return Math.abs(curr.ts - prev.ts) >= 5 * 60 * 1000; //Cách nhau >= 5 phút
}


export default function AssistantBoxchat({ onClose }) {

  //useState: Lưu ID phiên chat (sessionId) - mỗi user có 1 session riêng, được lưu trong localStorage
  const [sessionId, setSessionId] = useState(initSid());

  //useState: Lưu danh sách tin nhắn trong chat - mảng các object {role, content, ts}
  const [list, setList] = useState([]);

  //useState: Lưu nội dung đang gõ trong input box - bind 2 chiều với <input>
  const [inp, setInp] = useState("");

  //useState: Đánh dấu đang gửi/nhận tin nhắn - dùng để disable input khi busy
  const [busy, setBusy] = useState(false);

  //useState: Hiển thị modal xác nhận xóa lịch sử chat - true: hiện modal, false: ẩn
  const [askClear, setAskClear] = useState(false);

  //useState: Chế độ fullscreen - true: toàn màn hình, false: cửa sổ nhỏ
  const [isFull, setIsFull] = useState(false);

  //useState: Chế độ scroll - "top" (lên đầu), "bottom" (xuống cuối), "auto" (không làm gì)
  const [scrollMode, setScrollMode] = useState("auto");

  //useRef: Trỏ đến DOM element của chat body - dùng để điều khiển scroll position
  const bodyRef = useRef(null);

  //useRef: Flag đánh dấu đang streaming - true khi đang nhận tin từng token từ AI
  const streamingRef = useRef(false);

  //useRef: Flag đánh dấu user đang tự scroll - true khi user scroll lên xem tin cũ
  const userScrollingRef = useRef(false);

  //useRef: Flag cho phép auto-scroll - true khi user ở gần cuối chat
  const autoScrollRef = useRef(true);


  // Icon phóng to (fullscreen)
  const IconExpand = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 9V4h5M20 15v5h-5M20 9V4h-5M4 15v5h5"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );

  // Icon thu nhỏ (exit fullscreen)
  const IconCollapse = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M9 4H4v5M15 20h5v-5M20 9h-5V4M4 15h5v5"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );

  // Icon đóng (close)
  const IconClose = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );

  //useEffect: Fetch lịch sử chat từ server khi component mount hoặc sessionId thay đổi
  //Dependencies: [sessionId] - chỉ chạy lại khi sessionId thay đổi (user đổi session hoặc xóa chat)
  useEffect(() => {
    (async () => {
      const res = await getHistory(sessionId);

      if (res?.sessionId && res.sessionId !== sessionId) {
        setSessionId(res.sessionId);
        writeSid(res.sessionId);
      }

      const normalized = (res?.messages || [])
        .filter(m => m.role !== "tool")
        .map(m => {
          let ts = null;

          if (typeof m.ts === "number") {
            ts = m.ts;
          } else if (m.ts) {
            const t = new Date(m.ts).getTime();
            ts = isNaN(t) ? null : t;
          } else if (m.created_at) {
            const t = new Date(m.created_at).getTime();
            ts = isNaN(t) ? null : t;
          }

          return { ...m, ts };
        });

      setList(normalized);

      const hasUserMessage = normalized.some(m => m.role === "user");
      if (!hasUserMessage) {
        setScrollMode("top");
      } else {
        setScrollMode("bottom");
      }
    })();
  }, [sessionId]);



  //useEffect: Lắng nghe scroll event để cập nhật autoScrollRef
  //Dependencies: [] - chỉ chạy 1 lần khi component mount
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      autoScrollRef.current = nearBottom;
    };

    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);



  //useEffect: Tự động scroll lên/xuống theo scrollMode
  //Dependencies: [list.length, scrollMode] - chạy lại khi có tin mới hoặc đổi chế độ scroll
  
  useEffect(() => {
    if (!bodyRef.current) return;

    const el = bodyRef.current;

    if (scrollMode === "top") {
      el.scrollTop = 0;
    }

    if (scrollMode === "bottom") {
      el.scrollTop = el.scrollHeight;
    }
  }, [list.length, scrollMode]);


  //useEffect: Kiểm tra hành vi scroll của user để quyết định có tự động scroll hay không
  //Nếu user scroll lên  >40px → userScrollingRef=true → không auto-scroll khi có tin mới
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      userScrollingRef.current = !nearBottom;
    };

    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // FUNCTION: Gửi message

  async function send() {
    const msg = inp.trim();
    if (!msg || busy) return; //Nếu input rỗng hoặc đang busy → return

    //Chuẩn bị gửi
    autoScrollRef.current = true;
    streamingRef.current = true;
    setInp(""); //Clear input
    setBusy(true); //Khóa input

    //Thêm tin nhắn của user + placeholder cho bot
    setList(x => [
      ...x,
      { role: "user", content: msg, ts: Date.now() },
      { role: "assistant", content: "", ts: Date.now(), typing: true }, //Placeholder
    ]);
    setScrollMode("bottom"); //Scroll xuống bottom

    let idx = null; //Index của tin bot trong array

    try {
      //Gọi API streaming chat
      await streamChat({
        message: msg,
        sessionId,

        //Callback khi mở kết nối
        onOpen: (d) => {
          if (d?.sessionId && d.sessionId !== sessionId) {
            setSessionId(d.sessionId);
            writeSid(d.sessionId);
          }
        },

        //Callback khi nhận từng token (streaming)
        onDelta: (t) =>
          setList(arr => {
            const a = [...arr];
            if (idx === null) idx = a.length - 1; //Tìm index tin bot
            a[idx] = { ...a[idx], content: a[idx].content + t, typing: false }; //Append token

            //Auto-scroll khi có token mới (nếu user không scroll lên)
            requestAnimationFrame(() => {
              if (autoScrollRef.current && bodyRef.current) {
                bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
              }
            });

            return a;
          }),

        //Callback khi stream kết thúc
        onDone: () => {
          streamingRef.current = false;
          setBusy(false);
        },

      });
    } catch {
      //Xử lý lỗi
      streamingRef.current = false;
      setBusy(false);
    }
  }

  // ---------------------------------------------------------------------------
  // FUNCTION: Xác nhận xóa chat
  // ---------------------------------------------------------------------------

  async function confirmClear() {
    try {
      //Gọi API xóa lịch sử → Server trả về sessionId mới
      const res = await clearHistory(sessionId);
      if (res?.sessionId) {
        setSessionId(res.sessionId);
        writeSid(res.sessionId);
      }
      setList([]); //Clear danh sách tin nhắn
      setScrollMode("top");
    } finally {
      setAskClear(false); //Đóng modal
    }
  }

  // ---------------------------------------------------------------------------
  // JSX RENDER
  // ---------------------------------------------------------------------------

  return (
    <div className={`assistant-boxchat ${isFull ? "assistant-boxchat--full" : ""}`}>
      {/* ===================================================================
          HEADER - Thanh tiêu đề với avatar, tên bot, và các nút action
          =================================================================== */}
      <div className="assistant-boxchat__header">
        <div className="assistant-header-left">
          {/* Avatar bot */}
          <div className="assistant-avatar-wrapper">
            <div className="assistant-avatar">
              {/* SVG vẽ hình bot */}
              <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
                <circle cx="24" cy="24" r="23" fill="#f0e9e9ff" opacity="0.9" />
                <circle cx="24" cy="26" r="14" fill="#fff" />
                <path d="M12 18 Q24 8, 36 18 Q38 24, 36 26 L12 26 Q10 24, 12 18 Z" fill="#2563eb" />
                <circle cx="18" cy="24" r="3.5" fill="#0f172a" />
                <circle cx="30" cy="24" r="3.5" fill="#0f172a" />
                <circle cx="19" cy="23" r="1.2" fill="#fff" opacity="0.8" />
                <circle cx="31" cy="23" r="1.2" fill="#fff" opacity="0.8" />
                <path d="M16 30 Q24 34, 32 30" stroke="#0f172a" strokeWidth="2" fill="none" strokeLinecap="round" />
                <path d="M18 36 Q24 42, 30 36" fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" />
                <circle cx="15" cy="36" r="2" fill="#1e40af" />
                <circle cx="33" cy="36" r="2" fill="#1e40af" />
              </svg>
            </div>
            <div className="assistant-avatar-glow"></div> {/* Hiệu ứng glow */}
          </div>

          {/* Thông tin trợ lý */}
          <div className="assistant-boxchat__title">
            <strong>Medu</strong>
            <span className="assistant-boxchat__subtitle">
              Trợ lý AI y tế
            </span>
          </div>
        </div>

        {/* Các nút action */}
        <div className="assistant-header-actions">
          {/* Nút phóng to/thu nhỏ */}
          <button
            className="assistant-header-btn"
            aria-label={isFull ? "Thu nhỏ" : "Toàn màn hình"}
            onClick={() => setIsFull(v => !v)}
          >
            {isFull ? <IconCollapse /> : <IconExpand />}
          </button>

          {/* Nút xóa chat */}
          <button
            className="assistant-header-btn"
            aria-label="Xóa cuộc trò chuyện"
            onClick={() => setAskClear(true)}
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 7h2v7h-2v-7Zm5 0h2v7h-2v-7ZM7 10h2v7H7v-7Zm-1 9h12l1-11H5l1 11Z" fill="currentColor" />
            </svg>
          </button>

          {/* Nút đóng */}
          <button
            className="assistant-header-btn"
            aria-label="Đóng"
            onClick={onClose}
          >
            <IconClose />
          </button>
        </div>
      </div>

      {/* ===================================================================
          BODY - Phần hiển thị tin nhắn
          =================================================================== */}
      <div ref={bodyRef} className="assistant-boxchat__body">

        {/* Welcome screen - Chỉ hiện khi chưa có tin nhắn của user */}
        {!list.some(m => m.role === "user") && (
          <>
            <div className="assistant-welcome">
              <div className="assistant-welcome__icon">
                <AIBotLogo size={96} />
              </div>

              <div className="assistant-welcome__name">Medu</div>

              <div className="assistant-welcome__desc">
                Medu hỗ trợ bạn tìm kiếm, tra cứu thông tin<br />
                cơ sở y tế, chuyên khoa, bác sĩ.
              </div>
            </div>

            <div className="assistant-welcome-divider"></div>
          </>
        )}

        {/* Danh sách tin nhắn - Map qua từng tin nhắn */}
        {list.map((m, i) => {
          const prev = list[i - 1]; //Tin trước đó
          const right = m.role === "user"; //Tin của user → căn phải

          return (
            <div key={i}>
              {/* Time divider - Ngăn cách theo thời gian */}
              {shouldShowTimeDivider(prev, m) && (
                <div className="assistant-time-divider">
                  <span>{fmtDividerTime(m.ts)}</span>
                </div>
              )}

              {/* Tin nhắn */}
              <div className={`assistant-msg-row ${right ? "right" : "left"}`}>
                {/* Avatar bot (chỉ hiện với tin của bot) */}
                {!right && (
                  <div className="assistant-msg-avatar">
                    <AIBotLogo size={28} />
                  </div>
                )}

                {/* Bubble tin nhắn */}
                <div className={`assistant-msg ${right ? "user" : "bot"}`}>
                  <div className="assistant-msg__content">
                    {m.content || (m.typing ? "● ● ●" : "")} {/* Hiện "..." khi typing */}
                  </div>
                  {/* Timestamp (chỉ hiện với tin của user) */}
                  {right && <div className="assistant-msg__time">{fmtTime(m.ts)}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===================================================================
          FOOTER - Input và nút gửi
          =================================================================== */}
      <div className="assistant-boxchat__footer">
        <input
          placeholder="Hỏi triệu chứng, bác sĩ, bệnh viện..."
          value={inp}
          onChange={(e) => setInp(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()} //Enter để gửi
          disabled={busy}
        />
        <button className="assistant-send-btn" onClick={send} disabled={busy}>➤</button>
      </div>

      {/* ===================================================================
          MODAL XÁC NHẬN XÓA CHAT
          =================================================================== */}
      {askClear && (
        <div className="assistant-confirm-inline">
          <div className="assistant-confirm__box">
            <div className="assistant-confirm__title">Xóa toàn bộ cuộc trò chuyện?</div>
            <div className="assistant-confirm__text">
              Hành động này không thể hoàn tác.
            </div>
            <div className="assistant-confirm__actions">
              <button onClick={() => setAskClear(false)}>Hủy</button>
              <button className="danger" onClick={confirmClear}>Xác nhận</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========================================================================
   📚 GIẢI THÍCH LOGIC VÀ CÁCH HOẠT ĐỘNG - AssistantBoxchat.jsx
   ========================================================================

   🎯 MỤC ĐÍCH CHÍNH:
   Component chatbox AI chatbot, hỗ trợ user tìm kiếm thông tin y tế.
   Sử dụng SSE (Server-Sent Events) để streaming response real-time.

   📋 CẤU TRÚC CHÍNH:

   1. SESSION MANAGEMENT (Quản lý phiên chat)
   ============================================
   
   **SessionId là gì?**
   - Mỗi user có 1 sessionId để lưu lịch sử chat riêng
   - Format: "sid_abc123..." (10 ký tự)
   - Lưu trong localStorage theo key: "assistant_sid_<userId>"
   
   **Flow khởi tạo:**
   ```javascript
   Component mount → initSid()
     → Check localStorage có session chưa?
       → Có: Dùng session cũ
       → Không: Tạo mới bằng newSid()
   ```
   
   **Tại sao cần sessionId?**
   → Backend lưu lịch sử chat theo sessionId trong database
   → User có thể quay lại xem lại chat cũ

   2. LOADING HISTORY (Load lịch sử chat)
   ========================================
   
   **Khi nào load?**
   - Component mount lần đầu
   - Khi sessionId thay đổi (ví dụ: xóa chat → session mới)
   
   **Flow:**
   ```javascript
   useEffect → getHistory(sessionId)
     → Backend query database: SELECT * FROM messages WHERE session_id = ?
     → Trả về array messages
     → Frontend normalize (chuẩn hóa timestamp)
     → Set vào state `list`
   ```
   
   **Normalize messages:**
   - Lọc bỏ message có role = "tool" (internal message)
   - Chuẩn hóa timestamp về dạng số (milliseconds)
   - Hỗ trợ nhiều field: ts, created_at...

   3. STREAMING CHAT (Gửi tin và nhận streaming)
   ==============================================
   
   **Flow gửi tin:**
   ```javascript
   User gõ → Enter → send()
     1. Validate: Kiểm tra input không rỗng && không busy
     2. Update UI ngay:
        - Thêm tin user vào list
        - Thêm placeholder bot (content = "", typing = true)
     3. Gọi streamChat() với callbacks:
        - onOpen: Nhận sessionId mới (nếu có)
        - onDelta: Nhận từng token → Append vào content
        - onDone: Stream kết thúc → setBusy(false)
   ```
   
   **SSE Streaming format:**
   ```
   event: open
   data: {"sessionId": "sid_xyz"}
   
   event: delta
   data: {"token": "Xin"}
   
   event: delta
   data: {"token": " chào"}
   
   event: done
   data: {}
   ```
   
   **Tại sao dùng streaming?**
   → User thấy response ngay lập tức (typing effect)
   → Trải nghiệm tốt hơn so với đợi toàn bộ response

   4. AUTO-SCROLL LOGIC (Tự động scroll)
   =======================================
   
   **3 chế độ scroll:**
   - `scrollMode = "top"`: Scroll lên đầu (chat mới)
   - `scrollMode = "bottom"`: Scroll xuống cuối (gửi/nhận tin)
   - `scrollMode = "auto"`: Không scroll (user đang xem tin cũ)
   
   **autoScrollRef:**
   - = true: Cho phép auto-scroll (user ở gần bottom)
   - = false: Không auto-scroll (user đang scroll lên xem tin cũ)
   
   **Flow:**
   ```javascript
   User scroll → onScroll event
     → Check nearBottom (trong vòng 80px)
       → Nếu gần bottom: autoScrollRef = true
       → Nếu xa bottom: autoScrollRef = false
   
   Khi có tin mới (onDelta):
     → if (autoScrollRef.current) {
         bodyRef.current.scrollTop = scrollHeight // Scroll xuống
       }
   ```

   5. TIME DIVIDER (Ngăn cách thời gian)
   ======================================
   
   **Khi nào hiện divider?**
   - Trước mỗi tin nhắn của user (luôn luôn)
   - Khi khoảng cách với tin trước >= 5 phút
   
   **Logic:**
   ```javascript
   shouldShowTimeDivider(prev, curr):
     if (curr.role === "user") return true // Luôn hiện với tin user
     if (không có timestamp) return true
     if (|curr.ts - prev.ts| >= 5 phút) return true
   ```
   
   **Format hiển thị:**
   "02/01/2026 T5, 14:30" (giống Messenger)

   6. CLEAR HISTORY (Xóa lịch sử chat)
   ====================================
   
   **Flow:**
   ```javascript
   User click "Xóa" → setAskClear(true)
     → Hiện modal confirm
     → User click "Xác nhận" → confirmClear()
       → DELETE /assistant/history?sessionId=...
       → Backend xóa messages + tạo session mới
       → Frontend:
         - Lưu sessionId mới
         - Clear list
         - scrollMode = "top"
   ```

   7. FULLSCREEN MODE (Chế độ toàn màn hình)
   ==========================================
   
   **Toggle:**
   ```javascript
   Click icon → setIsFull(v => !v)
     → CSS class "assistant-boxchat--full"
     → CSS:
       .assistant-boxchat--full {
         width: 100vw;
         height: 100vh;
       }
   ```

   ⚠️ ĐIỂM QUAN TRỌNG KHI BẢO VỆ:
   ================================
   
   1. **SSE vs WebSocket?**
      → SSE đơn giản hơn, chỉ cần 1 chiều server → client
      → WebSocket 2 chiều, phức tạp hơn, cần cho real-time collaboration
   
   2. **Tại sao normalize timestamp?**
      → Backend có thể trả về nhiều format: ISO string, Unix timestamp...
      → Frontend chuẩn hóa về milliseconds để dễ so sánh
   
   3. **Tại sao dùng requestAnimationFrame cho scroll?**
      → Đảm bảo scroll diễn ra AFTER DOM update
      → Tránh scroll trước khi content được render
   
   4. **useRef vs useState cho streaming?**
      → streamingRef không trigger re-render (hiệu suất tốt)
      → Chỉ cần track internal state, không cần hiển thị UI
   
   5. **Session lưu ở đâu?**
      → localStorage: `assistant_sid_<userId>`
      → Backend: Table `chat_sessions` hoặc `assistant_messages`

   ======================================================================== */
