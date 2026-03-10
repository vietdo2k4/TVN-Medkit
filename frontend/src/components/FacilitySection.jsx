import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { IconLocation} from "../components/icons/MedicalInfoIcons";
import "../styles/doctor.css";
import "../styles/facility.css";

export default function FacilitySection() {
    const API = import.meta.env.VITE_API_BASE_URL;
    const nav = useNavigate();
    const trackRef = useRef(null);
    const [items, setItems] = useState([]);

    useEffect(() => {
        const el = trackRef.current;
        if (!el || items.length === 0) return;

        const card = el.querySelector(".hos-card");
        if (!card) return;

        const gap = 22;
        const step = card.offsetWidth + gap;

        const timer = setInterval(() => {
            const maxScroll = el.scrollWidth - el.clientWidth;

            if (el.scrollLeft + step >= maxScroll) {
                el.scrollTo({ left: 0, behavior: "smooth" });
            } else {
                el.scrollBy({ left: step, behavior: "smooth" });
            }
        }, 5000);

        return () => clearInterval(timer);
    }, [items]);


    useEffect(() => {
        let ok = true;
        (async () => {
            try {
                const r = await fetch(`${API}/hospitals/featured?limit=12`);
                const data = r.ok ? await r.json() : [];
                if (ok) setItems(Array.isArray(data) ? data : []);
            } catch { if (ok) setItems([]); }
        })();
        return () => { ok = false; };
    }, [API]);

    const scrollByCard = (dir) => {
        const el = trackRef.current;
        if (!el) return;

        const card = el.querySelector(".hos-card");
        if (!card) return;

        const gap = 22;
        const step = card.offsetWidth + gap;

        el.scrollBy({
            left: dir * step,
            behavior: "smooth",
        });
    };


    return (
        <section className="container">
            <h2 className="section__title">Cơ sở y tế nổi bật</h2>

            <div className="doc-carousel">
                <button className="doc-arrow doc-arrow--left" onClick={() => scrollByCard(-1)} aria-label="Prev">‹</button>

                <div className="doc-track" ref={trackRef}>
                    {items.map((h) => (
                        <article key={h.id} className="hos-card" onClick={() => nav(`/hospitals/${h.id}`)} style={{ cursor: "pointer" }}>
                            <div className="hos-top">
                                <img
                                    className="hos-img"
                                    src={h.image_url || "/assets/images/hospital.png"}
                                    alt={h.name}
                                    onError={(e) => (e.currentTarget.src = "/assets/images/hospital.png")}
                                />
                            </div>

                            <div className="hos-body" onClick={(e) => e.stopPropagation()}>
                                <h3 className="hos-name">{h.name}</h3>

                                <div className="hos-line hos-addr">
                                    <span><IconLocation /></span>
                                    <span className="hos-addr-text">{h.address || "Đang cập nhật"}</span>
                                </div>

                                <div className="hos-line hos-stars">
                                    <span className="stars__value">{(Number(h.rating_avg) || 0).toFixed(1)}</span>
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <span key={i} className={"star" + (i < Math.round(Number(h.rating_avg) || 0) ? " is-on" : "")}>★</span>
                                    ))}
                                </div>

                                <button className="doc-btn hos-btn" onClick={() => nav(`/hospitals/${h.id}`)}>
                                    Đặt khám ngay
                                </button>
                            </div>
                        </article>
                    ))}
                </div>

                <button className="doc-arrow doc-arrow--right" onClick={() => scrollByCard(1)} aria-label="Next">›</button>
            </div>

            <div className="center">
                <Link className="see-all-btn" to="/hospitals">Xem tất cả</Link>
            </div>
        </section>
    );
}
