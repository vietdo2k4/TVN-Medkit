import { Router } from "express";
import authRoutes from "./auth.routes.js";
import meRoutes from "./me.routes.js";
import doctorRoutes from "./doctors.routes.js";
import searchRoutes from "./search.routes.js";
import specialtiesRoutes from "./specialties.routes.js";
import bookingsRoutes from "./bookings.routes.js";
import notificationsRoutes from "./notifications.routes.js";
import holdsRoutes from "./holds.routes.js";
import adminRoutes from "./admin.routes.js";
import hospitalsRoutes from "./hospitals.routes.js";
import newsRoutes from "./news.routes.js";


import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";

import doctorManageRoutes from "./doctor/doctor.manage.routes.js";
import doctorAppointmentsRoutes from "./doctor/doctor.appointments.routes.js";
import doctorMetrics from "./doctor/doctor.metrics.routes.js";
import doctorMe from "./doctor/doctor.me.routes.js";
import doctorNotificationsRoutes from "./doctor/doctor.notifications.routes.js";
import doctorReportsRoutes from "./doctor/doctor.reports.routes.js";

import assistantRoutes from "./chatbot/assistant.routes.js";
const router = Router();

router.use("/auth", authRoutes);
router.use("/", meRoutes);
router.use("/doctors", doctorRoutes);
router.use("/search", searchRoutes);
router.use("/specialties", specialtiesRoutes);
router.use("/bookings", bookingsRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/holds", holdsRoutes);
router.use("/hospitals", hospitalsRoutes);
router.use("/news", newsRoutes)


//auth → requireRole('admin') → admin routes
router.use("/admin", auth, requireRole("admin"), adminRoutes);

//auth → requireRole('doctor') → doctor routes
router.use("/doctor", auth, requireRole("doctor"), doctorManageRoutes);
router.use("/doctor/appointments", auth, requireRole("doctor"), doctorAppointmentsRoutes);
router.use("/doctor/metrics", auth, requireRole("doctor"), doctorMetrics);
router.use("/doctor", auth, requireRole("doctor"), doctorMe);
router.use("/doctor", auth, requireRole("doctor"), doctorNotificationsRoutes);
router.use("/doctor/reports", auth, requireRole("doctor"), doctorReportsRoutes);

router.use("/assistant", auth, assistantRoutes);
export default router;
