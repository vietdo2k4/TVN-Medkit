import express from "express";
import cors from "cors";
import "dotenv/config";
import routes from "./routes/index.js";
import { cleanupHolds } from "./cron/cleanup.js";
import { startReminderJob } from "./cron/reminders.js";
import { closeMailer } from "./helper/mail.js";
import "./news/cron.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use(routes);

app.get("/health", (_req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API running on :${port}`));

setInterval(cleanupHolds, 60 * 1000);

startReminderJob();

const shutdown = () => {
    try { closeMailer(); } catch { }
    process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);