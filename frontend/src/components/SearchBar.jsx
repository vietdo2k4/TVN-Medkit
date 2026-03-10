import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/searchbar.css";

const PLACEHOLDERS = [
  "Tìm bác sĩ uy tín…",
  "Tìm cơ sở y tế gần bạn…",
  "Tìm chuyên khoa phù hợp…",
];

export default function SearchBar() {
  const API = import.meta.env.VITE_API_BASE_URL;
  const nav = useNavigate();

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(-1);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [noData, setNoData] = useState(false);

  const boxRef = useRef(null);
  const abortRef = useRef(null);


  const [phText, setPhText] = useState("");
  const [phIdx, setPhIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (q.trim()) return; // user đang gõ → dừng typing

    const current = PLACEHOLDERS[phIdx];
    let timeout;

    if (!isDeleting) {
      // typing
      timeout = setTimeout(() => {
        setPhText(current.slice(0, charIdx + 1));
        setCharIdx(charIdx + 1);

        if (charIdx + 1 === current.length) {
          // gõ xong → đứng 1 chút rồi xóa
          setTimeout(() => setIsDeleting(true), 1200);
        }
      }, 70);
    } else {
      // deleting
      timeout = setTimeout(() => {
        setPhText(current.slice(0, charIdx - 1));
        setCharIdx(charIdx - 1);

        if (charIdx - 1 === 0) {
          setIsDeleting(false);
          setPhIdx((i) => (i + 1) % PLACEHOLDERS.length);
        }
      }, 40);
    }

    return () => clearTimeout(timeout);
  }, [charIdx, isDeleting, phIdx, q]);

  const norm = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();

  // đóng dropdown khi click ra ngoài
  useEffect(() => {
    const h = (e) => {
      if (!boxRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // debounce + fetch gợi ý từ BE
  useEffect(() => {
    const keyword = q.trim();

    if (!keyword) {
      setItems([]);
      setOpen(false);
      setNoData(false);
      return;
    }

    const t = setTimeout(async () => {
      try {
        abortRef.current?.abort?.();
        const ctrl = new AbortController();
        abortRef.current = ctrl;

        setLoading(true);
        setOpen(true);
        setNoData(false);

        const k = encodeURIComponent(keyword);

        // 1) endpoint hợp nhất (nếu có)
        let data, ok = false;
        const r = await fetch(`${API}/search/suggest?q=${k}`, { signal: ctrl.signal }).catch(() => null);
        if (r && r.ok) {
          data = await r.json();
          ok = true;
        }

        // 2) fallback riêng lẻ
        if (!ok) {
          const [d, h] = await Promise.all([
            fetch(`${API}/search/doctors?search=${k}&limit=5`, { signal: ctrl.signal }).then(r => r.ok ? r.json() : { items: [] }),
            fetch(`${API}/search/hospitals?search=${k}&limit=5`, { signal: ctrl.signal }).then(r => r.ok ? r.json() : { items: [] }),
          ]);

          // Chuyên khoa: thử cả ?search= và ?q=, rồi gộp + khử trùng lặp → lọc client theo từ khóa (fuzzy)
          const [s1, s2] = await Promise.all([
            fetch(`${API}/search/specialties?search=${k}&limit=10`, { signal: ctrl.signal }).then(r => r.ok ? r.json() : { items: [] }),
            fetch(`${API}/search/specialties?q=${k}&limit=10`, { signal: ctrl.signal }).then(r => r.ok ? r.json() : { items: [] }),
          ]);

          const seen = new Set();
          const specialtiesRaw = [...(s1.items || []), ...(s2.items || [])].filter(x => {
            const id = x.id ?? x.name;
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          });

          // lọc mềm theo từ khóa, không phân biệt dấu/hoa thường
          const nk = norm(keyword);
          const specialties = specialtiesRaw.filter(x => norm(x.name).includes(nk));

          data = {
            doctors: d.items || [],
            hospitals: h.items || [],
            specialties,
          };
        }

        // Lắp danh sách gợi ý (giới hạn 8)
        const next = [
          ...(data.doctors || []).map(x => ({
            type: "Bác sĩ",
            id: x.id,
            label: x.full_name,
            sub: [x.specialty_name, x.hospital_name].filter(Boolean).join(" • "),
            value: x.full_name,
          })),
          ...(data.hospitals || []).map(x => ({
            type: "Cơ sở",
            id: x.id,
            label: x.name,
            sub: x.address || "",
            value: x.name,
          })),
          ...(data.specialties || []).map(x => ({
            type: "Chuyên khoa",
            id: x.id,
            label: x.name,
            sub: "",
            value: x.name,
          })),
        ].slice(0, 10);

        setItems(next);
        setIdx(-1);
        setNoData(next.length === 0);
      } catch {
        setItems([]);
        setNoData(true);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => clearTimeout(t);
  }, [q, API]);

  // điều hướng: item -> route đích; nếu không phải item thì rơi về trang search tổng
  const go = (itOrVal) => {
    if (itOrVal && typeof itOrVal === "object") {
      const it = itOrVal;
      setOpen(false);
      if (it.type === "Bác sĩ" && it.id) return nav(`/doctors/${it.id}`);
      if (it.type === "Cơ sở" && it.id) return nav(`/hospitals/${it.id}`);
      if (it.type === "Chuyên khoa" && it.id) return nav(`/doctors?specialty=${it.id}`);
      const keyword = (it.value || it.label || "").trim();
      return nav(`/search?q=${encodeURIComponent(keyword)}`);
    }
    const keyword = (itOrVal ?? q).trim();
    if (!keyword) return;
    setOpen(false);
    nav(`/search?q=${encodeURIComponent(keyword)}`);
  };

  const onKey = (e) => {
    if (!open || items.length === 0) {
      if (e.key === "Enter") { e.preventDefault(); go(); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx(i => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx(i => Math.max(i - 1, -1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const it = idx >= 0 ? items[idx] : null;
      go(it ?? q);                 // dùng object nếu đang chọn một item
    }
    else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <div className="search-container" ref={boxRef}>
      <div className="search-wrap">
        <form className="search-form" onSubmit={(e) => { e.preventDefault(); go(); }}>
          <div className="search-input-wrapper">
            <span className="search-icon">🔎 </span>
            <input
              className="search-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setOpen(q.trim().length > 0)}
              onKeyDown={onKey}
              placeholder={phText}
            />
          </div>
          {/* <button className="search-btn" type="submit">Tìm kiếm</button> */}
        </form>

        {open && (
          <div className="search-dropdown">
            {loading ? (
              <div className="sd-empty">Đang tìm…</div>
            ) : noData ? (
              <div className="sd-empty">Không có dữ liệu</div>
            ) : (
              items.map((r, i) => (
                <button
                  key={`${r.type}-${r.id ?? r.label}-${i}`}
                  className={"sd-item" + (i === idx ? " active" : "")}
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => go(r)}
                  type="button"
                >
                  <span className="sd-badge">
                    {r.type === "Bác sĩ" ? "👨‍⚕️" : r.type === "Cơ sở" ? "🏥" : "🩺"}
                  </span>
                  <div className="sd-text">
                    <div className="sd-label">{r.label}</div>
                    {r.sub && <div className="sd-sub">{r.sub}</div>}
                  </div>
                  <span className="sd-group">{r.type}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
