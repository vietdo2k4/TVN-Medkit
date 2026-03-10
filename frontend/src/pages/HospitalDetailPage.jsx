// src/pages/HospitalDetailPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { IconLocation, IconPhone } from "../components/icons/MedicalInfoIcons";
import "../styles/doctor.css";
import "../styles/hospital-detail.css";

export default function HospitalDetailPage() {
    const { id } = useParams();
    const API = import.meta.env.VITE_API_BASE_URL;
    const nav = useNavigate();

    //useState: Lưu thông tin chi tiết bệnh viện (tên, địa chỉ, rating, specialties, details...)
    const [data, setData] = useState(null);

    //useState: Đánh dấu đang fetch dữ liệu từ API - hiển thị "Đang tải..."
    const [loading, setLoading] = useState(true);

    //useState: ID của chuyên khoa đang được mở (expand panel để xem danh sách bác sĩ)
    const [openSpecId, setOpenSpecId] = useState(null);

    //useState: ID của chuyên khoa đang load danh sách bác sĩ - hiển thị loading trong panel
    const [loadingSpecId, setLoadingSpecId] = useState(null);

    //useState: Cache danh sách bác sĩ theo chuyên khoa - object {specId: [doctors]}
    //Tránh fetch lại khi user mở/đóng panel nhiều lần
    const [specCache, setSpecCache] = useState({});

    // mở/đóng panel theo chuyên khoa + cache danh sách bác sĩ
    async function toggleSpec(spec) {
        if (openSpecId === spec.id) { setOpenSpecId(null); return; }      // đóng nếu đang mở
        if (specCache[spec.id]) { setOpenSpecId(spec.id); return; }       // có cache -> mở ngay

        setLoadingSpecId(spec.id);
        try {
            const r = await fetch(`${API}/hospitals/${id}/doctors?specialty_id=${spec.id}`);
            const json = r.ok ? await r.json() : [];
            setSpecCache(prev => ({ ...prev, [spec.id]: json || [] }));
            setOpenSpecId(spec.id);
        } finally {
            setLoadingSpecId(null);
        }
    }

    //useEffect: Scroll lên đầu trang khi chuyển sang bệnh viện khác (id thay đổi)
    //Dependencies: [id] - chỉ chạy khi user navigate đến hospital detail khác
    useEffect(() => { window.scrollTo(0, 0); }, [id]);

    //useEffect: Fetch chi tiết bệnh viện từ API khi component mount hoặc id thay đổi
    //Dependencies: [API, id] - chạy lại khi user xem bệnh viện khác
    //Dùng IIFE async để có thể dùng await, cleanup flag "ok" để tránh set state sau unmount
    useEffect(() => {
        let ok = true;
        (async () => {
            setLoading(true);
            try {
                const res = await fetch(`${API}/hospitals/${id}`);
                const json = res.ok ? await res.json() : null;
                if (ok) setData(json);
            } catch {
                if (ok) setData(null);
            } finally {
                if (ok) setLoading(false);
            }
        })();
        return () => { ok = false; };
    }, [API, id]);

    //useMemo: Parse mô tả bệnh viện thành danh sách items {label, body}
    //Dependencies: [data?.details] - chỉ parse lại khi details thay đổi
    //Format: "• Label: Body" hoặc "- Label: Body" → [{label: "Label", body: "Body"}]
    const detailItems = useMemo(() => {
        const raw = String(data?.details || "").trim();
        if (!raw) return [];
        const t = raw.replace(/\r\n/g, "\n").replace(/\u2022/g, "•");
        const parts = t.split(/(?:^|\n)\s*(?:•|-)\s*/).filter(Boolean);
        return parts.map(s => {
            const x = s.trim().replace(/^[•-]\s*/, "");
            const m = x.match(/^([^:]+):\s*(.*)$/);
            if (m) return { label: m[1].trim(), body: m[2].trim() };
            return { label: null, body: x };
        });
    }, [data?.details]);

    //useMemo: Lấy danh sách ảnh cho slideshow - ưu tiên ảnh từ DB, fallback về image_url, cuối cùng là ảnh mặc định
    //Dependencies: [data] - chỉ tính lại khi data bệnh viện thay đổi
    const photos = useMemo(() => {
        if (!data) return [];
        const fromDB = (data.photos || []).map(p => p.image_url).filter(Boolean);
        if (fromDB.length) return fromDB;
        if (data.image_url) return [data.image_url];
        return ["/assets/hospitals/benh-vien-dai-hoc-y-ha-noi.jpg"];
    }, [data]);

    //useState: Index ảnh hiện tại trong slideshow (0-based)
    const [idx, setIdx] = useState(0);

    //useEffect: Reset slideshow về ảnh đầu tiên khi đổi bệnh viện hoặc danh sách ảnh thay đổi
    //Dependencies: [id, photos.length] - chạy lại khi id hoặc số lượng ảnh thay đổi
    useEffect(() => { setIdx(0); }, [id, photos.length]);
    const prev = () => { if (photos.length) setIdx(i => (i + photos.length - 1) % photos.length); };
    const next = () => { if (photos.length) setIdx(i => (i + 1) % photos.length); };

    if (loading) return <div className="container">Đang tải…</div>;
    if (!data) return <div className="container">Không tìm thấy bệnh viện.</div>;

    const rating = Number(data.rating_avg || 0);

    // === Parse mô tả thành các mục: "Nhãn: Nội dung" ===


    return (
        <div className="container" style={{ padding: "24px 0 40px" }}>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 360px) minmax(0, 1fr)",
                    gap: 16,
                }}
            >
                {/* CARD BÊN TRÁI (tên + sao) */}
                <aside
                    style={{
                        background: "#fff",
                        borderRadius: 18,
                        padding: 14,
                        boxShadow: "0 12px 22px rgba(8,60,120,.06)",
                        alignSelf: "flex-start",
                    }}
                >
                    <div style={{ display: "grid", placeItems: "center", marginBottom: 10 }}>
                        <img
                            src={data.image_url || "/assets/hospitals/benh-vien-dai-hoc-y-ha-noi.jpg"}
                            alt={data.name}
                            style={{ width: 220, height: 130, objectFit: "cover", borderRadius: 12, border: "1px solid #eef4fc" }}
                            onError={e => { e.currentTarget.src = "/assets/hospitals/benh-vien-dai-hoc-y-ha-noi.jpg"; }}
                        />
                    </div>

                    <h1
                        style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, color: "#0a2f5a", textAlign: "center" }}
                    >
                        {data.name}
                    </h1>

                    <div style={{ display: "flex", justifyContent: "center", gap: 2, marginBottom: 8 }}>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <span key={i} style={{ color: i < Math.round(rating) ? "#ffb800" : "#cfd8e3", fontSize: 18 }}>★</span>
                        ))}
                    </div>

                    <div style={{ display: "flex", gap: 8, marginBottom: 4, color: "#47627b" }}>
                        <span><IconLocation /></span>
                        <span>{data.address || "Đang cập nhật"}</span>
                    </div>

                    {data.phone && (
                        <div style={{ display: "flex", gap: 8, marginBottom: 8, color: "#47627b" }}>
                            <span><IconPhone /></span>
                            <a href={`tel:${data.phone}`}>{data.phone}</a>
                        </div>
                    )}
                </aside>

                {/* ẢNH PHỤ BÊN PHẢI */}
                <section
                    style={{
                        background: "#f7fbff",
                        borderRadius: 18,
                        padding: 10,
                        boxShadow: "0 12px 22px rgba(8,60,120,.06)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                    }}
                >
                    <div
                        style={{
                            position: "relative",
                            borderRadius: 16,
                            overflow: "hidden",
                            background: "#dbeafe",
                            width: "100%",
                            height: 420,
                        }}
                    >
                        {photos.length > 0 && (
                            <img
                                src={photos[idx]}
                                alt={`Ảnh bệnh viện ${idx + 1}`}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                onError={e => { e.currentTarget.src = "/assets/hospitals/benh-vien-dai-hoc-y-ha-noi.jpg"; }}
                            />
                        )}

                        {photos.length > 1 && (
                            <>
                                <button
                                    className="doc-arrow doc-arrow--left"
                                    style={{ position: "absolute", top: "50%", left: 16, transform: "translateY(-50%)" }}
                                    onClick={prev}
                                >
                                    ‹
                                </button>

                                <button
                                    className="doc-arrow doc-arrow--right"
                                    style={{ position: "absolute", top: "50%", right: 16, transform: "translateY(-50%)" }}
                                    onClick={next}
                                >
                                    ›
                                </button>

                                <div
                                    style={{
                                        position: "absolute",
                                        bottom: 10,
                                        left: "50%",
                                        transform: "translateX(-50%)",
                                        display: "flex",
                                        gap: 6,
                                    }}
                                >
                                    {photos.map((_, i) => (
                                        <span
                                            key={i}
                                            onClick={() => setIdx(i)}
                                            style={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: "50%",
                                                cursor: "pointer",
                                                background: i === idx ? "#1194e8" : "#cfe8ff",
                                            }}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    <div style={{ color: "#194569", fontSize: 15 }}>
                        <div>• Khám, tư vấn bởi bác sĩ chuyên khoa</div>
                        <div>• Trang thiết bị hiện đại</div>
                        <div>• Quy trình nhanh chóng, minh bạch</div>
                    </div>
                </section>
            </div>

            {/* CÁC CHUYÊN KHOA */}
            <section className="hservices">
                <h2 className="hsec__title">CÁC CHUYÊN KHOA</h2>

                <div className="sp-grid">
                    {(data.specialties || []).map((sp) => (
                        <button
                            key={sp.id}
                            className="sp-card"
                            onClick={() => toggleSpec(sp)}
                            title={sp.name}
                            aria-expanded={openSpecId === sp.id}
                        >
                            <div className="sp-iconwrap">
                                <img
                                    src={sp.icon_path}
                                    alt={sp.name}
                                    onError={(e) => { e.currentTarget.src = "/assets/icons/specialties/noi-tong-quat.svg"; }}
                                />
                            </div>
                            <div className="sp-name">{sp.name}</div>
                            <div className="hservice__sub" style={{ fontSize: 12, color: "#5b7a97" }}>
                                {sp.doctors_count} bác sĩ
                            </div>
                        </button>
                    ))}

                    {!data.specialties?.length && <div className="hmuted">Đang cập nhật</div>}
                </div>

                {/* PANEL xổ tại chỗ */}
                {openSpecId && (
                    <div
                        className="sp-panel"
                        style={{
                            marginTop: 14,
                            background: "#fff",
                            borderRadius: 16,
                            boxShadow: "0 10px 22px rgba(8,60,120,.06)",
                            padding: "14px 14px 8px",
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h3 style={{ margin: 0, color: "#0a2f5a" }}>
                                Bác sĩ – {(data.specialties.find(s => s.id === openSpecId) || {}).name}
                            </h3>
                            <button
                                onClick={() => setOpenSpecId(null)}
                                style={{ appearance: "none", border: 0, background: "transparent", color: "#1194e8", fontWeight: 700, cursor: "pointer" }}
                            >
                                Thu gọn ✕
                            </button>
                        </div>

                        {loadingSpecId === openSpecId && <div className="hmuted" style={{ padding: "10px 2px" }}>Đang tải…</div>}

                        {loadingSpecId !== openSpecId && (
                            <div className="hdoc__grid" style={{ marginTop: 10 }}>
                                {(specCache[openSpecId] || []).map(d => (
                                    <div key={d.id} className="hdoc">
                                        <div className="hdoc__top">
                                            <img
                                                className="hdoc__avatar"
                                                src={d.avatar || "/assets/doctors/gs_ts_pham_nhu_hiep.jpg"}
                                                alt={d.full_name}
                                                onError={e => { e.currentTarget.src = "/assets/doctors/gs_ts_pham_nhu_hiep.jpg"; }}
                                            />
                                        </div>
                                        <div className="hdoc__body">
                                            <div className="hdoc__name">{d.full_name}</div>
                                            <div className="hdoc__sub">{d.specialty_name}</div>
                                            <div className="hdoc__fee">
                                                {d.fee_min ? `${Number(d.fee_min).toLocaleString()}đ` : "—"}
                                            </div>
                                            <button className="doc-btn hdoc__btn" onClick={() => nav(`/doctors/${d.id}`)}>
                                                Đặt lịch ngay
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {!specCache[openSpecId]?.length && (
                                    <div className="hmuted" style={{ padding: "10px 2px" }}>
                                        Chưa có bác sĩ thuộc chuyên khoa này.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </section>

            {/* MÔ TẢ – hiển thị theo list, nhãn đậm */}
            <section className="habout">
                <h2 className="hsec__title">Mô tả</h2>

                {detailItems.length > 0 ? (
                    <ul className="habout__list">
                        {detailItems.map((it, i) => (
                            <li key={i}>
                                {it.label && <span className="habout__label">{it.label}:</span>}
                                <span>{it.body}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="habout__text">
                        {data.details || "Bệnh viện đang cập nhật thông tin mô tả."}
                    </p>
                )}
            </section>
        </div>
    );
}
