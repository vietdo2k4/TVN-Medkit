import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

// tabs cố định
const TABS = [
    { key: "service", label: "Tin dịch vụ" },
    { key: "domestic", label: "Tin y tế trong nước" },
    { key: "world", label: "Tin y tế thế giới" },
];

export default function NewsListPage() {
    const { category } = useParams();                       // tabs
    const cat = TABS.some(t => t.key === category) ? category : "service";

    const [sp, setSp] = useSearchParams();                  // pagination
    const page = useMemo(() => Number(sp.get("page") || 1), [sp]);

    const [rows, setRows] = useState([]);                   // data
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    const API = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

    // fetch: gọi API đọc tin theo category + trang
    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const url = `${API}/news?category=${cat}&page=${page}&page_size=12`;
                const r = await fetch(url);
                const d = r.ok ? await r.json() : { rows: [], total: 0 };
                setRows(d.rows || []);
                setTotal(d.total || 0);
            } catch (err) {
                console.error("[news] fetch failed", { API, cat, page, err });
                setRows([]); setTotal(0);
            } finally {
                setLoading(false);
            }
        })();
    }, [API, cat, page]);

    // SEO title: đổi theo tab
    useEffect(() => {
        const label = TABS.find(t => t.key === cat)?.label || "";
        document.title = `Tin tức y khoa – ${label}`;
    }, [cat]);

    const pages = Math.max(1, Math.ceil(total / 12));

    // render
    return (
        <div className="container" style={{ padding: "24px 0 48px" }}>
            {/* tabs */}
            <div className="news-tabs">
                {TABS.map(t => (
                    <Link key={t.key}
                        to={`/news/${t.key}`}
                        className={"news-tab" + (t.key === cat ? " active" : "")}>
                        {t.label}
                    </Link>
                ))}
            </div>

            {/* grid list / skeleton */}
            <div className="news-grid">
                {loading
                    ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="news-card skeleton" />)
                    : rows.map((n, i) => (
                        <article key={i} className="news-card">
                            {n.cover_url && <img src={n.cover_url} alt="" loading="lazy" />}
                            <h3 className="title">{n.title}</h3>
                            <p className="summary">{n.summary}</p>
                            <div className="meta">
                                <span className="src">{n.source || "Nguồn"}</span>
                                {n.published_at && <span className="dot">•</span>}
                                {n.published_at && <time>{new Date(n.published_at).toLocaleDateString("vi-VN")}</time>}
                            </div>
                            <a className="read" href={n.url} target="_blank" rel="noopener noreferrer">Đọc tại nguồn →</a>
                        </article>
                    ))
                }
            </div>

            {/* pagination */}
            {pages > 1 && (
                <div className="news-pages">
                    <button disabled={page <= 1} onClick={() => setSp({ page: String(page - 1) })}>← Trước</button>
                    <span className="counter">{page}/{pages}</span>
                    <button disabled={page >= pages} onClick={() => setSp({ page: String(page + 1) })}>Sau →</button>
                </div>
            )}

            {/* styles: tabs, grid, card, skeleton, responsive */}
            <style>{`
                    .news-tabs{ display:flex; gap:12px; margin:12px 0 18px; flex-wrap:wrap; }
                    .news-tab{
                    padding:10px 16px; border-radius:999px;
                    background:#f1f5f9; color:#0f3552; border:1px solid #e2e8f0;
                    font-weight:600; line-height:1; transition:all .18s ease; box-shadow:0 1px 0 rgba(2,6,23,.04);
                    }
                    .news-tab:hover{ background:#eaf2fb; border-color:#dbeafe; }
                    .news-tab:focus{ outline:3px solid #bfdbfe; outline-offset:2px; }
                    .news-tab.active{
                    background:#2563eb;
                    border-color:#1d4ed8; color:#fff;
                    box-shadow:0 6px 18px rgba(37,99,235,.28);
                    }

            
                    .news-grid{ display:grid; grid-template-columns: repeat(3,1fr); gap:16px; position:relative; z-index:1; }
                    .news-card{ background:#fff; border-radius:16px; padding:12px; box-shadow:0 2px 10px rgba(15,23,42,.06); display:flex; flex-direction:column; }
                    .news-card img{ width:100%; aspect-ratio:16/9; object-fit:cover; border-radius:12px; }
                    .news-card .title{ font-size:18px; line-height:1.3; margin:10px 0 6px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
                    .news-card .summary{ color:#334155; font-size:14px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; min-height:40px; }
                    .news-card .meta{ color:#64748b; font-size:12px; display:flex; align-items:center; gap:6px; margin:6px 0 8px; }
                    .news-card .read{ margin-top:auto; font-weight:700; color:#0ea5e9; }
                    .skeleton{ background:linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 37%,#f3f4f6 63%); background-size:400% 100%; animation:shimmer 1.4s infinite; height:180px; border-radius:16px;}
                    @keyframes shimmer{0%{background-position:100% 0}100%{background-position:0 0}}

                    /* pagination: gọn, đồng bộ */
                    .news-pages{ display:flex; gap:12px; align-items:center; justify-content:center; margin-top:22px; }
                    .news-pages .counter{ min-width:72px; text-align:center; font-weight:700; color:#0f3552; }
                    .news-pages button{
                    padding:8px 14px; border-radius:10px; font-weight:600;
                    background:#fff; color:#0f3552; border:1px solid #cbd5e1;
                    box-shadow:0 1px 0 rgba(2,6,23,.04); transition:all .18s ease;
                    }
                    .news-pages button:hover{ background:#f8fafc; border-color:#94a3b8; }
                    .news-pages button:focus{ outline:3px solid #bfdbfe; outline-offset:2px; }
                    .news-pages button[disabled]{ opacity:.5; cursor:not-allowed; background:#f1f5f9; border-color:#e2e8f0; color:#94a3b8; }

                    /* responsive */
                    @media (max-width: 1024px){ .news-grid{ grid-template-columns: repeat(2,1fr); } }
                    @media (max-width: 640px){ .news-grid{ grid-template-columns: 1fr; } }
            `}</style>
        </div>
    );
}