import { useEffect, useState } from "react";

export default function SearchBars({
  value = "",
  onChange = () => { },
}) {
  // local text để debounce, luôn bám theo prop value
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  // debounce 300ms rồi “phát” ra ngoài
  useEffect(() => {
    const t = setTimeout(() => {
      onChange(text.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [text, onChange]);

  const containerStyles = {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    margin: "18px 0",
  };
  const wrapStyles = { width: "100%", maxWidth: "960px", padding: "0 12px", margin: "0 auto" };
  const formStyles = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    background: "#fff",
    borderRadius: "999px",
    padding: "8px 10px",
    border: "1.5px solid #d6e8f8",
    boxShadow: "0 16px 40px rgba(6,55,110,.15)",
  };
  const inputWrapStyles = { position: "relative", flex: 1 };
  const iconStyles = { position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", opacity: 0.7 };
  const inputStyles = {
    width: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    padding: "12px 14px 12px 40px",
    fontSize: 16,
  };
  // const btnStyles = { background: "#1fb1f5", color: "#fff", border: "none", padding: "12px 22px", borderRadius: "999px", fontWeight: 700, cursor: "pointer" };

  return (
    <div style={containerStyles}>
      <div style={wrapStyles}>
        <form
          className="sb-form"
          style={formStyles}
          onSubmit={(e) => e.preventDefault()} // không điều hướng
        >
          <div style={inputWrapStyles}>
            <span style={iconStyles}>🔎</span>
            <input
              style={inputStyles}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Tìm theo tên bác sĩ, cơ sở, chuyên khoa…"
            />
          </div>
          {/* Nút giữ nguyên UI, bấm vào sẽ phát ngay lập tức giá trị hiện tại */}
          {/* <button
            type="button"
            className="sb-btn"
            style={btnStyles}
            onClick={() => onChange(text.trim())}
          >
            Tìm kiếm
          </button> */}
        </form>

        <style>{`
          @media (max-width: 768px) {
            .sb-form { flex-direction: column; border-radius: 18px; }
            .sb-btn  { width: 100%; margin-top: 8px; }
          }
        `}</style>
      </div>
    </div>
  );
}

