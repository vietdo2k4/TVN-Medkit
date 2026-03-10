import { useEffect, useMemo, useState, useRef } from "react";
import {
  listDoctors, createDoctor, updateDoctor, deleteDoctor,
  listHospitals, listSpecialties, createDoctorAccount, getHospitalSpecialties,
} from "../../api/admin";

function toSafeFilename(name = "") {
  const noAccent = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return noAccent.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

export default function AdminDoctorsPage() {
  //State phần bảng danh sách
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0); // dùng để hiển thị tổng -> tránh ESLint no-unused-vars
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  //State modal form Bác sĩ =====
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState("");
  const [form, setForm] = useState({
    id: 0,
    full_name: "",
    phone: "",
    gender: "Nam",
    hospital_id: null,
    specialty_id: null,
    fee_min: "",
    avatar: "",
    experience_years: "",
    bio: "",
  });

  //Danh mục & ràng buộc chuyên khoa theo cơ sở
  const [opts, setOpts] = useState({ specs: [], hosps: [] });
  const [specByHosp, setSpecByHosp] = useState([]);

  //Toast thông báo ngắn
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const showToast = (text, kind = "error", ms = 3000) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ kind, text });
    toastTimer.current = setTimeout(() => setToast(null), ms);
  };

  //Modal tạo tài khoản bác sĩ
  const [accOpen, setAccOpen] = useState(false);
  const [accDoctor, setAccDoctor] = useState(null); // dòng bác sĩ đang tạo TK
  const [acc, setAcc] = useState({ email: "", password: "" });

  //Tham số query cơ bản 
  const qp = useMemo(() => ({ q: q.trim(), page, limit }), [q, page, limit]);

  //Load bảng danh sách bác sĩ
  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        setLoading(true); setErr("");
        const res = await listDoctors(qp);
        const items = res?.items ?? res?.data ?? res?.rows ?? res ?? [];
        if (!stop) {
          setRows(Array.isArray(items) ? items : []);
          setTotal(res?.total ?? items.length ?? 0);
        }
      } catch (e) {
        if (!stop) { setErr(e?.message || "Request error"); setRows([]); setTotal(0); }
      } finally { if (!stop) setLoading(false); }
    })();
    return () => { stop = true; };
  }, [qp]);

  //Load danh mục cơ bản (cơ sở + chuyên khoa tổng)
  useEffect(() => {
    (async () => {
      const [sp, hp] = await Promise.all([listSpecialties({ limit: 999 }), listHospitals({ limit: 999 })]);
      setOpts({ specs: sp?.items ?? sp ?? [], hosps: hp?.items ?? hp ?? [] });
    })();
  }, []);

  //Khi chọn CƠ SỞ → tải danh sách chuyên khoa thuộc cơ sở đó
  useEffect(() => {
    (async () => {
      const hid = form.hospital_id;
      if (!hid) { setSpecByHosp([]); setForm((x) => ({ ...x, specialty_id: null })); return; }
      try {
        const data = await getHospitalSpecialties(hid); // { all, selectedIds }
        const all = data?.all ?? [];
        const allowed = new Set(data?.selectedIds ?? []);
        const filtered = all.filter((s) => allowed.has(s.id));
        setSpecByHosp(filtered);

        // Nếu specialty đang chọn không còn hợp lệ → reset
        if (!filtered.some((s) => s.id === form.specialty_id)) {
          setForm((x) => ({ ...x, specialty_id: null }));
        }
        // eslint-disable-next-line no-unused-vars
      } catch (e) {
        setSpecByHosp([]);
        setForm((x) => ({ ...x, specialty_id: null }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.hospital_id]);

  //Mở modal tạo mới
  function openNew() {
    setForm({
      id: 0, full_name: "", phone: "", gender: "Nam",
      hospital_id: null, specialty_id: null, fee_min: "",
      avatar: "", experience_years: "", bio: "",
    });
    setSpecByHosp([]);
    setPreview("");
    setOpen(true);
  }

  //Mở modal xem/sửa
  function openEdit(d) {
    setForm({
      id: d.id,
      full_name: d.full_name || "",
      phone: d.phone || "",
      gender: d.gender || "Khác",
      hospital_id: d.hospital_id || null,
      specialty_id: d.specialty_id || null,
      fee_min: d.fee_min ?? "",
      avatar: d.avatar || "",
      experience_years: d.experience_years ?? "",
      bio: d.bio || "",
    });
    setPreview(d.avatar || "");
    setOpen(true);
  }

  //Chọn file ảnh -> demo đường dẫn an toàn + preview 
  function onPickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const safe = toSafeFilename(f.name);
    const guess = `/assets/doctors/${safe}`;
    setForm((x) => ({ ...x, avatar: guess }));
    setPreview(URL.createObjectURL(f));
  }

  // Lưu (tạo/sửa) bác sĩ 
  async function onSave() {
    // Chuẩn hoá payload
    const payload = {
      full_name: form.full_name?.trim(),
      phone: form.phone?.trim() || null,
      gender: form.gender || "Khác",
      hospital_id: form.hospital_id ? Number(form.hospital_id) : null,
      specialty_id: form.specialty_id ? Number(form.specialty_id) : null,
      fee_min: form.fee_min === "" ? null : Number(form.fee_min),
      avatar: form.avatar?.trim() || null,
      experience_years: form.experience_years === "" ? null : Number(form.experience_years),
      bio: form.bio?.trim() || null,
    };

    const isNew = !form.id;

    // ==== Ràng buộc "không để trống" khi THÊM MỚI ====
    // (chỉnh thông điệp rõ ràng theo từng trường)
    if (isNew) {
      if (!payload.full_name) return showToast("Tên bác sĩ bắt buộc", "error");
      if (!payload.phone) return showToast("Điện thoại bắt buộc", "error");
      if (!payload.hospital_id) return showToast("Chọn cơ sở trước", "error");
      if (!payload.specialty_id) return showToast("Chọn chuyên khoa (theo cơ sở)", "error");
      if (!payload.avatar) return showToast("Chọn/nhập URL ảnh bác sĩ", "error");
      if (payload.fee_min === null || Number.isNaN(payload.fee_min))
        return showToast("Giá khám bắt buộc", "error");
      if (payload.experience_years === null || Number.isNaN(payload.experience_years))
        return showToast("Số năm kinh nghiệm bắt buộc", "error");
      if (!payload.bio) return showToast("Giới thiệu bắt buộc", "error");
    } else {
      // Với SỬA, vẫn giữ các bắt buộc cũ
      if (!payload.full_name) return showToast("Tên bác sĩ bắt buộc", "error");
      if (!payload.hospital_id) return showToast("Chọn cơ sở trước", "error");
      if (!payload.specialty_id) return showToast("Chọn chuyên khoa (theo cơ sở)", "error");
    }

    // ==== Kiểm tra định dạng cơ bản ====
    if (payload.phone && !/^\d{10}$/.test(payload.phone))
      return showToast("Số điện thoại phải đủ 10 chữ số", "error");
    if (payload.fee_min !== null && payload.fee_min < 0)
      return showToast("Giá khám không hợp lệ", "error");
    if (payload.experience_years !== null && payload.experience_years < 0)
      return showToast("Số năm kinh nghiệm không hợp lệ", "error");

    try {
      if (form.id) await updateDoctor(form.id, payload);
      else await createDoctor(payload);

      setOpen(false);
      // reload bảng
      const res = await listDoctors(qp);
      const items = res?.items ?? res ?? [];
      setRows(Array.isArray(items) ? items : []);
      setTotal(res?.total ?? items.length ?? 0);
      showToast("Đã lưu", "ok");
    } catch (e) {
      showToast(e?.data?.message || e?.message || "Không thể lưu", "error", 5000);
    }
  }

  // Xoá bác sĩ
  async function onDelete(id) {
    if (!window.confirm("Xoá bác sĩ này?")) return;
    try {
      await deleteDoctor(id);
      setRows((arr) => arr.filter((x) => x.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      showToast("Đã xoá", "ok");
    } catch (e) {
      const msg = e?.data?.message || e?.message || "Xoá thất bại";
      showToast(msg, "error", 6000);
    }
  }

  //Mở modal tạo tài khoản cho bác sĩ
  function openCreateAccountModal(d) {
    if (d.account_email) return showToast("Bác sĩ đã có tài khoản", "error");
    setAccDoctor(d);
    setAcc({ email: "", password: "" });
    setAccOpen(true);
  }

  // ===== Gọi API tạo tài khoản
  async function submitCreateAccount() {
    if (!accDoctor) return;

    const email = (acc.email || "").trim();
    const pwdRaw = acc.password || "";

    // 1) Thiếu 1 trong 2 trường
    if (!email || !pwdRaw) {
      return showToast("Vui lòng nhập đủ Email và Mật khẩu", "error");
    }

    // 2) Có khoảng trắng trong Email/MK
    if (/\s/.test(email) || /\s/.test(pwdRaw)) {
      return showToast("Email/Mật khẩu không được chứa khoảng trắng", "error");
    }

    // 3) Trùng email với bác sĩ đã có TK (kiểm tra nhanh trên FE)
    const dupInDoctors = rows.some(
      (r) => String(r.account_email || "").toLowerCase() === email.toLowerCase()
    );
    if (dupInDoctors) {
      return showToast("Email đã được dùng cho một bác sĩ khác", "error");
    }

    try {
      await createDoctorAccount(accDoctor.id, {
        email,
        password: pwdRaw, // gửi đúng như người dùng nhập
      });

      // Cập nhật ngay trên bảng để phản ánh trạng thái có tài khoản
      setRows((arr) =>
        arr.map((x) => (x.id === accDoctor.id ? { ...x, account_email: email } : x))
      );
      setAccOpen(false);
      setAccDoctor(null);
      showToast("Đã tạo tài khoản", "ok");
    } catch (e) {
      // Nếu BE trả về lỗi trùng (ví dụ 409) → hiện thông báo riêng
      const msg =
        e?.status === 409 ||
          /exist|duplicate|already/i.test(String(e?.data?.message || e?.message || ""))
          ? "Email đã tồn tại, vui lòng chọn email khác"
          : e?.data?.message || e?.message || "Không thể tạo tài khoản";

      showToast(msg, "error", 6000);
    }
  }

  return (
    <div style={S.wrap}>
      {/* Toolbar: tìm kiếm + chuyển trang + nút Thêm */}
      <div style={{ ...S.card, ...S.cardPad }}>
        <div style={S.toolbar}>
          <input
            style={{ ...S.input, minWidth: 320 }}
            placeholder="Tìm tên bác sĩ…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
          />
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span>Trang {page} • {total} bác sĩ</span>
            <button style={S.btn("sec")} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
            <button style={S.btn("sec")} onClick={() => setPage((p) => p + 1)}>Next</button>
            <button style={S.btn("pri")} onClick={openNew}>+ Thêm bác sĩ</button>
          </div>
        </div>
      </div>

      {/* Bảng danh sách bác sĩ */}
      <div style={S.card}>
        <div style={S.cardPad}>
          {loading ? "Đang tải…" : err ? <span style={{ color: "#dc2626" }}>{err}</span> : null}
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>ID</th>
                <th style={S.th}>Bác sĩ</th>
                <th style={S.th}>Điện thoại</th>
                <th style={S.th}>Chuyên khoa</th>
                <th style={S.th}>Cơ sở</th>
                <th style={S.th}>Ảnh</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td style={S.td} colSpan={7}>Không có dữ liệu</td></tr>}
              {rows.map((d) => (
                <tr key={d.id}>
                  <td style={S.td}>{d.id}</td>
                  <td style={S.td}>
                    <div style={{ fontWeight: 700 }}>{d.full_name}</div>
                    <div style={{ color: "#64748b", fontSize: 12 }}>{d.gender || "-"}</div>
                  </td>
                  <td style={S.td}>{d.phone || "-"}</td>
                  <td style={S.td}>{d.specialty_name ? <span style={S.tag}>{d.specialty_name}</span> : "-"}</td>
                  <td style={S.td}>{d.hospital_name || "-"}</td>
                  <td style={S.td}>{d.avatar ? <img src={d.avatar} alt="" style={S.avatar} /> : <span style={S.tag}>No image</span>}</td>
                  <td style={S.td}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={S.btn("sec")} onClick={() => openEdit(d)}>Xem</button>
                      {/* Nút tạo tài khoản – mở modal riêng */}
                      <button
                        style={d.account_email ? { ...S.btn("sec"), opacity: 0.5, cursor: "not-allowed" } : S.btn("sec")}
                        onClick={() => !d.account_email && openCreateAccountModal(d)}
                        title={d.account_email ? `Đã có: ${d.account_email}` : "Tạo tài khoản đăng nhập cho bác sĩ"}
                      >
                        {d.account_email ? "Đã có TK" : "Tạo TK"}
                      </button>
                      <button
                        style={{ ...S.btn("sec"), background: "#fee2e2", borderColor: "#fecaca" }}
                        onClick={() => onDelete(d.id)}
                      >
                        Xoá
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Form chi tiết bác sĩ (thêm/sửa) */}
      {open && (
        <div style={S.overlay} onMouseDown={() => setOpen(false)}>
          <div style={S.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div style={S.modalHead}>{form.id ? "Thông tin bác sĩ" : "Thêm bác sĩ"}</div>

            <div style={S.modalBody}>
              {/* Cột trái: ảnh + upload demo */}
              <div style={S.leftCol}>
                <img
                  src={preview || form.avatar || "/assets/placeholder-doctor.png"}
                  alt="avatar"
                  style={S.bigAvatar}
                />
                <div>
                  <div style={{ marginBottom: 6, fontWeight: 600 }}>Ảnh (URL)</div>
                  <input style={{ ...S.input, ...S.readonly, width: "100%" }} value={form.avatar} readOnly />
                </div>
                <div>
                  <div style={{ marginBottom: 6, fontWeight: 600 }}>Chọn file ảnh</div>
                  <input type="file" accept="image/*" onChange={onPickFile} />
                </div>
              </div>

              {/* Cột phải: thông tin */}
              <div style={S.rightCol}>
                <div style={S.row}>
                  <label>Họ tên *</label>
                  <input style={S.input} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </div>

                <div style={S.row}>
                  <label>Giới tính</label>
                  <select style={S.select} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                    <option>Nam</option><option>Nữ</option><option>Khác</option>
                  </select>
                </div>

                <div style={S.row}>
                  <label>Điện thoại</label>
                  <input style={S.input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>

                <div style={S.row}>
                  <label>Cơ sở *</label>
                  <select
                    style={S.select}
                    value={form.hospital_id ?? ""}
                    onChange={(e) => setForm({ ...form, hospital_id: e.target.value ? Number(e.target.value) : null })}
                  >
                    <option value="">-- Chọn --</option>
                    {opts.hosps.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>

                {/* Chuyên khoa phụ thuộc cơ sở */}
                <div style={S.row}>
                  <label>Chuyên khoa *</label>
                  <select
                    style={S.select}
                    value={form.specialty_id ?? ""}
                    onChange={(e) => setForm({ ...form, specialty_id: e.target.value ? Number(e.target.value) : null })}
                    disabled={!form.hospital_id || specByHosp.length === 0}
                    title={!form.hospital_id ? "Chọn cơ sở trước" : (specByHosp.length ? "" : "Cơ sở chưa cấu hình chuyên khoa")}
                  >
                    {!form.hospital_id
                      ? <option value="">-- Chọn cơ sở trước --</option>
                      : specByHosp.length === 0
                        ? <option value="">(Cơ sở chưa có chuyên khoa)</option>
                        : <option value="">-- Chọn --</option>}
                    {specByHosp.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div style={S.row}>
                  <label>Giá khám </label>
                  <input
                    type="number" min="0" step="1000" style={S.input}
                    value={form.fee_min}
                    onChange={(e) => setForm({ ...form, fee_min: e.target.value })}
                  />
                </div>

                <div style={S.row}>
                  <label>Số năm KN</label>
                  <input
                    type="number" min="0" style={S.input}
                    value={form.experience_years}
                    onChange={(e) => setForm({ ...form, experience_years: e.target.value })}
                  />
                </div>

                <div style={S.row}>
                  <label>Giới thiệu</label>
                  <textarea
                    rows={6}
                    style={{ ...S.input, padding: 12, resize: "vertical" }}
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div style={S.modalFoot}>
              <button style={S.btn("sec")} onClick={() => setOpen(false)}>Huỷ</button>
              <button style={S.btn("pri")} onClick={onSave}>{form.id ? "Lưu thay đổi" : "Tạo mới"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Tạo tài khoản bác sĩ */}
      {accOpen && (
        <div style={S.overlay} onMouseDown={() => setAccOpen(false)}>
          <div style={S.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div style={S.modalHead}>Tạo tài khoản cho bác sĩ</div>
            <div style={{ padding: 16, display: "grid", gap: 12 }}>
              <div><b>Bác sĩ:</b> {accDoctor?.full_name}</div>
              <div style={S.row}>
                <label>Email *</label>
                <input
                  style={S.input}
                  placeholder="vd: doctor@example.com"
                  value={acc.email}
                  onChange={(e) => setAcc({ ...acc, email: e.target.value })}
                />
              </div>
              <div style={S.row}>
                <label>Mật khẩu</label>
                <input
                  style={S.input}
                  type="password"
                  placeholder="************"
                  value={acc.password}
                  onChange={(e) => setAcc({ ...acc, password: e.target.value })}
                />
              </div>
            </div>
            <div style={S.modalFoot}>
              <button style={S.btn("sec")} onClick={() => setAccOpen(false)}>Huỷ</button>
              <button style={S.btn("pri")} onClick={submitCreateAccount}>Tạo tài khoản</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast: thông báo ngắn gọn */}
      <div style={S.toastWrap} aria-live="polite">
        {toast && <div style={S.toast(toast.kind)}>{toast.text}</div>}
      </div>
    </div>
  );
}

/*CSS inline (đặt cuối file) */
const S = {
  wrap: { display: "grid", gap: 16 },
  toolbar: { display: "flex", gap: 8, alignItems: "center" },
  input: { height: 40, padding: "0 12px", border: "1px solid #e2e8f0", borderRadius: 10 },
  select: { height: 40, padding: "0 10px", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff" },
  btn: (kind = "pri") => ({
    height: 38, padding: "0 14px", borderRadius: 10, border: "1px solid transparent",
    background: kind === "pri" ? "#0ea5e9" : "#e2e8f0", color: kind === "pri" ? "#fff" : "#0f172a",
    fontWeight: 700, cursor: "pointer",
  }),
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, boxShadow: "0 8px 24px rgba(15,23,42,.04)" },
  cardPad: { padding: 16 },
  table: { width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 14 },
  th: { textAlign: "left", color: "#64748b", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" },
  td: { padding: "10px 12px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" },
  avatar: { width: 44, height: 44, objectFit: "cover", borderRadius: 10, border: "1px solid #e2e8f0" },
  tag: { padding: "2px 8px", borderRadius: 999, background: "#f1f5f9", fontSize: 12 },

  overlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,.35)", display: "grid", placeItems: "center", zIndex: 50 },
  modal: { width: 980, maxWidth: "95vw", background: "#fff", borderRadius: 16, overflow: "hidden" },
  modalHead: { padding: 16, borderBottom: "1px solid #e2e8f0", fontWeight: 800, fontSize: 18 },
  modalBody: { padding: 16, display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, alignItems: "start" },
  leftCol: { display: "grid", gap: 12 },
  rightCol: { display: "grid", gap: 12 },
  row: { display: "grid", gridTemplateColumns: "160px 1fr", alignItems: "center", gap: 12 },
  bigAvatar: { width: 180, height: 180, objectFit: "cover", borderRadius: 16, border: "1px solid #e2e8f0" },
  help: { color: "#64748b", fontSize: 13 },
  modalFoot: { padding: 12, borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 10, background: "#fff" },

  readonly: { opacity: 0.7, background: "#f8fafc", cursor: "not-allowed" },

  // Toast
  toastWrap: { position: "fixed", right: 16, top: 16, zIndex: 60, display: "grid", gap: 10 },
  toast: (kind) => ({
    minWidth: 260, maxWidth: 420, padding: "10px 12px", borderRadius: 12,
    background: kind === "error" ? "#fee2e2" : "#ecfeff",
    border: `1px solid ${kind === "error" ? "#fecaca" : "#bae6fd"}`,
    color: kind === "error" ? "#991b1b" : "#0c4a6e",
    fontWeight: 600, boxShadow: "0 8px 24px rgba(15,23,42,.08)",
  }),
};
