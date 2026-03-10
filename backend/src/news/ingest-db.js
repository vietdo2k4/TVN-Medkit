import Parser from "rss-parser";               
import { pool } from "../db.js";                

const parser = new Parser();

function extractFirstImage(html = "") {
    const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    return m ? m[1] : null;
}

function makeSlug(t = "") {
    return t.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 200);
}

// normalizeItem: chuẩn hoá 1 item RSS về cấu trúc dùng nội bộ
// -----------------------------------------------------------
function normalizeItem(feedTitle, it) {
    const summaryRaw = (it.contentSnippet || it.content || "").replace(/<[^>]+>/g, "");
    return {
        title: (it.title || "").trim(),
        summary: summaryRaw?.trim() || "",
        url: it.link,
        cover_url: extractFirstImage(it.content || it["content:encoded"] || "") || null,
        published_at: it.isoDate || it.pubDate || null,
        source_name: feedTitle || "",
    };
}

// getActiveSources: đọc danh sách nguồn đang bật từ DB
async function getActiveSources() {
    const [rows] = await pool.query(
        "SELECT id, name, rss_url, category_key FROM news_sources WHERE is_active=1"
    );
    return rows;
}

// getCategoryId: map key_name -> id (FK)
async function getCategoryId(key) {
    const [rows] = await pool.query(
        "SELECT id FROM news_categories WHERE key_name=? LIMIT 1", [key]
    );
    return rows[0]?.id || null;
}

// insertArticle: ghi 1 bài (INSERT IGNORE) theo external_url/slug
async function insertArticle({ category_id, source_id, a }) {
    const slug = makeSlug(a.title || a.url || Date.now().toString());
    await pool.query(
        `INSERT IGNORE INTO news_articles
     (category_id, source_id, title, slug, summary, content_text, cover_url, cover_alt,
      is_external, external_url, status, published_at)
     VALUES (?,?,?,?,?,?,?,?,1,?,'published',?)`,
        [
            category_id,
            source_id,
            a.title,
            slug,
            a.summary,
            a.summary?.slice(0, 4000) || null,  
            a.cover_url,
            a.title,
            a.url,
            a.published_at ? new Date(a.published_at) : new Date()
        ]
    );
}

// ingestOnce: đọc tất cả nguồn, dedupe theo URL, sort mới→cũ, ghi DB
export async function ingestOnce() {
    const sources = await getActiveSources();
    if (!sources?.length) return { inserted: 0, total: 0 };

    // parse tất cả RSS
    const bucket = [];
    for (const s of sources) {
        try {
            const feed = await parser.parseURL(s.rss_url);     // parse RSS của 1 nguồn
            for (const it of feed.items || []) {
                bucket.push({ src: s, norm: normalizeItem(feed.title, it) });
            }
        } catch (e) {
            console.error("[news-ingest] parse fail:", s.rss_url, e.message);
        }
    }

    // dedupe theo URL
    const seen = new Set();
    const uniq = bucket.filter(b => {
        const u = b.norm.url;
        if (!u || seen.has(u)) return false;
        seen.add(u); return true;
    });

    // sort mới → cũ
    uniq.sort((a, b) => new Date(b.norm.published_at || 0) - new Date(a.norm.published_at || 0));

    // ghi DB
    let inserted = 0;
    for (const b of uniq) {
        const catId = await getCategoryId(b.src.category_key);
        if (!catId) continue;
        try {
            await insertArticle({ category_id: catId, source_id: b.src.id, a: b.norm });
            inserted++;
        } catch (e) {
            if (!/Duplicate/.test(e.message)) {
                console.error("[news-ingest] insert fail:", e.message);
            }
        }
    }
    return { inserted, total: uniq.length };
}