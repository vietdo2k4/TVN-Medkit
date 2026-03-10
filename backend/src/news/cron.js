import cron from "node-cron";
import { ingestOnce } from "./ingest-db.js";

// schedule: */30 * * * *  → chạy mỗi 30 phút
cron.schedule("*/30 * * * *", async () => {
    try {
        const { inserted, total } = await ingestOnce();   // chạy ingest một lượt
        console.log(`[news-ingest] scanned=${total} inserted=${inserted}`);
    } catch (e) {
        console.error("[news-ingest] error:", e.message);
    }
});