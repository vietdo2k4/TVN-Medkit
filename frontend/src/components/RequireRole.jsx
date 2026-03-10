import { Navigate, Outlet, useLocation } from "react-router-dom";

function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

export default function RequireRole({ role }) {
    const loc = useLocation();
    let token = null, user = null;

    try {
        token = localStorage.getItem("token") || null;
        user = safeParse(localStorage.getItem("user"));
    } catch { token = null; user = null; }

    // debug: xem có biến mất sau một nhịp render không
    console.log("[RequireRole]", { hasToken: !!token, role: user?.role });

    if (!token || !user) return <Navigate to="/login" replace state={{ from: loc }} />;
    if (role && user.role !== role) return <Navigate to="/" replace />;

    return <Outlet />;
}
