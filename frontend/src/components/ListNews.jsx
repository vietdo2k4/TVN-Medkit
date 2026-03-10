import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

/** Khối Tin tức y tế (ngẫu nhiên, ưu tiên bài có ảnh) */
export default function HomeNews({ limit = 6, pageSize = 24, className = "" }) {
    const API = useMemo(
        () => (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, ""),
        []
    );
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    // fetch 3 danh mục, trộn + ưu tiên bài có ảnh
    useEffect(() => {
        let stop = false;
        const pick = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
        const fmt = (s) => (s ? new Date(s).toLocaleDateString("vi-VN") : "");

        (async () => {
            setLoading(true);
            try {
                const mk = (cat) => `${API}/news?category=${cat}&page=1&page_size=${pageSize}`;
                const asJson = async (r) => (r.ok ? r.json() : { rows: [] });

                const [r1, r2, r3] = await Promise.all([fetch(mk("service")), fetch(mk("domestic")), fetch(mk("world"))]);
                const [a, b, c] = await Promise.all([asJson(r1), asJson(r2), asJson(r3)]);
                const all = [...(a.rows || []), ...(b.rows || []), ...(c.rows || [])];

                const withCover = all.filter((x) => x.cover_url);
                const without = all.filter((x) => !x.cover_url);
                const chosen = [...pick(withCover, limit), ...pick(without, limit)].slice(0, limit);

                if (!stop) setRows(chosen.map((x) => ({ ...x, _date: fmt(x.published_at) })));
            } catch {
                if (!stop) setRows([]);
            } finally {
                if (!stop) setLoading(false);
            }
        })();

        return () => { stop = true; };
    }, [API, limit, pageSize]);

    return (
        <section className={`container home-news ${className}`}>
            <div className="home-news__header">
                <h2 className="section__title">TIN TỨC Y TẾ</h2>
                <Link className="home-news__more" to="/news/service">Xem tất cả →</Link>
            </div>

            <div className="home-news-grid">
                {loading
                    ? Array.from({ length: limit }).map((_, i) => <div key={i} className="hn-card skeleton" />)
                    : rows.map((n, i) => (
                        <article key={i} className="hn-card">
                            {n.cover_url && <img src={n.cover_url} alt="" loading="lazy" />}
                            <h3 className="hn-title">{n.title}</h3>
                            <p className="hn-meta">
                                <span>{n.source || "Nguồn"}</span>
                                {n._date && <span className="dot">•</span>}
                                {n._date && <time>{n._date}</time>}
                            </p>
                            <a className="hn-link" href={n.url} target="_blank" rel="noopener noreferrer">Đọc tại nguồn →</a>
                        </article>
                    ))
                }
            </div>

            {/* CSS inline */}
            <style>{`
        .home-news{ margin-top:32px; }
        .home-news__header{ display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; gap:16px; }
        .home-news__more{ font-weight:700; color:#0ea5e9; white-space:nowrap; }

        .home-news-grid{ display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:18px; position:relative; z-index:1; }
        @media (max-width:1024px){ .home-news-grid{ grid-template-columns:repeat(2, minmax(0,1fr)); } }
        @media (max-width:640px){ .home-news-grid{ grid-template-columns:1fr; } }

        .hn-card{ background:#fff; border-radius:16px; padding:12px; box-shadow:0 2px 10px rgba(15,23,42,.06); display:flex; flex-direction:column; min-height:220px; }
        .hn-card img{ width:100%; aspect-ratio:16/9; object-fit:cover; border-radius:12px; }
        .hn-title{ font-size:16px; line-height:1.35; margin:10px 0 6px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .hn-meta{ color:#64748b; font-size:12px; display:flex; align-items:center; gap:6px; margin:0 0 8px; }
        .hn-meta .dot{ opacity:.7; }
        .hn-link{ margin-top:auto; font-weight:700; color:#0ea5e9; }

        .skeleton{ background:linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 37%,#f3f4f6 63%); background-size:400% 100%; animation:shimmer 1.4s infinite; border-radius:16px; height:220px; }
        @keyframes shimmer{ 0%{background-position:100% 0} 100%{background-position:0 0} }
      `}</style>
        </section>
    );
}