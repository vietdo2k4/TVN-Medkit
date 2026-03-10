/* eslint-disable react-hooks/exhaustive-deps */
// src/pages/HospitalsPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import HospitalsHero from "../components/HospitalsHero";
import SearchHospital from "../components/SearchHospital";

export default function HospitalsPage() {
    const API = import.meta.env.VITE_API_BASE_URL;
    const nav = useNavigate();
    const [sp] = useSearchParams();

    //useState: Lưu từ khóa tìm kiếm (query string) - bind với SearchHospital component
    const [q, setQ] = useState(sp.get("q") || "");

    //useState: Lưu vùng miền (region) để lọc - ví dụ: "Hà Nội", "TP.HCM"
    const [region, setRegion] = useState(sp.get("region") || "");

    //useState: Lưu chuyên khoa để lọc - ví dụ: "Thần kinh", "Tim mạch"
    const [specialty, setSpecialty] = useState(sp.get("specialty") || "");

    //useState: Trang hiện tại của pagination - bắt đầu từ 1
    const [page, setPage] = useState(Number(sp.get("page") || 1));
    const pageSize = 5;

    //useState: Lưu danh sách bệnh viện kết quả tìm kiếm - mảng object {id, name, address, image_url}
    const [rows, setRows] = useState([]);

    //useState: Tổng số kết quả tìm kiếm - dùng để tính tổng số trang
    const [total, setTotal] = useState(0);

    //useState: Đánh dấu đang fetch dữ liệu - hiển thị skeleton loading
    const [loading, setLoading] = useState(true);

    //useState: Bệnh viện đang được xem trong Quick View panel bên phải
    const [active, setActive] = useState(null);

    //useEffect: Scroll về hero section khi component mount - đảm bảo luôn bắt đầu từ đầu trang
    //Dependencies: [] - chỉ chạy 1 lần khi mount
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "instant" });
    }, []);

    //useEffect: Fetch kết quả tìm kiếm bệnh viện khi filter hoặc page thay đổi
    //Dependencies: [API, q, region, specialty, page] - chạy lại khi user thay đổi bất kỳ filter nào
    //Dùng IIFE async để fetch, cleanup flag "ok" để tránh update state sau unmount
    useEffect(() => {
        let ok = true;
        const url = new URL(`${API}/search/hospitals`);
        if (q) url.searchParams.set("q", q);
        if (region) url.searchParams.set("region", region);
        if (specialty) url.searchParams.set("specialty", specialty);
        url.searchParams.set("page", String(page));
        url.searchParams.set("pageSize", String(pageSize));

        (async () => {
            setLoading(true);
            try {
                const r = await fetch(url.toString());
                const json = await r.json();
                if (!ok) return;
                const items = Array.isArray(json.items) ? json.items : [];
                setRows(items);
                setTotal(Number(json.total || 0));
                setActive(items[0] || null);
            } catch {
                if (ok) {
                    setRows([]);
                    setTotal(0);
                    setActive(null);
                }
            } finally {
                if (ok) setLoading(false);
            }
        })();

        return () => {
            ok = false;
        };
    }, [API, q, region, specialty, page]);

    //useMemo: Tính tổng số trang từ total và pageSize - dùng cho pagination UI
    //Dependencies: [total] - chỉ tính lại khi tổng số kết quả thay đổi
    const pages = useMemo(
        () => Math.max(1, Math.ceil(total / pageSize)),
        [total]
    );

    const card = (h) => (
        <article
            key={h.id}
            onClick={() => setActive(h)}
            style={{
                display: "grid",
                gridTemplateColumns: "88px 1fr auto",
                gap: 14,
                padding: 14,
                borderRadius: 16,
                background: "#fff",
                boxShadow: "0 8px 20px rgba(8,60,120,.06)",
                cursor: "pointer",
                height: 116,
                alignItems: "center",
                transition: "transform .08s ease, box-shadow .08s ease",
            }}
            onMouseEnter={(e) =>
            (e.currentTarget.style.boxShadow =
                "0 12px 26px rgba(8,60,120,.10)")
            }
            onMouseLeave={(e) =>
            (e.currentTarget.style.boxShadow =
                "0 8px 20px rgba(8,60,120,.06)")
            }
        >
            <img
                src={h.image_url || "/assets/images/hospital.png"}
                alt={h.name}
                style={{ width: 88, height: 88, objectFit: "cover", borderRadius: 12 }}
                onError={(e) => (e.currentTarget.src = "/assets/images/hospital.png")}
            />

            <div style={{ minWidth: 0 }}>
                <div
                    style={{
                        fontWeight: 800,
                        color: "#0a2f5a",
                        marginBottom: 4,
                        fontSize: 18,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    }}
                    title={h.name}
                >
                    {h.name}
                </div>
                <div
                    style={{
                        color: "#47627b",
                        fontSize: 14,
                        display: "flex",
                        gap: 6,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    }}
                    title={h.address}
                >
                    <span>📍</span>
                    <span>{h.address || "Đang cập nhật"}</span>
                </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                    className="doc-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        nav(`/hospitals/${h.id}`);
                    }}
                >
                    Xem chi tiết
                </button>
            </div>
        </article>
    );

    return (
        <main>
            <HospitalsHero />

            {/* Thanh tìm kiếm */}
            <section className="container" style={{ marginTop: 16 }}>
                <SearchHospital
                    value={q}
                    region={region}
                    specialty={specialty}
                    onChange={(s) => {
                        setQ(s.q ?? q);
                        setRegion(s.region ?? region);
                        setSpecialty(s.specialty ?? specialty);
                        setPage(1);
                    }}
                    onSearch={(text) => {
                        setQ(text);
                        setPage(1);
                    }}
                    onClear={() => {
                        setQ("");
                        setRegion("");
                        setSpecialty("");
                        setPage(1);
                    }}
                />
            </section>

            {/* Thông báo trạng thái */}
            <section className="container" style={{ margin: "20px auto 8px" }}>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        minHeight: 42,
                    }}
                >
                    <div
                        style={{
                            padding: "10px 16px",
                            borderRadius: 9999,
                            background: "#eef7ff",
                            color: "#0a2f5a",
                            fontWeight: 800,
                            boxShadow: "0 6px 14px rgba(8,60,120,.06)",
                            textAlign: "center",
                        }}
                    >
                        {loading
                            ? "Đang tải…"
                            : total
                                ? `Đã tìm thấy ${total} cơ sở phù hợp`
                                : "Không tìm thấy cơ sở phù hợp."}
                    </div>
                </div>
            </section>

            {/* Danh sách + Quick view */}
            {(loading || rows.length > 0) && (
                <section className="container" style={{ margin: "12px auto 60px" }}>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, .75fr)",
                            gap: 16,
                            alignItems: "start",
                        }}
                    >
                        {/* LIST */}
                        <div style={{ display: "grid", gap: 12, alignContent: "start", }}>
                            {(loading ? Array.from({ length: 5 }) : rows).map((it, i) =>
                                loading ? (
                                    <div
                                        key={i}
                                        style={{
                                            height: 116,
                                            borderRadius: 16,
                                            background:
                                                "linear-gradient(90deg,#f5f9ff,#eef5ff,#f5f9ff)",
                                            animation: "shimmer 1.5s infinite",
                                        }}
                                    />
                                ) : (
                                    card(it)
                                )
                            )}

                            {pages > 1 && (
                                <div
                                    style={{
                                        display: "flex",
                                        gap: 8,
                                        justifyContent: "center",
                                        marginTop: 10,
                                    }}
                                >
                                    <button
                                        className="see-all-btn"
                                        disabled={page <= 1}
                                        onClick={() => setPage((p) => p - 1)}
                                        title="Trang trước"
                                    >
                                        ‹
                                    </button>
                                    {Array.from({ length: pages }).map((_, i) => (
                                        <button
                                            key={i}
                                            className="see-all-btn"
                                            style={{
                                                background: i + 1 === page ? "#00b3ff" : "#fff",
                                                color: i + 1 === page ? "#fff" : "#0a2f5a",
                                                fontWeight: 800,
                                                minWidth: 36,
                                                height: 36,
                                                borderRadius: 12,
                                                border: "1px solid #d7e6f6",
                                            }}
                                            onClick={() => setPage(i + 1)}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                    <button
                                        className="see-all-btn"
                                        disabled={page >= pages}
                                        onClick={() => setPage((p) => p + 1)}
                                        title="Trang sau"
                                    >
                                        ›
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* QUICK VIEW – chỉ hiện khi có kết quả */}
                        {active && (
                            <aside
                                style={{
                                    background: "#fff",
                                    borderRadius: 18,
                                    padding: 14,
                                    boxShadow: "0 12px 22px rgba(8,60,120,.06)",
                                    minHeight: 320,
                                    alignSelf: "start",
                                    position: "sticky",
                                    top: 90,
                                }}
                            >
                                <HospitalQuickView item={active} />
                            </aside>
                        )}
                    </div>
                </section>
            )}

            {/* Khi không có kết quả: giữ footer luôn ở dưới cùng bằng một spacer tối thiểu */}
            {!loading && rows.length === 0 && (
                <section className="container" style={{ margin: "12px auto 60px" }}>
                    <div style={{ minHeight: "35vh" }} />
                </section>
            )}

            <style>{`
        @keyframes shimmer {
          0% { background-position: -200px 0 }
          100% { background-position: calc(200px + 100%) 0 }
        }
      `}</style>
        </main>
    );
}

