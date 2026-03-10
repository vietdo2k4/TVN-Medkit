import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { IconSpecialty, IconFee, IconHospital } from "../components/icons/MedicalInfoIcons";
import "../styles/doctor.css";

export default function DoctorBookingSection() {
    const API = import.meta.env.VITE_API_BASE_URL;
    const nav = useNavigate();
    const trackRef = useRef(null);
    const [items, setItems] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                const r = await fetch(`${API}/doctors/featured?limit=12`);
                const data = r.ok ? await r.json() : [];
                setItems((Array.isArray(data) ? data : data.items || []).slice(0, 12));
            } catch {
                setItems([]);
            }
        })();
    }, [API]);

    //Danh sách bác sĩ tự động chạy từng card 1 
    useEffect(() => {
        const el = trackRef.current;
        if (!el || items.length === 0) return;

        const card = el.querySelector(".doc-card");
        if (!card) return;

        const gap = 22;
        const step = card.offsetWidth + gap;

        const timer = setInterval(() => {
            const maxScroll = el.scrollWidth - el.clientWidth;

            if (el.scrollLeft + step >= maxScroll) {
                // quay về đầu
                el.scrollTo({ left: 0, behavior: "smooth" });
            } else {
                el.scrollBy({ left: step, behavior: "smooth" });
            }
        }, 5000);

        return () => clearInterval(timer);
    }, [items]);

    const scrollByCard = (dir) => {
        const el = trackRef.current;
        if (!el) return;

        const card = el.querySelector(".doc-card");
        if (!card) return;

        const gap = 22; // đúng với CSS
        const step = card.offsetWidth + gap;

        el.scrollBy({
            left: dir * step,
            behavior: "smooth",
        });
    };
    return (
        <section className="container">
            <h2 className="section__title">Đặt lịch bác sĩ</h2>

            <div className="doc-carousel">
                <button className="doc-arrow doc-arrow--left" onClick={() => scrollByCard(-1)}>‹</button>

                <div className="doc-track" ref={trackRef}>
                    {items.map((d) => (
                        <article key={d.id} className="doc-card">
                            <div className="doc-top">
                                <img
                                    className="doc-cover"
                                    src={d.avatar || d.avatar_url || "/assets/images/doctor.png"}
                                    alt={d.full_name}
                                    loading="lazy"
                                    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/assets/images/doctor.png"; }}
                                />
                            </div>

                            <div className="doc-meta doc-meta--center">
                                <span className="stars">
                                    <span className="stars__value">{(Number(d.rating_avg) || 0).toFixed(1)}</span>
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <span
                                            key={i}
                                            className={"star" + (i < Math.round(Number(d.rating_avg) || 0) ? " is-on" : "")}
                                        >
                                            ★
                                        </span>
                                    ))}
                                </span>
                            </div>

                            <div className="doc-body">
                                <h3 className="doc-name">{d.full_name}</h3>
                                <p className="doc-line"><IconSpecialty /> {d.specialty_name || "—"}</p>
                                <p className="doc-line"><IconFee /> {d.fee_min != null ? Number(d.fee_min).toLocaleString("vi-VN") + "đ" : "—"}</p>
                                <p className="doc-line"><IconHospital /> {d.hospital_name || "—"}</p>

                                {/* đổi đường dẫn tại đây */}
                                <button
                                    className="doc-btn"
                                    onClick={() => nav(`/doctors/${encodeURIComponent(d.id)}`)}
                                >
                                    Đặt lịch ngay
                                </button>
                            </div>
                        </article>
                    ))}
                </div>

                <button className="doc-arrow doc-arrow--right" onClick={() => scrollByCard(1)}>›</button>
            </div>

            <div className="center">
                <Link className="see-all-btn" to="/doctors">Xem tất cả</Link>
            </div>
        </section>
    );
}
