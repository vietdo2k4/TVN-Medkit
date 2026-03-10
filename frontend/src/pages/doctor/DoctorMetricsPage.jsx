import { useEffect, useMemo, useState } from "react";
import { getDoctorMetrics } from "../../api/doctor";
import {
    ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    PieChart, Pie, Cell,
} from "recharts"; // Recharts

/* ===== Helpers thời gian ===== */
const pad2 = (n) => (n < 10 ? `0${n}` : String(n));
const toISODate = (d) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Tính Monday..Sunday của tuần ISO từ input "YYYY-Www" */
function isoWeekToRange(weekStr) {
    if (!weekStr) return null;
    const [yStr, wStr] = weekStr.split("-W");
    const y = Number(yStr), w = Number(wStr);
    const jan4 = new Date(y, 0, 4);
    const dOW = jan4.getDay() || 7; // 1..7 (Mon..Sun)
    const monWeek1 = new Date(jan4);
    monWeek1.setDate(jan4.getDate() - (dOW - 1));
    const start = new Date(monWeek1);
    start.setDate(monWeek1.getDate() + (w - 1) * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
}

/** Giá trị mặc định cho <input type="week">, VD "2025-W11" */
function weekInputOf(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay() || 7;
    const thu = new Date(d); thu.setDate(d.getDate() + (4 - day));
    const y = thu.getFullYear();
    const thu1 = new Date(y, 0, 4);
    const thu1dow = thu1.getDay() || 7;
    const thuOfW1 = new Date(thu1); thuOfW1.setDate(thu1.getDate() + (4 - thu1dow));
    const w = Math.floor(1 + (thu - thuOfW1) / (7 * 24 * 3600 * 1000));
    return `${y}-W${pad2(w)}`;
}

/** Range ngày của "YYYY-MM" */
function monthToRange(monthStr) {
    if (!monthStr) return null;
    const [y, m] = monthStr.split("-").map(Number);
    const start = new Date(y, m - 1, 1, 0, 0, 0);
    const end = new Date(y, m, 0, 0, 0, 0);
    return { start, end };
}

/* ===== Component chính ===== */
export default function DoctorMetricsPage() {
    // Bộ lọc: mode=week|month; period theo mode
    const [mode, setMode] = useState("week");
    const [weekVal, setWeekVal] = useState(weekInputOf());
    const [monthVal, setMonthVal] = useState(`${new Date().getFullYear()}-${pad2(new Date().getMonth() + 1)}`);
    const [all] = useState(false); // đếm trạng thái toàn thời gian

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    // Gọi API metrics theo khoảng từ filter
    async function load() {
        let from = "", to = "", range = 7;
        if (mode === "week") {
            const r = isoWeekToRange(weekVal);
            if (r) { from = toISODate(r.start); to = toISODate(r.end); range = 7; }
        } else {
            const r = monthToRange(monthVal);
            if (r) {
                from = toISODate(r.start);
                to = toISODate(r.end);
                range = Math.round((r.end - r.start) / (24 * 3600 * 1000)) + 1;
            }
        }
        setLoading(true);
        try {
            const res = await getDoctorMetrics({ range, from, to, all: all ? 1 : 0 });
            setData(res);
        } catch (e) {
            alert(e.message || "Lỗi tải số liệu");
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        load(); /* mount & theo filter */  // eslint-disable-next-line
    }, [mode, weekVal, monthVal, all]);

    // Dữ liệu biểu đồ
    const barData = useMemo(() => {
        const arr = data?.dailyCounts || [];
        return arr.map(d => ({
            // Nhãn ngày đẹp (dd/MM)
            label: new Date(d.date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
            count: d.count,
        }));
    }, [data]);

    const donutData = useMemo(() => ([
        { name: "Đã khám", value: Number(data?.counts?.completed || 0), color: "#10b981" },
        { name: "Đã hủy", value: Number(data?.counts?.cancelled || 0), color: "#ef4444" },
    ]), [data]);

    const donutPercent = useMemo(() => {
        const done = donutData[0]?.value || 0;
        const canc = donutData[1]?.value || 0;
        const sum = Math.max(1, done + canc);
        return Math.round((done / sum) * 100);
    }, [donutData]);

    return (
        <div style={S.page}>
            {/* Header + bộ lọc */}
            <div style={S.head}>
                <div style={S.title}>Thống kê</div>
                <div style={S.filters}>
                    {/* Chọn chế độ xem */}
                    <select value={mode} onChange={(e) => setMode(e.target.value)} style={S.select}>
                        <option value="week">Xem theo tuần</option>
                        <option value="month">Xem theo tháng</option>
                    </select>

                    {/* Bộ chọn tuần/tháng */}
                    {mode === "week" ? (
                        <>
                            <input type="week" value={weekVal} onChange={(e) => setWeekVal(e.target.value)} style={S.input} />
                            <button style={S.btnLight} onClick={() => setWeekVal(weekInputOf())}>Tuần này</button>
                            <button
                                style={S.btnLight}
                                onClick={() => {
                                    const r = isoWeekToRange(weekVal) || isoWeekToRange(weekInputOf());
                                    const prev = new Date((r?.start || new Date()).getTime() - 7 * 24 * 3600 * 1000);
                                    setWeekVal(weekInputOf(prev));
                                }}
                            >Tuần trước</button>
                        </>
                    ) : (
                        <>
                            <input type="month" value={monthVal} onChange={(e) => setMonthVal(e.target.value)} style={S.input} />
                            <button
                                style={S.btnLight}
                                onClick={() => {
                                    const now = new Date(); setMonthVal(`${now.getFullYear()}-${pad2(now.getMonth() + 1)}`);
                                }}
                            >Tháng này</button>
                            <button
                                style={S.btnLight}
                                onClick={() => {
                                    const now = new Date(); now.setMonth(now.getMonth() - 1);
                                    setMonthVal(`${now.getFullYear()}-${pad2(now.getMonth() + 1)}`);
                                }}
                            >Tháng trước</button>
                        </>
                    )}
                    <button style={S.btn} onClick={load} disabled={loading}>Tải</button>
                </div>
            </div>

            {loading && <div style={{ padding: 12, color: "#64748b" }}>Đang tải…</div>}

            {!loading && data && (
                <>
                    {/* KPI + bảng trạng thái (đã bỏ Vắng) */}
                    <div style={S.grid3}>
                        <div style={S.card}>
                            <div style={S.cardLabel}>Phiếu khám theo trạng thái</div>
                            {["pending", "confirmed", "completed", "cancelled"].map((k) => (
                                <div key={k} style={S.statRow}>
                                    <span>{LABEL[k]}</span>
                                    <b>{data.counts[k] || 0}</b>
                                </div>
                            ))}
                        </div>

                        <div style={S.card}>
                            <div style={S.cardLabel}>Bệnh nhân đã khám</div>
                            <div style={S.bigNum}>{data.uniquePatients}</div>
                        </div>

                        <div style={S.card}>
                            <div style={S.cardLabel}>Doanh thu (đã thanh toán)</div>
                            <div style={S.bigNum}>{Number(data.totalRevenue).toLocaleString("vi-VN")} ₫</div>
                        </div>
                    </div>

                    {/* Donut tỉ lệ khám thành công (Recharts) */}
                    <div style={{ ...S.card, marginBottom: 12, position: "relative" }}>
                        {/* Nhãn % ở giữa donut */}
                        <div style={S.pieCenter}>{donutPercent}%</div>
                        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12, alignItems: "center" }}>
                            <div style={{ width: "100%", height: 200 }}>
                                <ResponsiveContainer>
                                    <PieChart>
                                        <Pie
                                            data={donutData}
                                            dataKey="value"
                                            nameKey="name"
                                            innerRadius={60}
                                            outerRadius={80}
                                            startAngle={90}
                                            endAngle={-270}
                                            paddingAngle={2}
                                        >
                                            {donutData.map((it, i) => <Cell key={i} fill={it.color} />)}
                                        </Pie>
                                        <Tooltip formatter={(v, n) => [v, n]} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Ghi chú */}
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: "#0f172a" }}>
                                    Tỉ lệ khám thành công
                                </div>
                                <div style={{ display: "grid", gap: 6 }}>
                                    <Legend color="#10b981" label="Đã khám" value={donutData[0].value} />
                                    <Legend color="#ef4444" label="Đã hủy" value={donutData[1].value} />
                                    <div style={{ fontSize: 12, color: "#64748b" }}>
                                        Tổng: {donutData[0].value + donutData[1].value}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Biểu đồ cột theo ngày (Recharts) */}
                    <div style={S.card}>
                        <div style={S.cardSub}>
                            <div style={S.cardLabel}>Số phiếu khám theo ngày</div>
                            <div style={{ color: "#64748b", fontSize: 12 }}>
                                Khoảng: {data.from} → {data.to} ({data.range} ngày)
                            </div>
                        </div>
                        <div style={{ width: "100%", height: 220 }}>
                            <ResponsiveContainer>
                                <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="label" />
                                    <YAxis allowDecimals={false} />
                                    <Tooltip formatter={(v) => [v, "Số phiếu"]} />
                                    <Bar dataKey="count" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

