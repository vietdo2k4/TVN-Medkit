import { useEffect, useMemo, useState } from "react";
import { getAdminMetrics, listAppointments } from "../../api/admin";

function normalizeMetrics(r) {
    if (!r || typeof r !== "object") return { counts: {}, monthly: [] };
    if (r.counts || r.monthly) {
        return {
            counts: {
                users: Number(r?.counts?.users || 0),
                doctors: Number(r?.counts?.doctors || 0),
                appointments: Number(r?.counts?.appointments || 0),
                hospitals: Number(r?.counts?.hospitals || 0),
                specialties: Number(r?.counts?.specialties || 0),
            },
            monthly: Array.isArray(r?.monthly)
                ? r.monthly.map((x) => ({
                    ym: String(x?.ym || ""),              // "YYYY-MM"
                    total: Number(x?.total || 0),         // tổng lịch
                    cancelled: Number(x?.cancelled || 0), // số hủy
                    net:
                        x?.net != null
                            ? Number(x.net)
                            : Number(x?.total || 0) - Number(x?.cancelled || 0),
                }))
                : [],
        };
    }
    return {
        counts: {
            users: Number(r?.users || 0),
            doctors: Number(r?.doctors || 0),
            appointments: Number(r?.appointments || 0),
            hospitals: Number(r?.hospitals || 0),
            specialties: Number(r?.specialties || 0),
        },
        monthly: Array.isArray(r?.appointments_by_month)
            ? r.appointments_by_month.map((x) => ({
                ym: String(x?.ym || ""),
                total: Number(x?.total || 0),
                cancelled: Number(x?.cancelled || 0),
                net: (x?.total || 0) - (x?.cancelled || 0),
            }))
            : [],
    };
}

/*Helpers thời gian */
const pad2 = (n) => (n < 10 ? `0${n}` : String(n));
const daysInMonth = (y, m01) => new Date(y, m01, 0).getDate(); // m01: 1..12
const toSQL = (d) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(
        d.getHours()
    )}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

/* rows: [{ label: '01', value: number }, ...] */
function BarChart({ rows, title }) {
    const max = Math.max(1, ...rows.map((r) => r.value || 0));
    const H = 220;            // chiều cao tối đa của cột
    const baseY = 260;        // baseline
    const padX = 50;          // lề trái/phải
    const barW = Math.max(18, Math.floor((1000 - padX * 2) / Math.max(1, rows.length)) - 10);
    const gap = Math.max(6, Math.floor((1000 - padX * 2 - barW * rows.length) / Math.max(1, rows.length - 1)));

    return (
        <div>
            <div style={SS.chartTitle}>{title}</div>
            <svg viewBox="0 0 1000 320" width="100%" height="100%" role="img" aria-label="Biểu đồ cột">
                {/* baseline */}
                <line x1={padX} x2={1000 - padX} y1={baseY} y2={baseY} stroke="#e2e8f0" strokeWidth="1" />
                {rows.map((r, i) => {
                    // Chiều cao tỉ lệ theo giá trị: ngày có 2 > ngày có 1
                    const h = Math.round((H * (r.value || 0)) / max);
                    const x = padX + i * (barW + gap);
                    const y = baseY - h;
                    return (
                        <g key={`${r.label}-${i}`} transform={`translate(${x},0)`}>
                            <rect x="0" y={y} width={barW} height={h} rx="6" fill={BRAND} />
                            <text x={barW / 2} y={baseY + 18} textAnchor="middle" style={{ fontSize: 11, fill: "#64748b" }}>
                                {r.label}
                            </text>
                            <text x={barW / 2} y={y - 6} textAnchor="middle" style={{ fontSize: 11, fill: "#0f172a", fontWeight: 700 }}>
                                {r.value || 0}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

/*Biểu đồ tỉ lệ đặt/hủy*/
function DonutBookedCancelled({ booked, cancelled }) {
    const done = Math.max(0, Number(booked || 0));
    const canc = Math.max(0, Number(cancelled || 0));
    const sum = Math.max(1, done + canc);
    const R = 70, C = 2 * Math.PI * R;
    const doneLen = (done / sum) * C;
    const cancLen = (canc / sum) * C;

    return (
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12, alignItems: "center" }}>
            <svg viewBox="0 0 180 180" width="100%" height="100%">
                <g transform="translate(90,90)">
                    <circle r={R} fill="none" stroke="#e2e8f0" strokeWidth="16" />
                    <circle r={R} fill="none" stroke={BRAND} strokeWidth="16"
                        strokeDasharray={`${doneLen} ${C - doneLen}`} transform="rotate(-90)" />
                    <circle r={R} fill="none" stroke="#ef4444" strokeWidth="16"
                        strokeDasharray={`${cancLen} ${C - cancLen}`} transform={`rotate(${(done / sum) * 360 - 90})`} />
                    <text x="0" y="6" textAnchor="middle" style={{ fontSize: 16, fontWeight: 800, fill: "#0f172a" }}>
                        {Math.round((done / sum) * 100)}%
                    </text>
                </g>
            </svg>
            <div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: "#0f172a" }}>Tỉ lệ đặt / hủy</div>
                <div style={{ display: "grid", gap: 6 }}>
                    <Legend color={BRAND} label="Đã đặt" value={done} />
                    <Legend color="#ef4444" label="Đã hủy" value={canc} />
                    <div style={{ fontSize: 12, color: "#64748b" }}>Tổng: {done + canc}</div>
                </div>
            </div>
        </div>
    );
}
function Legend({ color, label, value }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: color }} />
            <span style={{ fontSize: 13 }}>{label}</span>
            <span style={{ marginLeft: "auto", fontWeight: 700 }}>{value}</span>
        </div>
    );
}

