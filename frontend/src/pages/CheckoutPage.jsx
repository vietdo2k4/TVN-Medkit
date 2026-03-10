// src/pages/CheckoutPage.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createBooking, createHold, releaseHold } from "../api/booking";
import AlertModal from "../components/AlertModal";
import "../styles/checkout.css";

//Helper: Chuẩn hóa giới tính về Nam/Nữ/Khác
function normGender(x) {
    const v = String(x || "").toLowerCase();
    if (v === "nam" || v === "male" || v === "m") return "Nam";
    if (v === "nữ" || v === "nu" || v === "female" || v === "f") return "Nữ";
    return "Khác";
}
const weekDayVi = ["CN", "Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7"];

export default function CheckoutPage() {
    const nav = useNavigate();
    const { state } = useLocation(); // { doctor, dateISO, slot }
    const doctor = state?.doctor;
    const dateISO = state?.dateISO;
    const slot = state?.slot;

    //useEffect: Redirect về trang trước nếu thiếu thông tin bắt buộc (doctor, ngày, slot)
    //Dependencies: [doctor, dateISO, slot, nav] - check ngay khi component mount
    useEffect(() => { if (!doctor || !dateISO || !slot) nav(-1); }, [doctor, dateISO, slot, nav]);

    //useEffect: Tự động giữ chỗ (hold) slot khi vào trang checkout
    //Dependencies: [slot?.scheduleId, nav] - chạy khi slot thay đổi
    //Tạo firm hold để khóa slot trong thời gian checkout, set timeout để redirect khi hết hạn
    useEffect(() => {
        let timerId;
        (async () => {
            try {
                if (!slot?.scheduleId) return;
                const r = await createHold({ scheduleId: slot.scheduleId, firm: true });
                const t = new Date(r.expiresAt).getTime() - Date.now();
                if (t <= 0) {
                    alert("Đã hết thời gian giữ chỗ"); nav(-1); return;
                }

                timerId = setTimeout(() => { alert("Đã hết thời gian giữ chỗ"); nav(-1); }, t);
            } catch {
                alert("Khung giờ đang được giữ, vui lòng chọn giờ khác.");
                nav(-1);
            }
        })();
        return () => { if (timerId) clearTimeout(timerId); };
    }, [slot?.scheduleId, nav]);

    //useMemo: Format ngày sang tiếng Việt - ví dụ: "Th 2 - 15/1/2026"
    //Dependencies: [dateISO] - chỉ format lại khi ngày thay đổi
    const datePretty = useMemo(() => {
        if (!dateISO) return "";
        const d = new Date(dateISO + "T00:00:00");
        return `${weekDayVi[d.getDay()]} - ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    }, [dateISO]);

    //useState: Thu gọn/mở rộng phần hồ sơ bệnh nhân - toggle collapse UI
    const [collapsed, setCollapsed] = useState(false);

    //useState: Lưu thông tin hồ sơ bệnh nhân (name, gender, email, phone, address)
    //Tự động điền từ API /me nếu đăng nhập
    const [profile, setProfile] = useState({ name: "", gender: "", email: "", phone: "", address: "" });

    //useEffect: Tự động điền thông tin từ hồ sơ đã lưu (gọi API /me)
    //Dependencies: [] - chỉ chạy 1 lần khi mount
    //Nếu đăng nhập, fetch thông tin user và điền vào form
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) return;
        (async () => {
            const r = await fetch(`${import.meta.env.VITE_API_BASE_URL}/me`, { headers: { Authorization: `Bearer ${token}` } });
            if (!r.ok) return;
            const data = await r.json();
            const p = data?.profile || {};
            const u = data?.user || {};
            setProfile(prev => ({
                name: prev.name || p.full_name || "",
                gender: prev.gender || normGender(p.gender) || "Nam",
                email: prev.email || u.email || "",
                phone: prev.phone || p.phone || "",
                address: prev.address || p.address || "",
            }));
        })();
    }, []);

    //useState: Lý do khám bệnh - triệu chứng, tiền sử bệnh...
    const [reason, setReason] = useState("");

    //useState: Phương thức thanh toán - "cash" (tiền mặt) hoặc "online" (chuyển khoản)
    const [payMethod, setPayMethod] = useState("cash");

    //useMemo: Tính tổng tiền khám - lấy từ fee của bác sĩ
    //Dependencies: [doctor?.fee_min, doctor?.fee_max] - tính lại khi fee thay đổi
    const subtotal = useMemo(() => {
        const v = doctor?.fee_min ?? doctor?.fee_max ?? 0;
        return Number.isFinite(+v) ? +v : 0;
    }, [doctor?.fee_min, doctor?.fee_max]);

    //useState: Hiện/ẩn popup thông báo lỗi
    const [popupOpen, setPopupOpen] = useState(false);

    //useState: Nội dung thông báo lỗi trong popup
    const [popupMsg, setPopupMsg] = useState("");

    //useState: Thông báo nhỏ (toast) hiển thị tạm thời - tự tắt sau 2.2s
    const [toast, setToast] = useState("");

    //useRef: Lưu ID của timer toast - dùng để clear timeout khi toast mới hiển thị
    const toastTimer = useRef(null);
    //Hàm hiển toast (tự tắt sau 2.2s)
    function showToast(msg) {
        setToast(msg);
        if (toastTimer.current)
            clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(""), 2200);
    }

    //Hàm xử lý submit form đặt lịch
    async function onSubmit(e) {
        e.preventDefault();

        //Validate lý do khám không được để trống
        if (!reason.trim()) {
            showToast("Lý do khám không được để trống");
            return;
        }

        //Tạo payload gửi lên API
        const payload = {
            doctorId: doctor.id,
            date: dateISO,
            slot: slot.time,
            symptoms_note: reason,
            payMethod,
            patient: {
                full_name: profile.name,
                gender: profile.gender,
                email: profile.email,
                phone: profile.phone,
                address: profile.address,
            },
        };

        try {
            //Gọi API tạo booking
            const res = await createBooking(payload);
            const appointmentId = res?.appointmentId ?? res?.appointment_id ?? res?.id;
            if (!appointmentId)
                throw new Error("Không nhận được mã đặt lịch");

            //Lưu giá khám vào sessionStorage để dùng ở trang success
            sessionStorage.setItem(`fee:${appointmentId}`, String(res?.price ?? subtotal));
            //Broadcast event để các tab khác biết slot đã thay đổi
            try {
                const bc = new BroadcastChannel("tvnmedkit-slots");
                bc.postMessage("refresh-slots");
                bc.close();
            } catch { /* empty */ }

            //Chuyển đến trang thành công
            nav(`/booking-success/${appointmentId}`);
        } catch (err) {
            //Xử lý lỗi: Hiển popup thông báo
            const raw = String(err?.message || "Đặt lịch thất bại");
            const pretty = /hết chỗ|được đặt|duplicate/i.test(raw)
                ? "Khung giờ đã hết chỗ. Vui lòng chọn khung giờ khác."
                : raw;
            setPopupMsg(pretty);
            setPopupOpen(true);
        }
    }

    if (!doctor || !dateISO || !slot) return null;

    return (
        <main className="container checkout-grid">
            <form id="checkoutForm" className="ck-left" onSubmit={onSubmit}>
                <section className="ck-card">
                    <div className="ck-card__head"><h3>1. Ngày và giờ khám</h3></div>
                    <div className="ck-row2">
                        <div><div className="ck-label">Ngày khám</div><div className="ck-value">{datePretty}</div></div>
                        <div><div className="ck-label">Khung giờ</div><div className="ck-value">{slot.time}</div></div>
                    </div>
                </section>

                <section className="ck-card">
                    <div className="ck-card__head">
                        <h3>2. Hồ sơ bệnh nhân</h3>
                        <button type="button" className="ck-toggle" onClick={() => setCollapsed((v) => !v)} aria-expanded={!collapsed}>
                            {collapsed ? "Mở rộng" : "Thu gọn"} <span className={"chev " + (collapsed ? "" : "open")}>▾</span>
                        </button>
                    </div>

                    {!collapsed && (
                        <div className="ck-form" aria-readonly>
                            <div className="ck-grid2">
                                <div className="ck-field">
                                    <label className="label">Họ và tên</label>
                                    <input className="input" value={profile.name} disabled readOnly />
                                </div>
                                <div className="ck-field">
                                    <label className="label">Giới tính</label>
                                    <select className="input" value={profile.gender} disabled readOnly>
                                        <option>Nam</option><option>Nữ</option><option>Khác</option>
                                    </select>
                                </div>
                            </div>

                            <div className="ck-grid2">
                                <div className="ck-field">
                                    <label className="label">Email</label>
                                    <input className="input" type="email" value={profile.email} disabled readOnly />
                                </div>
                                <div className="ck-field">
                                    <label className="label">Số điện thoại</label>
                                    <input className="input" value={profile.phone} disabled readOnly />
                                </div>
                            </div>

                            <div className="ck-field">
                                <label className="label">Địa chỉ</label>
                                <input className="input" value={profile.address} disabled readOnly />
                            </div>
                        </div>
                    )}
                </section>

                <section className="ck-card">
                    <div className="ck-card__head"><h3>3. Thông tin khám & thanh toán</h3></div>

                    <div className="ck-field">
                        <label className="label">Lý do đi khám</label>
                        <textarea
                            className="input"
                            rows={4}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Triệu chứng, dị ứng thuốc, tiền sử…"
                        />
                    </div>

                    <div className="ck-field">
                        <div className="label">Phương thức thanh toán</div>
                        <div className="radio-group">
                            <label className="radio">
                                <input type="radio" name="pay" checked={payMethod === "cash"} onChange={() => setPayMethod("cash")} />
                                <span>Tiền mặt</span>
                            </label>
                            <label className="radio disabled" title="Tạm thời bảo trì">
                                <input type="radio" name="pay" disabled />
                                <span>Chuyển khoản trực tuyến (bảo trì)</span>
                            </label>
                        </div>
                    </div>
                </section>
            </form>

            <aside className="ck-right">
                <div className="summary-card">
                    <div className="sum-top">
                        <img
                            className="sum-avatar"
                            src={doctor.avatar || "/assets/images/doctor.png"}
                            onError={(e) => (e.currentTarget.src = "/assets/images/doctor.png")}
                            alt={doctor.full_name || doctor.name}
                        />
                        <div>
                            <div className="sum-name">{doctor.full_name || doctor.name}</div>
                            <div className="sum-sub">{doctor.hospital}</div>
                        </div>
                    </div>

                    <div className="sum-row"><div className="sum-label">Ngày khám</div><div className="sum-val">{datePretty}</div></div>
                    <div className="sum-row"><div className="sum-label">Khung giờ</div><div className="sum-val">{slot.time}</div></div>
                    <div className="sum-row"><div className="sum-label">Bệnh nhân</div><div className="sum-val">{profile.name || "—"}</div></div>

                    <div className="sum-total">
                        <div className="sum-label">Tổng tiền</div>
                        <div className="sum-price">{subtotal.toLocaleString("vi-VN")} VND</div>
                    </div>

                    <div className="sum-actions">
                        <button type="button" className="btn ghost" onClick={() => { releaseHold(slot?.scheduleId); nav(-1); }}>Quay lại</button>
                        <button type="submit" form="checkoutForm" className="btn">Đặt lịch</button>
                    </div>

                    <p className="sum-note">
                        Bằng cách nhấn nút <b>Đặt lịch</b>, bạn đã đồng ý với các điều khoản đặt khám.
                    </p>
                </div>
            </aside>

            {/* Toast nhỏ */}
            <div className={"ck-toast " + (toast ? "show" : "")}>{toast}</div>

            <AlertModal
                open={popupOpen}
                title="Không thể đặt lịch"
                message={popupMsg}
                actions={[
                    { label: "Quay lại chọn giờ", variant: "btn btn-secondary", onClick: () => { setPopupOpen(false); nav(-1); } },
                    { label: "Đóng", variant: "btn btn-primary", onClick: () => setPopupOpen(false) },
                ]}
                onClose={() => setPopupOpen(false)}
            />
        </main>
    );
}