function HospitalQuickView({ item }) {
    const API = import.meta.env.VITE_API_BASE_URL;

    //useState: Lưu danh sách ảnh của bệnh viện cho Quick View slideshow
    const [photos, setPhotos] = useState([]);

    //useState: Index ảnh hiện tại trong slideshow (0-based)
    const [idx, setIdx] = useState(0);

    //useEffect: Fetch chi tiết bệnh viện để lấy danh sách ảnh khi item thay đổi
    //Dependencies: [API, item.id] - chạy lại khi user click vào hospital khác
    //Cleanup flag "ok" để tránh update state sau unmount
    useEffect(() => {
        let ok = true;
        (async () => {
            try {
                const r = await fetch(`${API}/hospitals/${item.id}`);
                const d = r.ok ? await r.json() : null;
                if (!ok) return;
                const list = (d?.photos || [])
                    .map((p) => p.image_url)
                    .filter(Boolean);
                setPhotos(list.length ? list : [item.image_url].filter(Boolean));
                setIdx(0);
            } catch {
                setPhotos([item.image_url].filter(Boolean));
            }
        })();
        return () => {
            ok = false;
        };
    }, [API, item.id]);

    return (
        <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#0a2f5a" }}>
                        {item.name}
                    </h3>
                    <div style={{ display: "flex", gap: 6, marginTop: 6, color: "#47627b" }}>
                        <span>📍</span>
                        <span>{item.address || "Đang cập nhật"}</span>
                    </div>
                </div>

                <div
                    style={{
                        position: "relative",
                        borderRadius: 12,
                        overflow: "hidden",
                        height: 140,
                        background: "#eef5ff",
                    }}
                >
                    {photos[0] ? (
                        <img
                            src={photos[idx]}
                            alt={`photo-${idx}`}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                    ) : (
                        <div
                            style={{
                                display: "grid",
                                placeItems: "center",
                                height: "100%",
                                color: "#47627b",
                            }}
                        >
                            Không có ảnh
                        </div>
                    )}
                    {photos.length > 1 && (
                        <>
                            <button
                                className="doc-arrow doc-arrow--left"
                                style={{
                                    position: "absolute",
                                    top: "50%",
                                    left: 6,
                                    transform: "translateY(-50%)",
                                }}
                                onClick={() => setIdx((i) => (i + photos.length - 1) % photos.length)}
                            >
                                ‹
                            </button>
                            <button
                                className="doc-arrow doc-arrow--right"
                                style={{
                                    position: "absolute",
                                    top: "50%",
                                    right: 6,
                                    transform: "translateY(-50%)",
                                }}
                                onClick={() => setIdx((i) => (i + 1) % photos.length)}
                            >
                                ›
                            </button>
                        </>
                    )}
                </div>
            </div>

            <ul
                style={{
                    marginTop: 12,
                    marginBottom: 0,
                    paddingLeft: 18,
                    color: "#194569",
                    lineHeight: 1.7,
                }}
            >
                <li>Khám theo giờ, đặt nhanh – hạn chế chờ đợi.</li>
                <li>Hỗ trợ hoàn phí khi hủy (nếu CSYT áp dụng).</li>
                <li>Thiết bị hiện đại – quy trình minh bạch.</li>
            </ul>
        </>
    );
}
