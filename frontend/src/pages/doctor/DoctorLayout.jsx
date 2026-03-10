// frontend/src/pages/doctor/DoctorLayout.jsx
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import NotificationsBell from "../../components/doctor/NotificationsBell.jsx";

const BRAND = "#0ea5e9";
const BRAND_DARK = "#0369a1";

export default function DoctorLayout({ children }) {
    const nav = useNavigate();
    const [name, setName] = useState("Bác sĩ");

    // Ưu tiên displayName trong localStorage, sau đó gọi /doctor/me để đồng bộ
    useEffect(() => {
        const cached = localStorage.getItem("displayName");
        if (cached) setName(cached);

        const API = import.meta.env.VITE_API_BASE_URL;
        const token = localStorage.getItem("token");
        if (!token) return;
        (async () => {
            try {
                const r = await fetch(`${API}/doctor/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const d = r.ok ? await r.json() : null;
                const n =
                    d?.doctor?.full_name ||
                    JSON.parse(localStorage.getItem("user") || "{}")?.email?.split("@")[0] ||
                    "Bác sĩ";
                setName(n);
                localStorage.setItem("displayName", n);
                window.dispatchEvent(new Event("tvn-auth-changed"));
            } catch { /* empty */ }
        })();
    }, []);

    function onLogout() {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("displayName");
        window.dispatchEvent(new Event("tvn-auth-changed"));
        nav("/login", { replace: true });
    }

    return (
        <div style={S.shell} data-doctor>
            {/* Sidebar: cao 100vh nên đứng im, không cuộn */}
            <aside style={S.aside}>
                <div style={S.brand}>
                    <div style={S.logo}>🩺</div>
                    <div>
                        <div style={{ fontWeight: 700, color: "#e2e8f0" }}>TVN Medkit</div>
                        <div style={{ fontSize: 12, color: "#bfdbfe" }}>Bác sĩ</div>
                    </div>
                </div>

                <nav style={S.menu}>
                    <NavLink to="/doctor/metrics" end style={({ isActive }) => S.link(isActive)}>Tổng quan</NavLink>
                    <NavLink to="/doctor/appointments" style={({ isActive }) => S.link(isActive)}>Lịch hẹn</NavLink>
                    <NavLink to="/doctor/schedule" style={({ isActive }) => S.link(isActive)}>Lịch làm việc</NavLink>
                    <NavLink to="/doctor/reports" style={({ isActive }) => S.link(isActive)}>Báo cáo</NavLink>
                    <NavLink to="/doctor/profile" style={({ isActive }) => S.link(isActive)}>Thông tin bác sĩ</NavLink>
                </nav>
            </aside>

            {/* Main: là vùng cuộn duy nhất (overflow:auto) */}
            <main style={S.main}>
                <header style={S.topbar}>
                    <div style={S.crumbs}>
                        <NavLink to="/" style={{ color: BRAND, textDecoration: "none" }}>TVN Medkit</NavLink>
                        <span>•</span>
                        <b style={{ color: BRAND_DARK }}>Doctor</b>
                    </div>
                    <div style={S.actions}>
                        <NotificationsBell />
                        <div style={S.greet} title={name}>Xin chào, <b>{name}</b></div>
                        <button type="button" onClick={onLogout} style={S.logoutBtn}>Đăng xuất</button>
                    </div>
                </header>

                <section style={S.content}>{children ?? <Outlet />}</section>
            </main>
        </div>
    );
}

const S = {
    // GRID 2 cột. height:100vh + overflow:hidden -> chỉ phần main được phép cuộn.
    shell: {
        display: "grid",
        gridTemplateColumns: "220px 1fr",
        height: "100vh",               // CHỐT chiều cao viewport
        overflow: "hidden",            // chặn body cuộn, chỉ cho main cuộn
        background: "linear-gradient(180deg,#f0f9ff 0%,#f8fbff 100%)",
        fontFamily:
            'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
        color: "#0f172a",
    },

    // Sidebar cố định: cao 100vh, không cuộn theo nội dung
    aside: {
        height: "100vh",
        background: "linear-gradient(180deg,#0b375a 0%, #0b4a74 100%)",
        color: "#e2e8f0",
        padding: "16px 12px",
        borderRight: `1px solid ${BRAND}55`,
    },

    brand: { display: "flex", gap: 10, alignItems: "center", marginBottom: 12 },
    logo: {
        width: 36,
        height: 36,
        borderRadius: 10,
        display: "grid",
        placeItems: "center",
        background: `linear-gradient(135deg, ${BRAND}33, ${BRAND_DARK}44)`,
        color: "#e2e8f0",
        fontSize: 18,
        boxShadow: "inset 0 0 0 1px rgba(148,163,184,.22)",
    },
    menu: { display: "grid", gap: 6, marginTop: 6 },
    link: (active) => ({
        display: "block",
        padding: "10px 12px",
        borderRadius: 10,
        textDecoration: "none",
        color: active ? "#ffffff" : "#e2e8f0",
        background: active
            ? `linear-gradient(180deg, ${BRAND}22, ${BRAND_DARK}22)`
            : "transparent",
        border: active ? `1px solid ${BRAND}66` : "1px solid transparent",
        boxShadow: active ? "0 6px 16px rgba(14,165,233,.25)" : "none",
        transition: "background .15s ease, border-color .15s ease",
    }),

    // Main là container cuộn (1 header sticky + 1 vùng nội dung)
    main: {
        display: "grid",
        gridTemplateRows: "56px 1fr",
        overflow: "auto",              // CHỈ main cuộn
    },

    // Header vẫn sticky nhưng trong phạm vi main (scroll container)
    topbar: {
        position: "sticky",
        top: 0,
        zIndex: 5,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        background: "rgba(255,255,255,.9)",
        borderBottom: "1px solid #e2e8f0",
        backdropFilter: "saturate(180%) blur(6px)",
    },

    crumbs: { display: "flex", gap: 8, alignItems: "center", color: "#64748b" },
    content: { padding: 20, width: "100%", maxWidth: 1120, margin: "0 auto" },

    actions: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 0,
        maxWidth: "60vw",
    },
    greet: {
        flex: 1,
        minWidth: 0,
        maxWidth: "clamp(260px, 36vw, 700px)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        color: BRAND_DARK,
    },
    logoutBtn: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 12,
        border: `1px solid ${BRAND}`,
        background: "#fff",
        color: BRAND_DARK,
        fontWeight: 600,
        cursor: "pointer",
        boxShadow: "0 1px 0 rgba(14,165,233,.14)",
        transition: "all .15s ease",
    },
};
