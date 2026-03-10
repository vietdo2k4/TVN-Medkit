import jwt from "jsonwebtoken";

function parseToken(req) {
    const a = req.headers.authorization || "";
    return a.startsWith("Bearer ") ? a.slice(7) : null;
}

export function requireAuth(req, res, next) {
    try {
        const token = parseToken(req);
        if (!token) return res.status(401).json({ message: "Thiếu token" });
        const p = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { id: p.sub, role: p.role };
        next();
    } catch {
        return res.status(401).json({ message: "Token không hợp lệ" });
    }
}

export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ message: "Chưa đăng nhập" });
        if (!roles.includes(req.user.role))
            return res.status(403).json({ message: "Không đủ quyền" });
        next();
    };
}
export default requireAuth;
