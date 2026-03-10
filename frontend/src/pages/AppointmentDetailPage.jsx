import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppointmentDetail from "../components/AppointmentDetail";
import "../styles/appointments-list.css";

export default function AppointmentDetailPage() {
    //Danh sách lý do hủy cho user chọn
    const CANCEL_REASONS_USER = [
        "Bận việc đột xuất",
        "Đặt nhầm bác sĩ/khung giờ",
        "Thay đổi kế hoạch",
        "Cải thiện triệu chứng",
        "Muốn chọn cơ sở/bác sĩ khác",
        "Chi phí không phù hợp",
        "Di chuyển khó khăn",
        "Khác",
    ];

    //Lấy ID appointment từ URL
    const { id } = useParams();
    //Function để chuyển trang
    const nav = useNavigate();
    //Base URL của backend API
    const API = import.meta.env.VITE_API_BASE_URL;
    //JWT token để xác thực API
    const token = localStorage.getItem("token");

    //State: Dữ liệu chi tiết phiếu khám
    const [data, setData] = useState(null);
    //State: Đang tải dữ liệu
    const [loading, setLoading] = useState(true);

    //Gọi API lấy chi tiết phiếu khám
    useEffect(() => {
        if (!token) return;
        (async () => {
            setLoading(true);
            try {
                const r = await fetch(`${API}/me/appointments/${id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setData(r.ok ? await r.json() : null);
            } catch {
                setData(null);
            } finally {
                setLoading(false);
            }
        })();
    }, [API, token, id]);

    //Lấy giá khám từ data hoặc sessionStorage
    const totalVnd = useMemo(() => {
        const be = Number(data?.price ?? data?.total ?? NaN);
        if (Number.isFinite(be)) return be;  //Kiểm tra số hợp lệ
        const cached = Number(sessionStorage.getItem(`fee:${id}`) ?? NaN);
        return Number.isFinite(cached) ? cached : 0;
    }, [data, id]);

    // Có thể hủy khi: chưa cancelled/completed/confirmed và còn trước giờ khám
    //Kiểm tra xem phiếu có thể hủy không (dựa vào status và thời gian khám)
    const { canCancel, cantReason } = useMemo(() => {
        if (!data) return { canCancel: false, cantReason: "Không thể hủy" };
        const st = String(data.status || "").toLowerCase();
        if (st === "cancelled") return { canCancel: false, cantReason: "Phiếu đã được hủy" };
        if (st === "completed") return { canCancel: false, cantReason: "Phiếu đã khám" };
        if (st === "confirmed") return { canCancel: false, cantReason: "Phiếu đã được bác sĩ xác nhận, không thể hủy" };
        const d = data.date || data.day || "";
        const t = data.time || "00:00";
        const start = new Date(`${d}T${t}:00`);
        if (Number.isFinite(start.getTime()) && start <= new Date()) {
            return { canCancel: false, cantReason: "Đã quá thời gian khám" };
        }
        return { canCancel: true, cantReason: "" };
    }, [data]);

    // UI hủy
    //State: Modal chọn lý do hủy có mở không
    const [pickOpen, setPickOpen] = useState(false);
    //State: Lý do hủy tự nhập (nếu chọn "Khác")
    const [customReason, setCustomReason] = useState("");
    //State: Lý do đã chọn, chờ xác nhận
    const [confirmReason, setConfirmReason] = useState("");
    //State: Đang gọi API hủy
    const [confirmBusy, setConfirmBusy] = useState(false);

    // Gọi API sau khi đã xác nhận
    //Hàm gọi API hủy phiếu khám (sau khi user confirm)
    async function submitCancel(reason) {
        try {
            setConfirmBusy(true);
            const r = await fetch(`${API}/me/appointments/${id}/cancel`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ reason: reason || customReason || "user: cancel" }),
            });
            if (!r.ok) {
                const e = await r.json().catch(() => ({}));
                throw new Error(e.message || "Hủy phiếu thất bại");
            }
            alert("Đã hủy phiếu");
            nav("/me/appointments", { replace: true });
        } catch (err) {
            alert(err.message || "Hủy phiếu thất bại");
        } finally {
            setConfirmBusy(false);
            setConfirmReason("");
            setPickOpen(false);
        }
    }

    // Chọn lý do nhưng CHƯA hủy ngay → bật toast xác nhận
    //Hàm xử lý khi user chọn 1 lý do hủy (hiện toast confirm)
    function onPickReason(r) {
        const text = String(r || "").trim();
        if (!text) return;
        setConfirmReason(text);
    }

    if (loading) return <div className="appt__empty">Đang tải chi tiết…</div>;
    if (!data) return <div className="appt__empty">Không tìm thấy phiếu.</div>;

    const lockChipClass = (() => {
        const st = String(data?.status || "").toLowerCase();
        if (st === "completed") return "completed";
        if (st === "confirmed") return "confirmed";
        if (st === "cancelled") return "cancelled";
        return "neutral";
    })();

    return (
        <div className="appt-detail">
            <div className="appt-detail__head">
                <button className="btn btn-secondary" onClick={() => nav(-1)}>← Quay lại</button>
                <h2>Chi tiết phiếu khám</h2>
                <button
                    className="btn btn-danger"
                    onClick={() => canCancel && setPickOpen(true)}
                    disabled={!canCancel}
                    title={canCancel ? "" : cantReason}
                >
                    Hủy phiếu
                </button>
            </div>

            {!canCancel && cantReason && (
                <div className="appt__notice appt__notice--lock">
                    <span className={"apd-chip " + lockChipClass}>{cantReason}</span>
                </div>
            )}

            <AppointmentDetail
                code={data.code || `TVN-${String(id).padStart(6, "0")}`}
                doctorName={data.doctor_name || data.doctorName}
                hospitalName={data.hospital_name || data.hospitalName}
                date={data.date || data.day}
                time={data.time}
                specialty={data.specialty_name || data.specialty}
                serviceName={data.service_name || data.serviceName}
                patientName={data.patient_name || data.patientName}
                symptoms_note={data.symptoms_note || ""}
                totalVnd={totalVnd}
                status={data.status}
                paymentStatus={data.payment_status || data.paymentStatus}
                cancel_reason={data.cancel_reason || ""}
            />

            {/* Lựa chọn lý do hủy */}
            {pickOpen && (
                <div className="reason-modal__overlay" onClick={() => setPickOpen(false)}>
                    <div className="reason-modal__card" onClick={(e) => e.stopPropagation()}>
                        <div className="reason-modal__title">Chọn lý do hủy</div>
                        <div className="reason-modal__list">
                            {CANCEL_REASONS_USER.map((r) => (
                                <button key={r} className="reason-modal__btn" onClick={() => onPickReason(r)}>
                                    {r}
                                </button>
                            ))}
                        </div>
                        <div className="reason-modal__custom">
                            <input
                                className="reason-modal__input"
                                placeholder="Lý do khác..."
                                value={customReason}
                                onChange={(e) => setCustomReason(e.target.value)}
                            />
                        </div>
                        <button className="reason-modal__close" onClick={() => setPickOpen(false)}>Đóng</button>
                    </div>

                    {/* Toast xác nhận hủy: xuất hiện sau khi đã chọn lý do */}
                    {confirmReason && (
                        <div className="confirm-toast" onClick={(e) => e.stopPropagation()}>
                            <div style={{ fontWeight: 800, marginBottom: 4 }}>Xác nhận hủy phiếu?</div>
                            <div style={{ fontSize: 13, color: "#475569", marginBottom: 8 }}>
                                Lý do: <i>{confirmReason}</i>
                            </div>
                            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                <button className="btn btn-secondary" disabled={confirmBusy}
                                    onClick={() => setConfirmReason("")}>
                                    Quay lại
                                </button>
                                <button className="btn btn-danger" disabled={confirmBusy}
                                    onClick={() => submitCancel(confirmReason)}>
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
