export function requireRole(...roles) {
    return (req, _res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return next({ status: 403, message: "Forbidden" });
        }
        next();
    };
}
