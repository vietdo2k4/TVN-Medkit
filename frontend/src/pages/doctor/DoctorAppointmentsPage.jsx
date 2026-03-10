/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from "react";
import AppointmentDetail from "../../components/AppointmentDetail";
import { listDoctorAppointments, mutateDoctorAppointment, setDoctorPayment, getDoctorAppointment } from "../../api/doctor";

const LABEL = {
    pending: "Chờ xác nhận",
    confirmed: "Đã xác nhận",
    completed: "Đã khám",
    cancelled: "Đã hủy",
    no_show: "Vắng",
    paid: "Đã thanh toán",
    unpaid: "Chưa thanh toán",
    refunded: "Hoàn tiền",
};

const CANCEL_REASONS_DOCTOR = [
    "Bác sĩ có việc đột xuất",
    "Bệnh nhân vắng mặt",
    "Cơ sở quá tải/thiếu phòng",
    "Trùng lịch hoặc thay đổi lịch làm",
    "Không đủ hồ sơ/điều kiện tiếp nhận",
    "Khác",
];


export default function DoctorAppointmentsPage() {
    const today = new Date().toLocaleDateString("en-CA");

    const [q, setQ] = useState("");
    const [status, setStatus] = useState("");

    // bộ lọc ngày ẩn/hiện
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [from, setFrom] = useState(today);
    const [to, setTo] = useState(today);

    const [page, setPage] = useState(1);
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [limit] = useState(10);
    const [counts, setCounts] = useState({});
    const [loading, setLoading] = useState(false);

    // modal chi tiết
    const [open, setOpen] = useState(false);
    const [detail, setDetail] = useState(null);
    const [showPatient, setShowPatient] = useState(false);

    const totalAll = useMemo(
        () => Object.values(counts || {}).reduce((s, v) => s + (v || 0), 0),
        [counts]
    );

    async function load(p = page, over = {}) {
        setLoading(true);
        try {
            // chỉ truyền from/to khi bộ lọc mở
            const dateFilter = filtersOpen ? { from, to } : {};
            const cur = { q, status, page: p, limit, ...dateFilter, ...over };

            const data = await listDoctorAppointments(cur);

            // sắp xếp theo thời điểm đặt gần nhất
            const items = (data.items || []).slice().sort((a, b) => {
                const ta = new Date(a.bookedAt || a.createdAt || 0).getTime();
                const tb = new Date(b.bookedAt || b.createdAt || 0).getTime();
                return tb - ta; // mới nhất trước
            });

            setRows(items);
            setTotal(data.total || 0);
            setCounts(data.counts || {});
            setPage(data.page || p);
            if (over.status !== undefined) setStatus(over.status);
        } catch (e) {
            alert(e.message || "Không tải được danh sách");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(1); }, []);

    // auto reload 60s + lắng nghe tín hiệu từ chuông
    useEffect(() => {
        const t = setInterval(() => load(page), 60000);
        const h = () => load(page);
        window.addEventListener("tvn-notif", h);
        return () => { clearInterval(t); window.removeEventListener("tvn-notif", h); };
    }, [page, q, status, from, to, filtersOpen]);

    // mở form chi tiết
    useEffect(() => {
        const id = new URLSearchParams(location.search).get("view");
        if (id) viewDetail(Number(id));
    }, []);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    // util
    function toDT(d, t) { return new Date(`${d}T${t}:00`); }
    function endOf(r) { return new Date(toDT(r.date, r.time).getTime() + 60 * 60000); }
    function isExpired(r) { return new Date() > endOf(r); }
    function fmtDT(s) { try { return new Date(s).toLocaleString("vi-VN", { hour12: false }); } catch { return s || ""; } }

    function checkAllow(action, r) {
        const now = new Date();
        const start = toDT(r.date, r.time);
        const end = endOf(r);

        if (action === "confirm") {
            if (r.status !== "pending") return { ok: false, msg: "Chỉ xác nhận từ Chờ khám" };
            if (now >= start) return { ok: false, msg: "Đã quá giờ khám" };
            return { ok: true };
        }

        if (action === "cancel") {
            if (!["pending", "confirmed"].includes(r.status)) return { ok: false, msg: "Chỉ hủy từ Chờ khám/Đã xác nhận" };
            if (now >= start) return { ok: false, msg: "Đã quá giờ khám" };
            return { ok: true };
        }

        if (action === "complete") {
            if (r.status !== "confirmed") return { ok: false, msg: "Chỉ đánh Đã khám từ Đã xác nhận" };
            if (now < start) return { ok: false, msg: "Chưa tới giờ khám" };
            return { ok: true };
        }
        if (action === "no_show") {
            if (r.status !== "confirmed") return { ok: false, msg: "Chỉ đánh Vắng từ Đã xác nhận" };
            if (now <= end) return { ok: false, msg: "Chưa quá giờ kết thúc" };
            return { ok: true };
        }
        return { ok: false, msg: "Hành động không hợp lệ" };
    }

    async function onAction(r, action) {
        const allow = checkAllow(action, r);
        if (!allow.ok) return alert(allow.msg);

        if (action === "cancel") {
            setCancelForId(r.id);
            setReasonOpen(true);
            return;
        }

        if (!confirm(
            action === "no_show" ? "Đánh dấu bệnh nhân vắng?"
                : action === "complete" ? "Xác nhận đã khám xong?"
                    : "Thực hiện hành động?")) return;



        try {
            await mutateDoctorAppointment(r.id, action);
            await load(page);
        } catch (e) {
            alert(e.message || "Cập nhật thất bại");
        }
    }


    async function onPay(r) {
        if (r.status === "cancelled") return alert("Phiếu đã hủy. Không thể cập nhật thanh toán.");
        if (isExpired(r)) return alert("Phiếu đã quá hạn (quá giờ kết thúc). Không thể cập nhật thanh toán.");
        const next = r.paymentStatus === "paid" ? "unpaid" : "paid";
        try { await setDoctorPayment(r.id, next); await load(page); }
        catch (e) { alert(e.message || "Cập nhật thanh toán thất bại"); }
    }


    async function viewDetail(id) {
        try {
            const d = await getDoctorAppointment(id);
            setDetail({
                // --- các props đúng theo AppointmentDetail ---
                code: d.code || `TVN-${String(d.id).padStart(6, "0")}`,
                doctorName: d.doctor_name || d.doctorName || "",
                hospitalName: d.hospital_name || d.hospitalName || "",
                date: (d.date || d.day || "").slice(0, 10),
                time: (d.time || "").slice(0, 5),
                specialty: d.specialty_name || d.specialty || "",
                serviceName: d.service_name || d.serviceName || "",
                patientName: d.patient_name || d.patientName || "",

                patient: {
                    fullName: d.patient_name || d.patientName || "",
                    gender: d.gender || "",
                    dob: d.dob ? String(d.dob).slice(0, 10) : "",
                    phone: d.phone || "",
                    address: d.address || "",
                    insuranceNo: d.insurance_no || ""
                },
                symptoms_note: d.symptoms_note ?? d.symptomsNote ?? d.note ?? "",
                totalVnd: Number(d.total_vnd ?? d.fee_min ?? 0),
                status: d.status,
                paymentStatus: d.payment_status || d.paymentStatus || "",
                cancel_reason: d.cancel_reason || "",
                embedded: true,



            });

            setOpen(true);
            setShowPatient(false);
        } catch (e) {
            alert(e.message || "Không tải được chi tiết");
        }
    }

    const tabs = [
        { key: "", label: `Tất cả (${totalAll})` },
        { key: "pending", label: `Chờ khám (${counts.pending || 0})` },
        { key: "confirmed", label: `Đã xác nhận (${counts.confirmed || 0})` },
        { key: "completed", label: `Đã khám (${counts.completed || 0})` },
        { key: "cancelled", label: `Đã hủy (${counts.cancelled || 0})` },
        { key: "no_show", label: `Vắng (${counts.no_show || 0})` },
    ];

    const [reasonOpen, setReasonOpen] = useState(false);
    const [cancelForId, setCancelForId] = useState(null);
    const [customReason, setCustomReason] = useState("");

    const [confirmReason, setConfirmReason] = useState("");   //Chọn lí do hủy ->> xác nhận
    const [confirmBusy, setConfirmBusy] = useState(false);

    function onPickReason(r) {
        const text = String(r || "").trim();
        if (!text) return;
        setConfirmReason(text);
    }

    async function doDoctorCancel(reasonText) {
        const id = cancelForId;
        if (!id) return;
        try {
            setConfirmBusy(true);
            await mutateDoctorAppointment(id, "cancel", { reason: reasonText });
            setReasonOpen(false);
            setCancelForId(null);
            setCustomReason("");
            setConfirmReason("");
            await load(page);
        } catch (e) { alert(e.message || "Hủy thất bại"); }
        finally { setConfirmBusy(false); }
    }

    return (
        <div style={S.page}>
            <div style={S.head}>
                <div style={S.title}>Lịch hẹn</div>

                {/* Nhóm nút thao tác lọc */}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button style={S.btnLight} onClick={() => setFiltersOpen(v => !v)}>
                        {filtersOpen ? "Ẩn bộ lọc" : "Bộ lọc"}
                    </button>
                    <input
                        style={S.input}
                        placeholder="Tìm bệnh nhân / mã"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                    <button style={S.btn} onClick={() => load(1)} disabled={loading}>Tải</button>
                </div>
            </div>

            {/* Khi cần mới mở lọc ngày */}
            {filtersOpen && (
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <input type="date" style={S.input} value={from} onChange={e => setFrom(e.target.value)} />
                    <input type="date" style={S.input} value={to} onChange={e => setTo(e.target.value)} />
                </div>
            )}

            <div style={S.tabs}>
                {tabs.map(t => (
                    <button key={t.key} onClick={() => load(1, { status: t.key })} style={S.tab(t.key === status)} disabled={loading}>
                        {t.label}
                    </button>
                ))}
            </div>

            <div style={S.card}>
                {rows.map((r) => {
                    const aConfirm = checkAllow("confirm", r);
                    const aComplete = checkAllow("complete", r);
                    const aNoShow = checkAllow("no_show", r);
                    const aCancel = checkAllow("cancel", r);
                    const canPay = r.status !== "cancelled" && !isExpired(r);

                    return (
                        <div key={r.id} style={S.row}>
                            <div style={S.colMain}>
                                <div style={S.row1}>
                                    <div style={S.when}>
                                        <div><b>BN:</b> {r.patientName}</div>
                                        <div>{r.date} • {r.time}</div>
                                        {/* <div>Phòng {r.room || "-"}</div> */}
                                    </div>
                                    <div style={S.badges}>
                                        <span style={S.badge(r.status)}>{LABEL[r.status] || r.status}</span>
                                        <span style={S.badge(r.paymentStatus)}>{LABEL[r.paymentStatus] || r.paymentStatus}</span>
                                    </div>
                                </div>
                                <div style={S.hospital}>{r.hospitalName}</div>
                            </div>

                            <div style={S.actions}>
                                {r.bookedAt && <div style={S.booked}>Đặt lúc: {fmtDT(r.bookedAt || r.createdAt)}</div>}
                                <div style={S.btnRow}>
                                    <button style={S.btnLight} onClick={() => viewDetail(r.id)}>Xem</button>
                                    <button style={aConfirm.ok ? S.btn : S.btnGhost} title={aConfirm.ok ? "" : aConfirm.msg} onClick={() => onAction(r, "confirm")}>Xác nhận</button>
                                    <button style={aComplete.ok ? S.btn : S.btnGhost} title={aComplete.ok ? "" : aComplete.msg} onClick={() => onAction(r, "complete")}>Đã khám</button>
                                    <button style={aNoShow.ok ? S.btn : S.btnGhost} title={aNoShow.ok ? "" : aNoShow.msg} onClick={() => onAction(r, "no_show")}>Vắng</button>
                                    <button style={aCancel.ok ? S.btnDanger : S.btnGhost} title={aCancel.ok ? "" : aCancel.msg} onClick={() => onAction(r, "cancel")}>Hủy</button>
                                    <button style={canPay ? S.btnLight : S.btnGhost} disabled={!canPay} title={canPay ? "" : (r.status === "cancelled" ? "Phiếu đã hủy. Không thể cập nhật thanh toán" : "Phiếu đã quá hạn. Không thể cập nhật thanh toán")} onClick={() => onPay(r)}>
                                        {r.paymentStatus === "paid" ? "Bỏ đánh dấu thanh toán" : "Đánh dấu đã thanh toán"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {rows.length === 0 && <div style={{ padding: 12, color: "#64748b" }}>Không có dữ liệu.</div>}
            </div>

            <div style={S.pager}>
                <button style={S.btn} disabled={page <= 1 || loading} onClick={() => { const p = Math.max(1, page - 1); load(p); }}>« Trước</button>
                <span>Trang {page}/{totalPages}</span>
                <button style={S.btn} disabled={page >= totalPages || loading} onClick={() => { const p = Math.min(totalPages, page + 1); load(p); }}>Sau »</button>
            </div>

            {open && (
                <div style={S.modalOverlay} onClick={() => setOpen(false)}>
                    <div style={S.modal} onClick={(e) => e.stopPropagation()}>
                        <div style={S.modalHead}>
                            <b>Chi tiết phiếu khám</b>
                            <div style={{ display: "flex", gap: 8 }}>
                                {detail?.patient && (
                                    <button style={S.linkBtn} onClick={() => setShowPatient(v => !v)}>
                                        {showPatient ? "Ẩn" : "Xem"} Thông tin bệnh nhân
                                    </button>
                                )}
                                <button style={S.modalClose} onClick={() => setOpen(false)}>×</button>
                            </div>
                        </div>

                        <div style={{ position: "relative" }}>
                            <div style={{ padding: 14 }}>{detail && <AppointmentDetail {...detail} />}</div>

                            {detail?.patient && (
                                <aside style={{ ...S.patientDrawer, transform: showPatient ? "translateX(0)" : "translateX(100%)" }}>
                                    <div style={S.patientHead}>Thông tin bệnh nhân</div>
                                    <div style={S.patientBody}>
                                        <div>Họ tên</div><div>{detail.patient.fullName || "-"}</div>
                                        <div>Giới tính</div><div>{detail.patient.gender || "-"}</div>
                                        <div>Ngày sinh</div><div>{detail.patient.dob || "-"}</div>
                                        <div>Điện thoại</div><div>{detail.patient.phone || "-"}</div>
                                        <div>Địa chỉ</div><div>{detail.patient.address || "-"}</div>
                                        <div>Số BHYT</div><div>{detail.patient.insuranceNo || "-"}</div>
                                    </div>
                                </aside>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {reasonOpen && (
                <div style={S.reasonOverlay} onClick={() => setReasonOpen(false)}>
                    <div style={S.reasonCard} onClick={(e) => e.stopPropagation()}>
                        <div style={S.reasonTitle}>Chọn lý do hủy</div>
                        <div style={S.reasonList}>
                            {CANCEL_REASONS_DOCTOR.map(r => (
                                <button key={r} style={S.reasonBtn} onClick={() => onPickReason(r)}>{r}</button>
                            ))}
                        </div>
                        <div style={S.reasonCustom}>
                            <input style={S.reasonInput} placeholder="Lý do khác..." value={customReason} onChange={e => setCustomReason(e.target.value)} />
                        </div>
                        <button style={S.modalClose} onClick={() => setReasonOpen(false)}>Đóng</button>
                    </div>
                    {/* Toast xác nhận hủy: xuất hiện sau khi đã chọn lý do */}
                    {confirmReason && (
                        <div style={S.confirmToast} onClick={(e) => e.stopPropagation()}>
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>Xác nhận hủy phiếu?</div>
                            <div style={{ fontSize: 13, color: "#475569", marginBottom: 8 }}>
                                Lý do: <i>{confirmReason}</i>
                            </div>
                            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                <button
                                    style={S.btnLight}
                                    disabled={confirmBusy}
                                    onClick={() => setConfirmReason("")}  // quay lại chọn lý do
                                >
                                    Quay lại
                                </button>
                                <button
                                    style={S.btnDanger}
                                    disabled={confirmBusy}
                                    onClick={() => doDoctorCancel(confirmReason)}
                                >
                                    {confirmBusy ? "Đang hủy..." : "Xác nhận hủy"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

const S = {
    page: { maxWidth: 1120, margin: "0 auto", padding: 16, color: "#0f172a" },
    head: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    title: { fontSize: 20, fontWeight: 800 },
    input: { border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 10px", outline: "none" },

    card: { display: "grid", gap: 10, background: "transparent", border: "none", padding: 2 },
    row: { display: "grid", gridTemplateColumns: "minmax(0,1fr) 420px", gap: 12, alignItems: "center", padding: "12px 16px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, boxShadow: "0 2px 10px rgba(2,6,23,.04)" },

    colMain: { display: "grid", gap: 8, minWidth: 0 },
    row1: { display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, alignItems: "center" },
    when: { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" },
    badges: { display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap" },
    hospital: { color: "#475569" },

    actions: { display: "grid", gap: 6, justifyItems: "end" },
    booked: { fontSize: 12, color: "#64748b" },
    btnRow: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" },

    btn: { border: "1px solid #0ea5e9", background: "#fff", color: "#0369a1", padding: "8px 12px", borderRadius: 10, cursor: "pointer" },
    btnLight: { border: "1px solid #e2e8f0", background: "#f8fafc", color: "#0f172a", padding: "8px 12px", borderRadius: 10, cursor: "pointer" },
    btnDanger: { border: "1px solid #ef4444", background: "#fff", color: "#991b1b", padding: "8px 12px", borderRadius: 10, cursor: "pointer" },
    btnGhost: { border: "1px solid #e2e8f0", background: "#f8fafc", color: "#94a3b8", padding: "8px 12px", borderRadius: 10, cursor: "pointer" },

    badge: (st) => ({
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        height: 26, minWidth: 130, padding: "0 10px",
        borderRadius: 999, fontSize: 12, fontWeight: 600, textAlign: "center",
        background:
            st === "paid" ? "#dcfce7" :
                st === "unpaid" ? "#fef9c3" :
                    st === "refunded" ? "#e0e7ff" :
                        st === "pending" ? "#e0f2fe" :
                            st === "confirmed" ? "#cffafe" :
                                st === "completed" ? "#dcfce7" :
                                    st === "cancelled" ? "#fee2e2" :
                                        st === "no_show" ? "#fde68a" : "#f1f5f9",
        color:
            st === "paid" ? "#166534" :
                st === "unpaid" ? "#92400e" :
                    st === "refunded" ? "#3730a3" :
                        st === "pending" ? "#075985" :
                            st === "confirmed" ? "#155e75" :
                                st === "completed" ? "#166534" :
                                    st === "cancelled" ? "#991b1b" :
                                        st === "no_show" ? "#92400e" : "#334155",
    }),

    tabs: { display: "flex", gap: 8, margin: "6px 0 12px", flexWrap: "wrap" },
    tab: (on) => ({ padding: "8px 12px", borderRadius: 999, border: `1px solid ${on ? "#0ea5e9" : "#e2e8f0"}`, background: on ? "#e0f2fe" : "#fff", color: on ? "#0369a1" : "#334155", cursor: "pointer" }),

    pager: { display: "flex", gap: 12, alignItems: "center", justifyContent: "center", marginTop: 12 },

    // modal + drawer
    modalOverlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,.35)", display: "grid", placeItems: "center", zIndex: 1000 },
    modal: { width: "min(840px, 96vw)", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, boxShadow: "0 10px 30px rgba(2,6,23,.2)", overflow: "hidden" },
    modalHead: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #f1f5f9" },
    modalClose: { border: "none", background: "transparent", fontSize: 22, lineHeight: 1, cursor: "pointer", color: "#334155" },
    linkBtn: { border: "1px solid #e2e8f0", background: "#f8fafc", color: "#0f172a", padding: "6px 10px", borderRadius: 8, cursor: "pointer" },

    patientDrawer: { position: "absolute", top: 0, right: 0, width: 340, height: "100%", background: "#f8fafc", borderLeft: "1px solid #eef2f7", boxShadow: "inset 0 0 0 1px #eef2f7", transition: "transform .18s ease" },
    patientHead: { padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #eef2f7" },
    patientBody: { padding: 12, display: "grid", gridTemplateColumns: "140px 1fr", rowGap: 6, columnGap: 10, color: "#334155" },

    reasonOverlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "grid", placeItems: "center", zIndex: 1000 },
    reasonCard: { width: "min(520px,94vw)", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, boxShadow: "0 10px 30px rgba(2,6,23,.2)", padding: 14 },
    reasonTitle: { fontWeight: 800, marginBottom: 10 },
    reasonList: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 },
    reasonBtn: { border: "1px solid #e2e8f0", background: "#f8fafc", color: "#0f172a", padding: 8, borderRadius: 10, cursor: "pointer", textAlign: "left" },
    reasonCustom: { display: "flex", gap: 8, alignItems: "center", marginTop: 6 },
    reasonInput: { flex: 1, border: "1px solid #e2e8f0", borderRadius: 10, padding: 8 },
    reasonSubmit: { border: "1px solid #0ea5e9", background: "#fff", color: "#0369a1", padding: "8px 12px", borderRadius: 10, cursor: "pointer" },
    confirmToast: {
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 1101,
        background: "#fff",
        border: "1px solid #fde68a",
        boxShadow: "0 12px 36px rgba(2,6,23,.28)",
        borderRadius: 14,
        padding: 14,
    },
};
