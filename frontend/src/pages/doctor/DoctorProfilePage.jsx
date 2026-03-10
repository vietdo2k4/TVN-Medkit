/* eslint-disable no-useless-escape */
// frontend/src/pages/doctor/DoctorProfilePage.jsx
import { useEffect, useMemo, useState } from "react";
import { changeMyPassword } from "../../api/doctor";

export default function DoctorProfilePage() {
    const API = import.meta.env.VITE_API_BASE_URL;
    const token = localStorage.getItem("token");

    // ----- state chung -----
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // ----- dữ liệu hồ sơ -----
    const [doctor, setDoctor] = useState({
        full_name: "", gender: "Nam", avatar: "",
        specialty_id: null, hospital_id: null,
        experience_years: null, fee_min: null, bio: ""
    });
    const [options, setOptions] = useState({ specialties: [], hospitals: [] });

    // ----- đổi mật khẩu -----
    const [showPwd, setShowPwd] = useState(false);   // bật modal đổi MK (đè toàn trang)
    const [oldPwd, setOldPwd] = useState("");
    const [newPwd, setNewPwd] = useState("");
    const [rePwd, setRePwd] = useState("");
    const [pwdBusy, setPwdBusy] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false); // modal xác nhận (đè lên modal đổi MK)

    // ===== tải hồ sơ =====
    useEffect(() => {
        if (!token) return;
        (async () => {
            setLoading(true);
            try {
                const r = await fetch(`${API}/doctor/me`, { headers: { Authorization: `Bearer ${token}` } });
                const d = await r.json();
                setDoctor((s) => ({ ...s, ...d.doctor, gender: d.doctor?.gender || "Nam" }));
                setOptions({ specialties: d.specialties || [], hospitals: d.hospitals || [] });
            } catch (e) {
                alert(e.message || "Không tải được hồ sơ");
            } finally {
                setLoading(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ảnh xem trước
    const avatarPreview = useMemo(() => String(doctor.avatar || "") || "/assets/doctors/default.png", [doctor.avatar]);

    // gợi ý đường dẫn ảnh (không upload thật)
    function onPickFile(ev) {
        const f = ev.target.files?.[0];
        if (!f) return;
        const safeName = f.name.replace(/[^\w.\-]+/g, "_");
        setDoctor((s) => ({ ...s, avatar: `/assets/doctors/${safeName}` }));
    }

    // lưu hồ sơ
    async function onSave() {
        setSubmitting(true);
        try {
            const r = await fetch(`${API}/doctor/me`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    full_name: doctor.full_name?.trim(),
                    gender: doctor.gender,
                    avatar: doctor.avatar?.trim() || null,
                    specialty_id: doctor.specialty_id || null,
                    hospital_id: doctor.hospital_id || null,
                    experience_years: Number.isFinite(+doctor.experience_years) ? +doctor.experience_years : null,
                    fee_min: Number.isFinite(+doctor.fee_min) ? +doctor.fee_min : null,
                    bio: doctor.bio?.trim() || null,
                }),
            });
            const d = await r.json();
            if (!r.ok || !d?.ok) throw new Error(d?.message || "Lưu thất bại");
            setDoctor((s) => ({ ...s, ...d.doctor }));
            alert("Đã lưu thay đổi");
        } catch (e) {
            alert(e.message || "Lưu thất bại");
        } finally {
            setSubmitting(false);
        }
    }

    // ===== đổi mật khẩu =====
    function askConfirmChangePwd() {
        if (!oldPwd.trim() || !newPwd.trim() || !rePwd.trim()) { alert("Vui lòng nhập đủ các ô."); return; }
        if (newPwd.length < 8) { alert("Mật khẩu mới tối thiểu 8 ký tự."); return; }
        if (newPwd !== rePwd) { alert("Xác nhận mật khẩu không khớp."); return; }
        setConfirmOpen(true); // mở modal xác nhận (đè lên modal đổi MK)
    }

    async function doChangePassword() {
        setPwdBusy(true);
        try {
            await changeMyPassword(oldPwd, newPwd);
            alert("Đổi mật khẩu thành công.");
            setOldPwd(""); setNewPwd(""); setRePwd(""); setShowPwd(false);
        } catch (e) {
            alert(e.message || "Đổi mật khẩu thất bại");
        } finally {
            setPwdBusy(false);
            setConfirmOpen(false);
        }
    }

    if (loading) return <div style={{ padding: 12 }}>Đang tải…</div>;

    return (
        <div style={S.page}>
            <div style={S.card}>
                <div style={S.header}>Thông tin bác sĩ</div>

                <div style={S.grid}>
                    {/* trái: ảnh */}
                    <div style={S.left}>
                        <img src={avatarPreview} alt="avatar" style={S.avatar} />

                        <label style={S.label}>Ảnh (URL)</label>
                        <input
                            style={S.input}
                            value={doctor.avatar || ""}
                            onChange={(e) => setDoctor({ ...doctor, avatar: e.target.value })}
                            placeholder="/assets/doctors/ten_anh.jpg hoặc https://…"
                        />

                        <input type="file" accept="image/*" onChange={onPickFile} />
                    </div>

                    {/* phải: thông tin */}
                    <div style={S.right}>
                        <div style={S.row}>
                            <label style={S.label}>Họ tên *</label>
                            <input style={S.input} value={doctor.full_name || ""} onChange={(e) => setDoctor({ ...doctor, full_name: e.target.value })} />
                        </div>

                        <div style={S.row}>
                            <label style={S.label}>Giới tính</label>
                            <select style={S.input} value={doctor.gender || "Nam"} onChange={(e) => setDoctor({ ...doctor, gender: e.target.value })}>
                                <option>Nam</option><option>Nữ</option><option>Khác</option>
                            </select>
                        </div>

                        <div style={S.row}>
                            <label style={S.label}>Chuyên khoa</label>
                            <select
                                style={S.input}
                                value={doctor.specialty_id || ""}
                                onChange={(e) => setDoctor({ ...doctor, specialty_id: e.target.value ? +e.target.value : null })}
                            >
                                <option value="">— Chọn chuyên khoa —</option>
                                {options.specialties.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                            </select>
                        </div>

                        <div style={S.row}>
                            <label style={S.label}>Cơ sở</label>
                            <select
                                style={S.input}
                                value={doctor.hospital_id || ""}
                                onChange={(e) => setDoctor({ ...doctor, hospital_id: e.target.value ? +e.target.value : null })}
                            >
                                <option value="">— Chọn cơ sở —</option>
                                {options.hospitals.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                            </select>
                        </div>

                        <div style={S.row2}>
                            <div>
                                <label style={S.label}>Số năm KN</label>
                                <input style={S.input} type="number" min="0" max="60"
                                    value={doctor.experience_years ?? ""} onChange={(e) => setDoctor({ ...doctor, experience_years: e.target.value })} />
                            </div>
                            <div>
                                <label style={S.label}>Phí khám</label>
                                <input style={S.input} type="number" min="0"
                                    value={doctor.fee_min ?? ""} onChange={(e) => setDoctor({ ...doctor, fee_min: e.target.value })} />
                            </div>
                        </div>

                        <div style={S.row}>
                            <label style={S.label}>Giới thiệu</label>
                            <textarea style={{ ...S.input, height: 120, resize: "vertical" }}
                                value={doctor.bio || ""} onChange={(e) => setDoctor({ ...doctor, bio: e.target.value })} />
                        </div>
                    </div>
                </div>

                {/* footer: có nút Đổi mật khẩu */}
                <div style={S.footer}>
                    <button style={S.btnAlt} onClick={() => setShowPwd(true)}>Đổi mật khẩu</button>
                    <button style={S.btnGhost} disabled={submitting} onClick={() => window.history.back()}>Hủy</button>
                    <button style={S.btn} disabled={submitting} onClick={onSave}>Lưu thay đổi</button>
                </div>
            </div>

            {/* ===== Modal đổi mật khẩu (đè toàn trang) ===== */}
            {showPwd && (
                <div style={S.modalWrap} role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setShowPwd(false); }}>
                    <div style={S.modalPanel}>
                        <div style={S.modalHead}>
                            <div style={{ fontWeight: 800, fontSize: 18 }}>Đổi mật khẩu</div>
                            <button style={S.iconClose} onClick={() => setShowPwd(false)} aria-label="Đóng">×</button>
                        </div>

                        <div style={{ display: "grid", gap: 8 }}>
                            <label style={S.label}>Mật khẩu hiện tại</label>
                            <input style={S.input} type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} />
                            <label style={S.label}>Mật khẩu mới</label>
                            <input style={S.input} type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
                            <label style={S.label}>Nhập lại mật khẩu mới</label>
                            <input style={S.input} type="password" value={rePwd} onChange={(e) => setRePwd(e.target.value)} />
                        </div>

                        <div style={S.modalFoot}>
                            <button
                                style={S.btnGhost}
                                disabled={pwdBusy}
                                onClick={() => { setOldPwd(""); setNewPwd(""); setRePwd(""); setShowPwd(false); }}
                            >
                                Hủy
                            </button>
                            <button style={S.btn} disabled={pwdBusy} onClick={askConfirmChangePwd}>Thay đổi</button>
                        </div>

                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
                            Yêu cầu: tối thiểu 8 ký tự. Thao tác này chỉ cập nhật mật khẩu tài khoản hiện tại.
                        </div>

                        {/* ===== Modal xác nhận (đè lên modal đổi MK) ===== */}
                        {confirmOpen && (
                            <div style={S.confirmWrap} role="alertdialog" aria-modal="true" onClick={(e) => {
                                if (e.target === e.currentTarget) setConfirmOpen(false);
                            }}>
                                <div style={S.confirmCard}>
                                    <div style={{ fontWeight: 800, marginBottom: 4, fontSize: 16 }}>Xác nhận</div>
                                    <div style={{ fontSize: 14, color: "#334155", marginBottom: 10 }}>
                                        Bạn có chắc muốn thay đổi mật khẩu?
                                    </div>
                                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                        <button style={S.btnGhost} disabled={pwdBusy} onClick={() => setConfirmOpen(false)}>Hủy</button>
                                        <button style={S.btn} disabled={pwdBusy} onClick={doChangePassword}>Xác nhận</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ======================= inline CSS ======================= */
const BRAND = "#0ea5e9";
const S = {
    page: { maxWidth: 1080, margin: "0 auto", padding: 16 },
    card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, boxShadow: "0 8px 24px rgba(2,6,23,.06)", overflow: "hidden" },
    header: { padding: "12px 16px", borderBottom: "1px solid #e2e8f0", fontWeight: 800, color: "#0f172a" },
    grid: { display: "grid", gridTemplateColumns: "280px 1fr" },

    left: { padding: 16, borderRight: "1px solid #f1f5f9" },
    avatar: { width: 180, height: 180, borderRadius: 14, objectFit: "cover", display: "block", marginBottom: 10 },
    hint: { fontSize: 12, color: "#64748b", marginTop: 6 },

    right: { padding: 16, display: "grid", gap: 12 },
    row: { display: "grid", gap: 6 },
    row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },

    label: { fontSize: 13, color: "#475569" },
    input: { border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", outline: "none", fontSize: 14 },

    footer: { display: "flex", justifyContent: "flex-end", gap: 10, padding: 12, borderTop: "1px solid #e2e8f0" },
    btn: { border: `1px solid ${BRAND}`, background: BRAND, color: "#fff", padding: "10px 14px", borderRadius: 12, cursor: "pointer", fontWeight: 700 },
    btnGhost: { border: "1px solid #e2e8f0", background: "#f8fafc", color: "#0f172a", padding: "10px 14px", borderRadius: 12, cursor: "pointer" },
    btnAlt: { border: `1px solid ${BRAND}`, background: "#fff", color: BRAND, padding: "10px 14px", borderRadius: 12, cursor: "pointer", fontWeight: 700, boxShadow: "0 1px 0 rgba(14,165,233,.18)" },

    // modal đổi MK
    modalWrap: {
        position: "fixed", inset: 0, zIndex: 60,
        background: "rgba(15,23,42,.55)", backdropFilter: "saturate(150%) blur(2px)",
        display: "grid", placeItems: "center", padding: 16,
    },
    modalPanel: {
        width: "min(520px, 100%)",
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 16,
        boxShadow: "0 20px 60px rgba(2,6,23,.25)",
        padding: 16,
        position: "relative", // để lớp xác nhận phủ lên trong phạm vi modal
    },
    modalHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
    iconClose: { border: "none", background: "transparent", cursor: "pointer", fontSize: 22, lineHeight: "20px", color: "#64748b" },
    modalFoot: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 },

    // modal xác nhận (đè lên chính modal đổi MK)
    confirmWrap: {
        position: "absolute", inset: 0, zIndex: 80,
        background: "rgba(15,23,42,.45)",
        display: "grid", placeItems: "center",
        padding: 12, borderRadius: 16,
    },
    confirmCard: {
        width: 360, background: "#fff", border: "1px solid #e2e8f0",
        borderRadius: 14, boxShadow: "0 16px 40px rgba(2,6,23,.25)", padding: 14,
    },
};
