import { NavLink, Outlet } from "react-router-dom";
import { useNavigate } from "react-router-dom";

const BRAND = "#00bdf2";
const BRAND_DARK = "#1e88c5";

export default function AdminLayout({ children }) {
  const nav = useNavigate();

  function onLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("tvn-auth-changed"));
    nav("/login", { replace: true });
  }

  return (
    <div style={S.shell} data-admin>
      {/* Sidebar: sticky 100vh, tự cuộn riêng nếu dài */}
      <aside style={S.aside}>
        <div style={S.brand}>
          <div style={S.logo}>🩺</div>
          <div>
            <div style={{ fontWeight: 700, color: "#e2e8f0" }}>TVN Medkit</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>Quản lý</div>
          </div>
        </div>

        {/* Menu: lưới link, để overflowY:auto phòng trường hợp nhiều mục */}
        <nav style={S.menu}>
          <NavLink to="dashboard" style={({ isActive }) => S.link(isActive)}>
            Thống kê
          </NavLink>

          <NavLink to="users" style={({ isActive }) => S.link(isActive)}>
            Quản lý người dùng
          </NavLink>

          <NavLink to="doctors" style={({ isActive }) => S.link(isActive)}>
            Quản lý bác sĩ
          </NavLink>

          <NavLink to="hospitals" style={({ isActive }) => S.link(isActive)}>
            Quản lý cơ sở y tế
          </NavLink>

          <NavLink to="specialties" style={({ isActive }) => S.link(isActive)}>
            Quản lý chuyên khoa
          </NavLink>

          <NavLink to="appointments" style={({ isActive }) => S.link(isActive)}>
            Quản lý phiếu khám
          </NavLink>
        </nav>
      </aside>

      {/* Khu nội dung: đặt chiều cao & overflow để chỉ phần này cuộn */}
      <main style={S.main}>
        <header style={S.topbar}>
          <div style={S.crumbs}>
            <a href="/" style={{ color: BRAND, textDecoration: "none" }}>
              TVN Medkit
            </a>
            <span>•</span>
            <b>Admin</b>
          </div>
          <div style={S.actions}>
            <button type="button" onClick={onLogout} style={S.logoutBtn}>
              Đăng xuất
            </button>
          </div>
        </header>

        <section style={S.content}>{children ?? <Outlet />}</section>
      </main>
    </div>
  );
}

// CSS inline
const S = {
  shell: {
    display: "grid",
    gridTemplateColumns: "220px 1fr",
    height: "100vh",
    overflow: "hidden",
    background: "linear-gradient(180deg,#f7fbff 0%,#f5f7fb 100%)",
    fontFamily:
      'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
    color: "#0f172a",
  },

  aside: {
    position: "sticky",
    top: 0,
    height: "100vh",
    alignSelf: "start",
    overflowY: "auto",
    background: "linear-gradient(180deg,#0b132b 0%, #0f172a 100%)",
    color: "#cbd5e1",
    padding: "16px 12px",
    borderRight: "1px solid rgba(17, 110, 240, 0.89)",
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

  menu: { display: "grid", gap: 6, marginTop: 6, paddingBottom: 12 },

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
    boxShadow: active ? "0 6px 16px rgba(2,132,199,.25)" : "none",
    transition: "background .15s ease, border-color .15s ease",
  }),

  main: {
    display: "grid",
    gridTemplateRows: "56px 1fr",
    height: "100vh",
    overflowY: "auto",
  },

  topbar: {
    position: "sticky",
    top: 0,
    zIndex: 5,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px",
    background: "rgba(255,255,255,.9)",
    borderBottom: "1px solid #e2e8f0",
    backdropFilter: "saturate(180%) blur(6px)",
  },

  crumbs: { display: "flex", gap: 8, alignItems: "center", color: "#64748b" },

  content: {
    padding: 20,
    width: "100%",
    maxWidth: 1120,
    margin: "0 auto",
  },

  actions: { display: "flex", gap: 8, alignItems: "center" },

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
    boxShadow: "0 1px 0 rgba(2,132,199,.14)",
    transition: "all .15s ease",
  },
  logoutBtnHover: {
    background: BRAND,
    color: "#fff",
    borderColor: BRAND,
    boxShadow: "0 6px 16px rgba(2,132,199,.25)",
    transform: "translateY(-1px)",
  },
  logoutBtnFocus: { boxShadow: "0 0 0 3px rgba(0,189,242,.25)" },
};