export default function AdminDashboardPage() {
    /* State số liệu tổng*/
    const [data, setData] = useState({ counts: {}, monthly: [] });
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    /*Bộ lọc view */
    const [mode, setMode] = useState("year");                      // 'year' | 'month'
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(pad2(new Date().getMonth() + 1)); // '01'..'12'

    /*Dữ liệu NGÀY của tháng đang chọ*/
    const [monthDaily, setMonthDaily] = useState({ rows: [], booked: 0, cancelled: 0 });

    // Tải số liệu tổng từ /admin/metrics (KPI + monthly)
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                setLoading(true); setErr("");
                const raw = await getAdminMetrics();
                if (!alive) return;
                const n = normalizeMetrics(raw);
                setData(n);

                // Chọn mặc định theo entry gần nhất trong monthly
                if (Array.isArray(n.monthly) && n.monthly.length) {
                    const yms = n.monthly.map((x) => x.ym).filter(Boolean).sort();
                    const last = yms[yms.length - 1] || "";
                    const y = Number(last.slice(0, 4)) || new Date().getFullYear();
                    const m = last.slice(5, 7) || pad2(new Date().getMonth() + 1);
                    setYear(y); setMonth(m);
                }
            } catch (e) {
                if (!alive) return;
                setErr(e?.data?.message || e?.message || "Request error");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, []);

    /* Map "YYYY-MM" -> {total,cancelled,net} cho chế độ xem NĂM */
    const byYM = useMemo(() => {
        const m = new Map();
        for (const it of data.monthly || []) {
            m.set(String(it.ym), { total: it.total, cancelled: it.cancelled, net: it.net });
        }
        return m;
    }, [data.monthly]);

    /* Danh sách năm/tháng khả dụng cho select */
    const yearsAvailable = useMemo(() => {
        const set = new Set((data.monthly || []).map((x) => Number(String(x.ym).slice(0, 4))));
        return Array.from(set).filter(Boolean).sort((a, b) => a - b);
    }, [data.monthly]);
    const monthsAvailableInYear = useMemo(() => {
        const list = (data.monthly || [])
            .map((x) => String(x.ym))
            .filter((s) => s.startsWith(String(year)))
            .map((s) => s.slice(5, 7));
        return Array.from(new Set(list)).sort();
    }, [data.monthly, year]);

    /*Gom THEO NGÀY khi mode='month'
       Quan trọng: FE TỰ LỌC theo year/month để tránh việc BE không lọc from/to. */
    useEffect(() => {
        if (mode !== "month") return;

        let alive = true;
        (async () => {
            const y = Number(year), m01 = Number(month); // 1..12
            const start = new Date(y, m01 - 1, 1, 0, 0, 0);
            const end = new Date(y, m01, 1, 0, 0, 0);    // sang tháng kế tiếp
            const from = toSQL(start);
            const to = toSQL(end);

            const pageSize = 500;
            let page = 1;
            const all = [];
            try {
                for (; ;) {
                    const arr = await listAppointments({ from, to, page, limit: pageSize });
                    if (!Array.isArray(arr) || arr.length === 0) break;
                    all.push(...arr);
                    if (arr.length < pageSize) break;
                    page += 1;
                }

                // Khởi tạo bucket ngày trong THÁNG đã chọn
                const dim = daysInMonth(y, m01);
                const bucket = Array.from({ length: dim }, () => ({ total: 0, cancelled: 0 }));

                // LỌC RÕ YEAR/MONTH trước khi đếm (fix lỗi hiển thị tháng cũ)
                for (const ap of all) {
                    const d = new Date(ap.start_time);
                    if (isNaN(d)) continue;
                    const sameMonth = d.getFullYear() === y && d.getMonth() + 1 === m01;
                    if (!sameMonth) continue; // bỏ mọi lịch không thuộc tháng đang xem
                    const day = d.getDate(); // 1..31
                    const idx = day - 1;
                    bucket[idx].total += 1;
                    if (ap.status === "cancelled") bucket[idx].cancelled += 1;
                }

                // Dữ liệu cho biểu đồ cột & donut
                const rows = bucket.map((v, i) => ({ label: pad2(i + 1), value: Math.max(0, v.total - v.cancelled) }));
                const booked = bucket.reduce((s, v) => s + Math.max(0, v.total - v.cancelled), 0);
                const cancelled = bucket.reduce((s, v) => s + v.cancelled, 0);

                if (alive) setMonthDaily({ rows, booked, cancelled });
                // eslint-disable-next-line no-unused-vars
            } catch (e) {
                if (alive) setMonthDaily({ rows: [], booked: 0, cancelled: 0 });
            }
        })();

        return () => { alive = false; };
    }, [mode, year, month]);

    /* -------------------- Early returns sau mọi hook -------------------- */
    if (loading) return <div style={SS.loading}>Đang tải dashboard…</div>;
    if (err) return <div style={SS.error}>Lỗi: {err}</div>;

    /*KPI đầu trang*/
    const c = data.counts;
    const kpis = [
        { label: "Người dùng", value: c.users },
        { label: "Bác sĩ", value: c.doctors },
        { label: "Cuộc hẹn", value: c.appointments },
        { label: "Cơ sở y tế", value: c.hospitals },
        { label: "Chuyên khoa", value: c.specialties },
    ];

    // Chuẩn bị dữ liệu biểu đồ
    let barRows = [];
    let donutBooked = 0;
    let donutCancelled = 0;
    let barTitle = "";

    if (mode === "year") {
        // 12 tháng trong năm
        for (let m = 1; m <= 12; m++) {
            const ym = `${year}-${pad2(m)}`;
            const v = byYM.get(ym) || { total: 0, cancelled: 0, net: 0 };
            barRows.push({ label: pad2(m), value: v.net });
            donutBooked += v.net;
            donutCancelled += v.cancelled;
        }
        barTitle = `Năm ${year}`;
    } else {
        // THEO NGÀY trong tháng đang chọn
        barRows = monthDaily.rows;
        donutBooked = monthDaily.booked;
        donutCancelled = monthDaily.cancelled;
        barTitle = `Tháng ${Number(month)}/${year}`;
    }

    return (
        <div>
            {/* Tiêu đề + KPI */}
            <h2 style={{ margin: "0 0 12px", color: "#0f172a" }}>Dashboard</h2>
            <div style={SS.grid}>
                {kpis.map((k) => (
                    <div key={k.label} style={SS.card}>
                        <div style={SS.kpiLabel}>{k.label}</div>
                        <div style={SS.kpiValue}>{Number(k.value || 0)}</div>
                    </div>
                ))}
            </div>

            {/* Bộ lọc: Chế độ + Năm + (Tháng) */}
            <div style={{ ...SS.card, marginTop: 14, display: "flex", gap: 8, alignItems: "center" }}>
                {/* Chế độ xem */}
                <select style={SS.select} value={mode} onChange={(e) => setMode(e.target.value)}>
                    <option value="year">Xem cả năm</option>
                    <option value="month">Xem theo tháng</option>
                </select>

                {/* Năm */}
                <select style={SS.select} value={year} onChange={(e) => setYear(Number(e.target.value))}>
                    {yearsAvailable.length === 0
                        ? <option value={year}>{year}</option>
                        : yearsAvailable.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>

                {/* Tháng (chỉ khi mode=month) */}
                {mode === "month" && (
                    <select style={SS.select} value={month} onChange={(e) => setMonth(e.target.value)}>
                        {monthsAvailableInYear.length === 0
                            ? <option value={month}>{month}</option>
                            : monthsAvailableInYear.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                )}
            </div>

            {/* Biểu đồ: cột + donut */}
            <div style={SS.twoCols}>
                <div style={SS.chartCard}>
                    <BarChart rows={barRows} title={barTitle} />
                </div>
                <div style={SS.chartCard}>
                    <DonutBookedCancelled booked={donutBooked} cancelled={donutCancelled} />
                </div>
            </div>
        </div>
    );
}

/*CSS inline*/
const BRAND = "#00bdf2";

const SS = {
    // Lưới KPI
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 12 },
    card: { padding: 14, border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff", boxShadow: "0 4px 16px rgba(15,23,42,.05)" },

    // Kiểu chữ KPI
    kpiLabel: { fontSize: 12, color: "#64748b" },
    kpiValue: { fontSize: 24, fontWeight: 800, marginTop: 6, color: "#0f172a" },

    // Khu biểu đồ
    twoCols: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginTop: 14 },
    chartCard: { padding: 14, border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff", boxShadow: "0 4px 16px rgba(15,23,42,.05)" },
    chartTitle: { fontSize: 14, fontWeight: 700, marginBottom: 8, color: "#0f172a" },

    // Trạng thái tải/lỗi
    loading: { padding: 14, border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff" },
    error: { padding: 14, border: "1px solid #fecaca", borderRadius: 12, background: "#fff1f2", color: "#b91c1c", fontWeight: 600 },

    // Form lọc
    select: { height: 36, padding: "0 10px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 14, background: "#fff" },
};