/* ===== Nhãn trạng thái (đã bỏ no_show) ===== */
const LABEL = {
    pending: "Chờ xác nhận",
    confirmed: "Đã xác nhận",
    completed: "Đã khám",
    cancelled: "Đã hủy",
};

/* ===== Inline CSS ===== */
function Legend({ color, label, value }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: color }} />
            <span style={{ fontSize: 13 }}>{label}</span>
            <span style={{ marginLeft: "auto", fontWeight: 700 }}>{value}</span>
        </div>
    );
}

const S = {
    page: { maxWidth: 1120, margin: "0 auto", padding: 16, color: "#0f172a" },

    head: { display: "grid", gridTemplateColumns: "1fr", gap: 8, marginBottom: 8 },
    title: { fontSize: 20, fontWeight: 800 },
    filters: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },

    input: { border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 10px", outline: "none" },
    select: { border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 10px", outline: "none", background: "#fff" },
    chk: { display: "flex", gap: 6, alignItems: "center", color: "#334155", fontSize: 13 },

    btn: { border: "1px solid #0ea5e9", background: "#fff", color: "#0369a1", padding: "8px 12px", borderRadius: 10, cursor: "pointer" },
    btnLight: { border: "1px solid #e2e8f0", background: "#f8fafc", color: "#0f172a", padding: "8px 12px", borderRadius: 10, cursor: "pointer" },

    grid3: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, margin: "8px 0 12px" },

    card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, boxShadow: "0 2px 10px rgba(2,6,23,.04)", padding: "12px 16px", minHeight: 110 },
    cardLabel: { fontSize: 14, color: "#64748b", marginBottom: 6 },
    cardSub: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
    statRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" },
    bigNum: { fontSize: 28, fontWeight: 800 },

    pieCenter: { position: "absolute", left: 110, top: 96, transform: "translate(-50%,-50%)", fontSize: 16, fontWeight: 800 },

    // Bar
    chart: { display: "flex", alignItems: "flex-end", gap: 10, height: 160, marginTop: 8 },
};
