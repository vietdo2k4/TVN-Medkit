import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getUnreadCount } from "../api/notifications";

import "../styles/account.css";

export default function AccountLayout() {
    const nav = useNavigate();
    const { pathname } = useLocation();

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) nav("/login", { replace: true, state: { redirect: pathname } });
    }, [nav, pathname]);

    // badge thông báo (giữ nguyên nếu bạn đã có nơi khác)
    const API = import.meta.env.VITE_API_BASE_URL;
    const [unread, setUnread] = useState(0);
    useEffect(() => {
        let stop = false;
        const pull = async () => {
            const c = await getUnreadCount(); if (!stop) setUnread(c.unread || 0);
        };
        pull();
        const id = setInterval(pull, 60000);                  // poll mỗi 60s
        const onBump = () => pull();                          // cập nhật ngay khi FE báo thay đổi
        window.addEventListener("tvn-noti-changed", onBump);
        return () => { stop = true; clearInterval(id); window.removeEventListener("tvn-noti-changed", onBump); };
    }, []);

    const links = [
        { to: "/me", label: "Hồ sơ bệnh nhân", icon: "user", end: true },
        { to: "/me/appointments", label: "Phiếu khám bệnh", icon: "calendar" },
        { to: "/me/notifications", label: "Thông báo", icon: "bell", badge: unread },
    ];

    const current = useMemo(() => {
        if (pathname.startsWith("/me/appointments")) return "Phiếu khám bệnh";
        if (pathname.startsWith("/me/notifications")) return "Thông báo";
        if (pathname === "/me" || pathname.startsWith("/me?")) return "Hồ sơ bệnh nhân";
        return "Tài khoản";
    }, [pathname]);

    return (
        <div className="acc-shell">
            <div className="acc-bc">
                <Link to="/" className="acc-bc-link">Trang chủ</Link>
                <span className="acc-bc-sep">›</span>
                <span className="acc-bc-cur">{current}</span>
            </div>

            <div className="acc-grid">
                <aside className="acc-side">
                    <nav className="acc-menu">
                        {links.map(x => (
                            <NavLink key={x.to} to={x.to} end={x.end} className={({ isActive }) => "acc-item" + (isActive ? " active" : "")}>
                                {Icon(x.icon)}
                                <span className="acc-text">{x.label}</span>
                                {!!x.badge && x.badge > 0 && (
                                    <span className="acc-badge">{x.badge > 99 ? "99+" : x.badge}</span>
                                )}
                            </NavLink>
                        ))}
                    </nav>
                </aside>

                <main className="acc-main">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

function Icon(name) {
    if (name === "calendar")
        return (
            <svg className="acc-ic" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 2h2v2h6V2h2v2h3a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3V2zm13 8H4v10h16V10z" />
            </svg>
        );
    if (name === "bell")
        return (
            <svg className="acc-ic" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6V11a6 6 0 1 0-12 0v5L4 18v1h16v-1l-2-2z" />
            </svg>
        );
    return (
        <svg className="acc-ic" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm-7 9a7 7 0 0 1 14 0H5z" />
        </svg>
    );
}
