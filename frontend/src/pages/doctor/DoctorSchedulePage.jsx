/* eslint-disable no-unused-vars */
import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_BASE_URL;

async function authFetch(url, init = {}) {
    const token = localStorage.getItem("token");
    const headers = { "Content-Type": "application/json", ...(init.headers || {}), Authorization: `Bearer ${token}` };
    const r = await fetch(url, { ...init, headers });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
}

export default function DoctorSchedulePage() {
    const today = new Date().toLocaleDateString("en-CA");
    const [tab, setTab] = useState("custom"); // "custom" | "range"

    // chung
    const [rows, setRows] = useState([]);
    const [from, setFrom] = useState(today);
    const [to, setTo] = useState(today);
    const [room, setRoom] = useState("");

    // phân trang
    const [page, setPage] = useState(1);
    const pageSize = 5;
    const totalPages = useMemo(() => Math.max(1, Math.ceil(rows.length / pageSize)), [rows.length]);
    const pageRows = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [rows, page]);

    const load = async () => {
        const data = await authFetch(`${API}/doctor/schedules?from=${from}&to=${to}`);
        setRows(data);
        setPage(1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { load(); }, []);

    // === THEO NGÀY ===
    const [date, setDate] = useState(today);
    const [timeInput, setTimeInput] = useState("");
    const [times, setTimes] = useState([]); // KHÔNG mặc định

    const addTime = () => {
        const v = (timeInput || "").trim();
        if (!/^\d{2}:\d{2}$/.test(v)) return alert("Định dạng HH:MM");
        const mm = v.split(":")[1];
        if (mm !== "00" && mm !== "30") return alert("Chỉ nhận phút 00 hoặc 30");
        if (!times.includes(v)) setTimes([...times, v].sort());
        setTimeInput("");
    };
    const removeTime = (t) => setTimes(times.filter(x => x !== t));

    //Them gio tuy chon
    const createCustom = async () => {
        if (!room.trim()) return alert("Vui lòng nhập phòng");
        if (!date || times.length === 0) return alert("Chọn ngày và thêm giờ");

        try {
            const res = await authFetch(`${API}/doctor/schedules/custom`, {
                method: "POST",
                body: JSON.stringify({ date, times, room: room.trim() })
            });

            const ins = res.inserted?.length || 0;
            const sk = res.skipped || [];
            const dup = sk.filter(x => x.reason === "overlap").map(x => x.time);
            const past = sk.filter(x => x.reason === "past_time").map(x => x.time);
            const bad = sk.filter(x => x.reason === "invalid_time").map(x => x.time);

            let msg = `Đã tạo ${ins} slot.`;
            if (dup.length) msg += ` Bỏ do trùng giờ: ${dup.join(", ")}.`;
            if (past.length) msg += ` Thất bại do đã qua: ${past.join(", ")}.`;
            if (bad.length) msg += ` Sai định dạng: ${bad.join(", ")}.`;
            if (ins === 0) msg = "Không tạo được slot nào. ";
            setFrom(date); setTo(date);
            await load();
            alert(msg);
            setTimes([]); // dọn danh sách giờ sau khi tạo
        } catch (e) {
            alert("Bị trùng lặp slot");
        }
    };


    // === NHIỀU NGÀY (khoảng ngày + danh sách giờ) ===
    const [rFrom, setRFrom] = useState(today);
    const [rTo, setRTo] = useState(today);
    const [timeInput2, setTimeInput2] = useState("");
    const [times2, setTimes2] = useState([]); // danh sách giờ áp cho nhiều ngày

    const addTime2 = () => {
        const v = (timeInput2 || "").trim();
        if (!/^\d{2}:\d{2}$/.test(v)) return alert("Định dạng HH:MM");
        const mm = v.split(":")[1];
        if (mm !== "00" && mm !== "30") return alert("Chỉ nhận phút 00 hoặc 30");
        if (!times2.includes(v)) setTimes2([...times2, v].sort());
        setTimeInput2("");
    };
    const removeTime2 = (t) => setTimes2(times2.filter(x => x !== t));

    //Them lich cho nhieu ngay
    const generateRange = async () => {
        if (!room.trim()) return alert("Vui lòng nhập phòng");
        if (!rFrom || !rTo || times2.length === 0) return alert("Chọn khoảng ngày và thêm giờ");

        try {
            const res = await authFetch(`${API}/doctor/schedules/generate-range`, {
                method: "POST",
                body: JSON.stringify({ from: rFrom, to: rTo, times: times2, room: room.trim() })
            });

            // BE trả: { ok, inserted, skipped:{overlap[],past_time[],invalid_time[]}, effected_days:[] }
            const sk = res.skipped || {};
            let msg = `Đã tạo ${res.inserted || 0} slot trong khoảng.`;
            if (sk.overlap?.length) msg += ` Bỏ do trùng: ${sk.overlap.length}.`;
            if (sk.past_time?.length) msg += ` Bỏ do đã qua: ${sk.past_time.length}.`;
            if (sk.invalid_time?.length) msg += ` Sai định dạng: ${sk.invalid_time.length}.`;
            if ((res.inserted || 0) === 0) msg = "Không tạo được slot. " + msg;

            setFrom(rFrom); setTo(rTo);
            await load();
            alert(msg);
            setTimes2([]);
        } catch (e) {
            alert(e.message || "Lỗi tạo slot");
        }
    };

    return (
        <div style={SX.page}>
            <div style={SX.header}>
                <div style={SX.title}>Quản lý lịch làm việc</div>
                <div style={SX.legend}>
                    <span style={{ ...SX.badge, background: "#dcfce7", color: "#166534" }}>Còn chỗ</span>
                    <span style={{ ...SX.badge, background: "#fee2e2", color: "#991b1b" }}>Hết chỗ</span>
                    <span style={{ ...SX.badge, background: "#e5e7eb", color: "#374151" }}>Đã qua</span>
                </div>
            </div>

            <div style={SX.tabs}>
                <button style={SX.tab(tab === "custom")} onClick={() => setTab("custom")}>Thêm lịch theo ngày</button>
                <button style={SX.tab(tab === "range")} onClick={() => setTab("range")}>Thêm lịch theo nhiều ngày</button>
            </div>

            <div style={SX.card}>
                {tab === "custom" && (
                    <div>
                        <div style={SX.row}>
                            <label>Ngày</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={SX.input} />
                            <label>Phòng</label>
                            <input placeholder="VD P205" value={room} onChange={e => setRoom(e.target.value)} style={SX.input} required />
                        </div>

                        <div style={{ ...SX.row, alignItems: "center" }}>
                            <label>Giờ</label>
                            <input placeholder="hh:mm (00/30)" value={timeInput} onChange={e => setTimeInput(e.target.value)} style={SX.input} />
                            <button style={SX.btn} onClick={addTime}>Thêm giờ</button>
                            <div style={{ fontSize: 12, color: "#64748b" }}>Hôm nay hệ thống tự bỏ giờ đã qua</div>
                        </div>

                        <div style={{ margin: "8px 0 12px" }}>
                            {times.map(t => (
                                <span key={t} style={SX.chip}>
                                    {t}
                                    <button style={SX.x} onClick={() => removeTime(t)} aria-label="x">×</button>
                                </span>
                            ))}
                            {times.length === 0 && <span style={{ color: "#94a3b8", fontSize: 12 }}>Chưa có giờ nào</span>}
                        </div>

                        <button style={SX.btnPrimary} onClick={createCustom}>Tạo slot</button>
                    </div>
                )}

                {tab === "range" && (
                    <div>
                        <div style={SX.rowWrap}>
                            <label>Từ ngày</label><input type="date" value={rFrom} onChange={e => setRFrom(e.target.value)} style={SX.input} />
                            <label>Đến ngày</label><input type="date" value={rTo} onChange={e => setRTo(e.target.value)} style={SX.input} />
                            <label>Phòng</label><input placeholder="VD P205" value={room} onChange={e => setRoom(e.target.value)} style={SX.input} required />
                        </div>

                        <div style={{ ...SX.row, alignItems: "center" }}>
                            <label>Giờ</label>
                            <input placeholder="hh:mm (00/30)" value={timeInput2} onChange={e => setTimeInput2(e.target.value)} style={SX.input} />
                            <button style={SX.btn} onClick={addTime2}>Thêm giờ</button>
                            <div style={{ fontSize: 12, color: "#64748b" }}>Các giờ này sẽ áp cho mọi ngày trong khoảng</div>
                        </div>

                        <div style={{ margin: "8px 0 12px" }}>
                            {times2.map(t => (
                                <span key={t} style={SX.chip}>
                                    {t}
                                    <button style={SX.x} onClick={() => removeTime2(t)} aria-label="x">×</button>
                                </span>
                            ))}
                            {times2.length === 0 && <span style={{ color: "#94a3b8", fontSize: 12 }}>Chưa có giờ nào</span>}
                        </div>

                        <button style={SX.btnPrimary} onClick={generateRange}>Thêm</button>
                    </div>
                )}
            </div>

            <div style={{ ...SX.card, marginTop: 16 }}>
                <div style={SX.rowListHeader}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <label>Xem slot</label>
                        <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={SX.input} />
                        <input type="date" value={to} onChange={e => setTo(e.target.value)} style={SX.input} />
                        <button style={SX.btn} onClick={load}>Tải</button>
                    </div>
                    {rows.length > pageSize && (
                        <div style={SX.pager}>
                            <button style={SX.btn} disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>‹ Trước</button>
                            <span style={{ color: "#475569" }}>Trang {page}/{totalPages}</span>
                            <button style={SX.btn} disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Sau ›</button>
                        </div>
                    )}
                </div>

                <div>
                    {pageRows.map(x => {
                        const isPast = !!x.is_past || new Date(x.start_time) < new Date();
                        const free = (x.capacity || 0) - (x.appt_cnt || 0) - (x.hold_cnt || 0);
                        const tag = isPast ? { bg: "#f3f4f6", color: "#374151", text: "Đã qua" } :
                            free > 0 ? { bg: "#dcfce7", color: "#166534", text: `${free} trống` } :
                                { bg: "#fee2e2", color: "#991b1b", text: "Hết chỗ" };
                        return (
                            <div key={x.id} style={{ ...SX.slotRow, opacity: isPast ? 0.6 : 1 }}>
                                <div style={SX.slotTime}>
                                    <div style={SX.slotDate}>{new Date(x.start_time).toLocaleDateString()}</div>
                                    <div style={SX.slotClock}>
                                        {new Date(x.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                        {" – "}
                                        {new Date(x.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                                    <span style={{ ...SX.badge, background: tag.bg, color: tag.color }}>{tag.text}</span>
                                    <span style={{ color: "#475569" }}>Phòng: <b>{x.room || "-"}</b></span>
                                </div>
                                <button
                                    style={{ ...SX.btnDanger, opacity: isPast ? 0.5 : 1 }}
                                    disabled={isPast}
                                    title={isPast ? "Slot đã qua giờ" : "Xoá slot"}
                                    onClick={() => {
                                        if (!confirm("Bạn có chắc muốn xoá slot này?")) return;
                                        authFetch(`${API}/doctor/schedules/${x.id}`, { method: "DELETE" })
                                            .then(load)
                                            .catch(async e => { try { alert(await e.text()); } catch { alert("Không xoá được"); } });
                                    }}
                                >
                                    Xoá
                                </button>
                            </div>
                        );
                    })}
                    {rows.length === 0 && <div style={{ padding: "8px 0", color: "#64748b" }}>Không có slot trong khoảng đã chọn.</div>}
                </div>
            </div>
        </div>
    );
}

/*CSS */
const SX = {
    page: { maxWidth: 1120, margin: "0 auto", padding: 16 },
    header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    title: { fontSize: 18, fontWeight: 700, color: "#0f172a" },
    legend: { display: "flex", gap: 8, alignItems: "center" },
    badge: { display: "inline-block", padding: "4px 8px", borderRadius: 999, fontSize: 12 },

    tabs: { display: "flex", gap: 8, marginBottom: 12 },
    tab: (on) => ({
        padding: "8px 12px",
        borderRadius: 999,
        border: `1px solid ${on ? "#0ea5e9" : "#e2e8f0"}`,
        background: on ? "#e0f2fe" : "#fff",
        color: on ? "#0369a1" : "#334155",
        cursor: "pointer"
    }),

    card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 16, boxShadow: "0 2px 10px rgba(2,6,23,.04)" },

    row: { display: "grid", gridTemplateColumns: "100px 200px 70px 1fr", gap: 8, alignItems: "center", marginBottom: 10 },
    rowWrap: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 },

    input: { border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 10px", outline: "none" },

    ck: { display: "inline-flex", gap: 6, alignItems: "center", border: "1px solid #e2e8f0", padding: "6px 10px", borderRadius: 10, background: "#f8fafc" },

    chip: { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #e2e8f0", background: "#f8fafc", padding: "6px 10px", borderRadius: 999, marginRight: 6, marginBottom: 6 },
    x: { border: "none", background: "transparent", color: "#ef4444", fontSize: 16, lineHeight: 1, cursor: "pointer" },

    btn: { border: "1px solid #0ea5e9", color: "#0369a1", background: "#fff", borderRadius: 10, padding: "8px 12px", cursor: "pointer" },
    btnPrimary: { border: "1px solid #0ea5e9", background: "#0ea5e9", color: "#fff", borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontWeight: 600 },
    btnDanger: { border: "1px solid #ef4444", color: "#991b1b", background: "#fff", borderRadius: 10, padding: "8px 12px", cursor: "pointer" },

    rowListHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
    pager: { display: "flex", alignItems: "center", gap: 8 },

    slotRow: { display: "grid", gridTemplateColumns: "260px 1fr 120px", alignItems: "center", borderTop: "1px solid #f1f5f9", padding: "10px 0" },
    slotTime: { display: "grid", gap: 4 },
    slotDate: { fontWeight: 600, color: "#0f172a" },
    slotClock: { color: "#475569" },
};
