// src/pages/PatientProfilePage.jsx
import { useEffect, useState } from "react";

export default function PatientProfilePage() {
  const API = import.meta.env.VITE_API_BASE_URL;
  const token = localStorage.getItem("token");

  const [data, setData] = useState(null);        // dữ liệu hồ sơ hiện tại
  const [form, setForm] = useState({});          // form edit hồ sơ
  const [editing, setEditing] = useState(false); // đang edit hồ sơ?
  const [msg, setMsg] = useState("");            // thông báo ngắn

  // ====== ĐỔI MẬT KHẨU ======
  const [showPwd, setShowPwd] = useState(false);        // bật modal đổi MK
  const [pwd, setPwd] = useState({ old: "", next: "", re: "" });
  const [pwdMsg, setPwdMsg] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false); // xác nhận cuối

  // ---- helpers ngày tháng ----
  const toDateInput = (s) => {
    if (!s) return "";
    const d = new Date(s);
    if (Number.isNaN(d)) return "";
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tz).toISOString().slice(0, 10); // YYYY-MM-DD
  };
  const fmtVN = (s) => {
    const v = toDateInput(s);
    if (!v) return "—";
    const [y, m, d] = v.split("-");
    return `${d}/${m}/${y}`;
  };

  // ---- load hồ sơ ----
  useEffect(() => {
    (async () => {
      const r = await fetch(`${API}/me/patient`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = r.ok ? await r.json() : {};
      setData(json);
      setForm({
        full_name: json?.full_name || "",
        gender: json?.gender || "",
        dob: toDateInput(json?.dob),
        phone: json?.phone || "",
        address: json?.address || "",
        insurance_no: json?.insurance_no || "",
      });
    })();
  }, [API, token]);

  // ---- lưu cập nhật hồ sơ ----
  async function onSave(e) {
    e.preventDefault();
    setMsg("");
    const r = await fetch(`${API}/me/patient`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form), // dob đang là YYYY-MM-DD
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return setMsg(err.message || "Cập nhật thất bại");
    }
    const updated = await r.json();
    setData(updated);
    setForm({ ...updated, dob: toDateInput(updated?.dob) });
    if (updated.full_name) localStorage.setItem("displayName", updated.full_name);
    setEditing(false);
    setMsg("Đã lưu thay đổi");
  }

  function onCancel() {
    setForm({
      full_name: data?.full_name || "",
      gender: data?.gender || "",
      dob: toDateInput(data?.dob),
      phone: data?.phone || "",
      address: data?.address || "",
      insurance_no: data?.insurance_no || "",
    });
    setEditing(false);
    setMsg("");
  }

  // ====== ĐỔI MẬT KHẨU – validate + gọi API ======
  function openPwdModal() {
    setPwd({ old: "", next: "", re: "" });
    setPwdMsg("");
    setConfirmOpen(false);
    setShowPwd(true);
  }

  function validatePwdLocal() {
    const old = String(pwd.old || "").trim();
    const next = String(pwd.next || "").trim();
    const re = String(pwd.re || "").trim();

    if (!old || !next || !re) return "Vui lòng nhập đầy đủ các trường.";
    if (next.length < 8) return "Mật khẩu mới tối thiểu 8 ký tự.";
    if (next === old) return "Mật khẩu mới phải khác mật khẩu hiện tại.";
    if (next !== re) return "Xác nhận mật khẩu mới không khớp.";
    return "";
  }

  async function submitChangePassword() {
    setPwdMsg("");
    try {
      const r = await fetch(`${API}/me/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          old_password: pwd.old,
          new_password: pwd.next,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.message || "Đổi mật khẩu thất bại");
      }
      setShowPwd(false);
      setConfirmOpen(false);
      setPwd({ old: "", next: "", re: "" });
      setMsg("Đã đổi mật khẩu thành công");
    } catch (e) {
      setPwdMsg(e.message || "Đổi mật khẩu thất bại");
    }
  }

  function onSubmitPwd(e) {
    e.preventDefault();
    const err = validatePwdLocal();
    if (err) return setPwdMsg(err);
    setConfirmOpen(true); // mở confirm "Bạn có chắc…"
  }

  if (!data) return <div className="container">Đang tải…</div>;

  return (
    <main className="container" style={{ maxWidth: 720 }}>
      <h2>Hồ sơ bệnh nhân</h2>

      {/* ==== Xem hồ sơ ==== */}
      {!editing && (
        <>
          <div className="profile-view">
            <Row label="Họ và tên" value={data.full_name} />
            <Row label="Giới tính" value={data.gender || "—"} />
            <Row label="Ngày sinh" value={fmtVN(data.dob)} />
            <Row label="Số điện thoại" value={data.phone || "—"} />
            <Row label="Địa chỉ" value={data.address || "—"} />
            <Row label="Số BHYT" value={data.insurance_no || "—"} />
          </div>

          {/* Nhóm nút hành động */}
          <div style={{ display: "flex", gap: 12 }}>
            <button className="btn btn--primary" onClick={() => setEditing(true)}>
              Cập nhật thông tin
            </button>
            <button className="btn btn--outline" onClick={openPwdModal}>
              Đổi mật khẩu
            </button>
          </div>
          {msg && <p className="tiny" style={{ marginTop: 8 }}>{msg}</p>}
        </>
      )}

      {/* ==== Sửa hồ sơ ==== */}
      {editing && (
        <form className="profile-form" onSubmit={onSave}>
          <label>Họ và tên</label>
          <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />

          <label>Giới tính</label>
          <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="">-- Chọn --</option>
            <option>Nam</option>
            <option>Nữ</option>
            <option>Khác</option>
          </select>

          <label>Ngày sinh</label>
          <input type="date" className="input" value={form.dob || ""} onChange={(e) => setForm({ ...form, dob: e.target.value })} />

          <label>Số điện thoại</label>
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />

          <label>Địa chỉ</label>
          <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />

          <label>Số BHYT</label>
          <input className="input" value={form.insurance_no} onChange={(e) => setForm({ ...form, insurance_no: e.target.value })} />

          {msg && <p className="tiny">{msg}</p>}

          <div style={{ display: "flex", gap: 12 }}>
            <button className="btn btn--primary" type="submit">Lưu</button>
            <button className="btn" type="button" onClick={onCancel}>Quay lại</button>
          </div>
        </form>
      )}

      {/* ==== Modal ĐỔI MẬT KHẨU ==== */}
      {showPwd && (
        <div className="pwd-overlay" role="dialog" aria-modal="true">
          <div className="pwd-card">
            <h3 className="pwd-title">Đổi mật khẩu</h3>
            <form onSubmit={onSubmitPwd}>
              <label className="pwd-label">Mật khẩu hiện tại</label>
              <input
                className="input"
                type="password"
                value={pwd.old}
                onChange={(e) => setPwd({ ...pwd, old: e.target.value })}
                autoFocus
              />

              <label className="pwd-label">Mật khẩu mới</label>
              <input
                className="input"
                type="password"
                value={pwd.next}
                onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
              />

              <label className="pwd-label">Xác nhận mật khẩu mới</label>
              <input
                className="input"
                type="password"
                value={pwd.re}
                onChange={(e) => setPwd({ ...pwd, re: e.target.value })}
              />

              {pwdMsg && <p className="tiny" style={{ color: "#dc2626" }}>{pwdMsg}</p>}

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button type="button" className="btn btn--danger-outline" onClick={() => setShowPwd(false)}>Hủy</button>
                <button type="submit" className="btn btn--primary">Thay đổi</button>
              </div>
            </form>
          </div>

          {/* Xác nhận lần cuối */}
          {confirmOpen && (
            <div className="pwd-confirm">
              <div className="pwd-confirm__card">
                <div className="pwd-confirm__title">Xác nhận</div>
                <div className="pwd-confirm__body">Bạn có chắc muốn thay đổi mật khẩu?</div>
                <div className="pwd-confirm__actions">
                  <button className="btn btn--danger-outline" onClick={() => setConfirmOpen(false)}>Hủy</button>
                  <button className="btn btn--primary" onClick={submitChangePassword}>Xác nhận</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====== CSS inline ====== */}
      <style>{`
        .profile-view .row { display:flex; gap:16px; padding:10px 0; border-bottom:1px solid #eef2f7; }
        .row__label { width:160px; color:#64748b; }
        .row__value { flex:1; font-weight:600; color:#0f172a; }
        .profile-form .input, .input { width:100%; padding:10px 12px; border:1px solid #e5e7eb; border-radius:10px; }
        .btn { border:1px solid #e5e7eb; background:#fff; padding:10px 14px; border-radius:12px; cursor:pointer; }
        .btn--primary { background:#0ea5e9; color:#fff; border-color:#0ea5e9; }
        .btn--ghost { background:#f8fafc; color:#0f172a; }
        .tiny { font-size:13px; color:#64748b; }

        /* Modal đổi MK */
        .pwd-overlay { position:fixed; inset:0; background:rgba(2,6,23,.45); display:grid; place-items:center; z-index:120; }
        .pwd-card { width:min(520px, 92vw); background:#fff; border-radius:16px; box-shadow:0 20px 60px rgba(15,23,42,.25); padding:18px; }
        .pwd-title { margin:4px 0 8px; }
        .pwd-label { margin-top:10px; margin-bottom:6px; display:block; color:#475569; }

        /* Confirm trên cùng modal */
        .pwd-confirm { position:fixed; inset:0; display:grid; place-items:center; background:rgba(15,23,42,.25); z-index:130; }
        .pwd-confirm__card { width:min(420px, 92vw); background:#fff; border-radius:16px; padding:16px; box-shadow:0 14px 44px rgba(0,0,0,.25); }
        .pwd-confirm__title { font-weight:700; margin-bottom:6px; }
        .pwd-confirm__body { color:#0f172a; margin-bottom:14px; }
        .pwd-confirm__actions { display:flex; gap:10px; justify-content:flex-end; }
        .btn--outline{ background:#fff; color:#0ea5e9; border:2px solid #0ea5e9; border-radius:12px; padding:10px 14px; font-weight:600;}
        .btn--outline:hover{ background:#e0f2fe;}
        .btn--outline:focus{ outline:none; box-shadow:0 0 0 3px rgba(14,165,233,.25);}
        .btn--outline:active{ transform:translateY(0.5px);}

        .btn--danger-outline{ background:#fff; color:#ef4444;border:2px solid #ef4444;border-radius:12px; padding:10px 14px; font-weight:600;}
        .btn--danger-outline:hover{ background:#fee2e2;}
        .btn--danger-outline:focus{ outline:none; box-shadow:0 0 0 3px rgba(239,68,68,.25);}
      `}</style>
    </main>
  );
}

function Row({ label, value }) {
  return (
    <div className="row">
      <div className="row__label">{label}</div>
      <div className="row__value">{value || "—"}</div>
    </div>
  );
}
