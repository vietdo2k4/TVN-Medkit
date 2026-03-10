import "dotenv/config";
import { ingestOnce } from "../src/news/ingest-db.js";
const r = await ingestOnce(); console.log(r); process.exit(0);