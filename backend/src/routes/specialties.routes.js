import { Router } from "express";
import db from "../db.js";

const router = Router();

// GET /api/specialties
router.get("/", async (_req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, name, slug, description, icon_path
            FROM specialties
            ORDER BY name ASC`
        );
        res.json(rows);
    } catch (e) {
        console.error("GET /specialties error:", e);
        res.status(500).json({ message: "Lỗi server" });
    }
});

export default router;
