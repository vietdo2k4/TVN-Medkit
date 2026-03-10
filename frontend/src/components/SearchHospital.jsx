import { useEffect, useMemo, useState } from "react";

export default function SearchHospital({
    value = "",
    region = "",
    specialty = "",
    onChange = () => { },
    onSearch = () => { },
    onClear = () => { },
}) {
    const API = import.meta.env.VITE_API_BASE_URL;

    // specialties for filter
    const [list, setList] = useState([]);
    useEffect(() => {
        let ok = true;
        (async () => {
            try {
                const r = await fetch(`${API}/specialties`);
                const json = r.ok ? await r.json() : [];
                if (ok) setList(Array.isArray(json) ? json : []);
            } catch {
                setList([]);
            }
        })();
        return () => { ok = false; };
    }, [API]);

    const regOptions = useMemo(() => ([
        { label: "Tất cả khu vực", value: "" },
        { label: "Miền Bắc", value: "north" },
        { label: "Miền Trung", value: "central" },
        { label: "Miền Nam", value: "south" },
    ]), []);

    return (
        <div style={{ display: "grid", gap: 12 }}>
            {/* Big search bar */}
            <form
                onSubmit={(e) => { e.preventDefault(); onSearch(value); }}
                style={{ display: "flex", gap: 10, alignItems: "center" }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        background: "#fff",
                        borderRadius: 999,
                        padding: "12px 14px",
                        boxShadow: "0 10px 26px rgba(8,60,120,.08)",
                        width: "100%",
                        maxWidth: 920,
                        margin: "0 auto",
                    }}
                >
                    <span style={{ marginLeft: 6, marginRight: 6 }}>🔎</span>
                    <input
                        value={value}
                        onChange={(e) => onChange({ q: e.target.value })}
                        placeholder="Tìm cơ sở, địa chỉ, chuyên khoa…"
                        style={{
                            border: "none",
                            outline: "none",
                            flex: 1,
                            fontSize: 16,
                            color: "#0a2f5a",
                            background: "transparent",
                        }}
                    />
                </div>
            </form>

            {/* Filters */}
            <div
                style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                <SelectNice
                    value={region}
                    onChange={(v) => onChange({ region: v })}
                    ariaLabel="Lọc khu vực"
                >
                    {regOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </SelectNice>

                <SelectNice
                    value={specialty}
                    onChange={(v) => onChange({ specialty: v })}
                    ariaLabel="Lọc chuyên khoa"
                >
                    <option value="">Tất cả chuyên khoa</option>
                    {list.map((sp) => (
                        <option key={sp.id} value={sp.id}>{sp.name}</option>
                    ))}
                </SelectNice>

                {(value || region || specialty) && (
                    <button
                        type="button"
                        className="nh-btn-clear"
                        onClick={onClear}
                    >
                        Xóa lọc
                    </button>
                )}
            </div>

            {/* Inline CSS */}
            <style>{`
        .nh-wrap {
          position: relative;
          display: inline-block;
        }
        .nh-select {
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          background: #fff;
          border-radius: 999px;
          padding: 10px 40px 10px 14px; /* chừa chỗ cho mũi tên */
          min-width: 220px;
          border: 1px solid #e6eef8;
          color: #0a2f5a;
          font-weight: 700;
          box-shadow: 0 10px 26px rgba(8,60,120,.05);
          outline: none;
          cursor: pointer;
        }
        .nh-select::-ms-expand { display: none; }
        .nh-arrow {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          color: #2b74b9;
          font-size: 14px;
          font-weight: 900;
        }
        .nh-select option { font-weight: 600; }

        /* Nút Xóa lọc cùng style pill với select */
        .nh-btn-clear {
          appearance: none;
          background: #fff;
          border: 1px solid #e6eef8;
          border-radius: 999px;
          padding: 10px 18px;           /* cùng chiều cao với select */
          color: #0a2f5a;
          font-weight: 700;
          box-shadow: 0 10px 26px rgba(8,60,120,.05);
          cursor: pointer;
          line-height: 1;
          transition: transform .05s ease, box-shadow .15s ease, background .15s ease;
        }
        .nh-btn-clear:hover {
          box-shadow: 0 14px 30px rgba(8,60,120,.08);
          background: #f9fcff;
        }
        .nh-btn-clear:active { transform: translateY(0) scale(.99); }

        @media (max-width: 768px) {
          .nh-select { width: 100%; }
        }
      `}</style>
        </div>
    );
}

/** Select “pill + shadow” có mũi tên tuỳ biến */
function SelectNice({ value, onChange, ariaLabel, children }) {
    return (
        <div className="nh-wrap">
            <select
                aria-label={ariaLabel}
                className="nh-select"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                {children}
            </select>
            <span className="nh-arrow">▾</span>
        </div>
    );
}
