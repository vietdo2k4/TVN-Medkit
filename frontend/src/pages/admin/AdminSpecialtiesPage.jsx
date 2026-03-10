import { useEffect, useMemo, useState } from "react";
import {
  listHospitals,
  listSpecialties,
  createSpecialty,
  updateSpecialty,
  deleteSpecialty,
} from "../../api/admin";

export default function AdminSpecialtiesPage() {
  const [q, setQ] = useState("");
  const [hospitalId, setHospitalId] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const [hospitals, setHospitals] = useState([]);
  const [items, setItems] = useState([]);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // modal CRUD chuyên khoa
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: null, name: "", description: "", icon_path: "" });
  const [preview, setPreview] = useState(""); // objectURL nếu chọn file

  // ====== NEW: mini-dialog gán chuyên khoa vào cơ sở ======
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSpec, setAssignSpec] = useState(null);
  const [hospList, setHospList] = useState([]);
  const [hospPicked, setHospPicked] = useState("");

  const ADMIN = import.meta.env.VITE_API_BASE_URL + "/admin";
  const token = localStorage.getItem("token") || "";

  async function jget(url) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }
  async function jsend(url, method, body) {
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json().catch(() => ({}));
  }
  async function openAssign(spec) {
    setAssignSpec(spec);
    const rows = await jget(`${ADMIN}/hospitals?limit=100`);
    setHospList(Array.isArray(rows?.items) ? rows.items : rows);
    setHospPicked((Array.isArray(rows?.items) ? rows.items : rows)?.[0]?.id || "");
    setAssignOpen(true);
  }
  async function doAssign() {
    if (!hospPicked || !assignSpec?.id) return;
    const current = await jget(`${ADMIN}/hospitals/${hospPicked}/specialties`);
    const currentIds =
      (Array.isArray(current?.selectedIds) && current.selectedIds) ||
      (Array.isArray(current) && current) ||
      [];
    const set = new Set(currentIds);
    set.add(assignSpec.id);
    await jsend(`${ADMIN}/hospitals/${hospPicked}/specialties`, "POST", {
      specialtyIds: Array.from(set),
    });
    setAssignOpen(false);
    alert("Đã thêm vào cơ sở");
  }
  // ====== END NEW ======

  // load combo cơ sở (phục vụ lọc danh sách)
  useEffect(() => {
    (async () => {
      try {
        setHospitals(await listHospitals({ limit: 200 }));
      } catch {
        /* noop */
      }
    })();
  }, []);

  // load list chuyên khoa
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const arr = await listSpecialties({ q, hospitalId, page, limit });
        setItems(Array.isArray(arr) ? arr : []);
        setHasNext(Array.isArray(arr) && arr.length === limit);
      } catch (e) {
        setErr(e.message || "Request error");
      } finally {
        setLoading(false);
      }
    })();
  }, [q, hospitalId, page]);

  const rows = useMemo(() => items, [items]);

  const reloadFirst = async () => {
    const arr = await listSpecialties({ q, hospitalId, page: 1, limit });
    setItems(Array.isArray(arr) ? arr : []);
    setHasNext(Array.isArray(arr) && arr.length === limit);
    setPage(1);
  };

  const onSave = async () => {
    if (!form.name.trim()) return alert("Nhập tên chuyên khoa");
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description || null,
        icon_path: form.icon_path || null,
      };
      if (form.id) await updateSpecialty(form.id, payload);
      else await createSpecialty(payload);
      setOpen(false);
      setPreview("");
      await reloadFirst();
    } catch (e) {
      alert(e.message || "Không lưu được");
    }
  };

  const onDelete = async (id) => {
    if (!confirm("Xóa chuyên khoa?")) return;
    try {
      await deleteSpecialty(id);
      setItems((xs) => xs.filter((x) => x.id !== id));
    } catch (e) {
      alert(e.message || "Không xóa được");
    }
  };

  const onPickIcon = (file) => {
    if (!file) {
      setPreview("");
      return;
    }
    setPreview(URL.createObjectURL(file));
    // chỉ lưu đường dẫn vào DB, KHÔNG upload file ở đây
    setForm((f) => ({ ...f, icon_path: `/assets/icons/specialties/${file.name}` }));
  };

  const openEdit = (sp) => {
    setForm({
      id: sp?.id ?? null,
      name: sp?.name ?? "",
      description: sp?.description ?? "",
      icon_path: sp?.icon_path ?? "",
    });
    setPreview(""); // clear objectURL khi mở
    setOpen(true);
  };

  return (
    <div>
      <div style={S.head}>
        <h2 style={S.h1}>Quản lý chuyên khoa</h2>
        <button style={{ ...S.btnPri, marginLeft: "auto" }} onClick={() => openEdit(null)}>
          + Thêm chuyên khoa
        </button>
      </div>

      <div style={{ ...S.card, marginBottom: 12 }}>
        <div style={S.row}>
          <input
            style={{ ...S.input, width: 300 }}
            placeholder="Tìm theo tên…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <select
            style={S.select}
            value={hospitalId}
            onChange={(e) => {
              setHospitalId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả cơ sở</option>
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <button
            style={S.btn}
            onClick={() => {
              setQ("");
              setHospitalId("");
              setPage(1);
            }}
          >
            Xóa lọc
          </button>

          <div style={{ marginLeft: "auto" }} />
          <button style={S.btn} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            Prev
          </button>
          <span style={{ fontSize: 12, color: "#64748b" }}>Trang {page}</span>
          <button style={S.btn} onClick={() => hasNext && setPage((p) => p + 1)} disabled={!hasNext}>
            Next
          </button>
        </div>
      </div>

      <div style={S.card}>
        {loading ? (
          <div style={{ padding: 12 }}>Đang tải…</div>
        ) : err ? (
          <div style={{ padding: 12, color: "#e11d48" }}>Lỗi: {err}</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 12, color: "#64748b" }}>Không có dữ liệu</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>ID</th>
                <th style={S.th}>Biểu tượng</th>
                <th style={S.th}>Tên</th>
                <th style={S.th}>Mô tả</th>
                <th style={S.th}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((sp) => (
                <tr key={sp.id}>
                  <td style={S.td}>{sp.id}</td>
                  <td style={S.td}>
                    {sp.icon_path ? <img src={sp.icon_path} alt="" style={{ width: 28, height: 28 }} /> : <span style={{ color: "#64748b" }}>—</span>}
                  </td>
                  <td style={S.td}>{sp.name}</td>
                  <td style={S.td}>{sp.description || ""}</td>
                  <td style={S.td}>
                    <button style={S.btn} onClick={() => openEdit(sp)}>
                      Sửa
                    </button>
                    <button style={{ ...S.btn, marginLeft: 8, background: "#fee2e2" }} onClick={() => onDelete(sp.id)}>
                      Xóa
                    </button>
                    {/* NEW: gán vào cơ sở */}
                    <button style={{ ...S.btn, marginLeft: 8 }} onClick={() => openAssign(sp)} title="Thêm vào cơ sở">
                      ➕ Cơ sở
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal CRUD chuyên khoa */}
      {open && (
        <div style={S.modalBack} onClick={() => setOpen(false)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>{form.id ? "Sửa chuyên khoa" : "Thêm chuyên khoa"}</div>

            <div style={{ display: "grid", gridTemplateColumns: "112px 1fr", columnGap: 14, rowGap: 10 }}>
              {/* preview */}
              <div style={{ gridRow: "1 / span 3" }}>
                <div
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    display: "grid",
                    placeItems: "center",
                    overflow: "hidden",
                    background: "#fff",
                  }}
                >
                  {preview ? (
                    <img src={preview} alt="" style={{ width: 64, height: 64 }} />
                  ) : form.icon_path ? (
                    <img src={form.icon_path} alt="" style={{ width: 64, height: 64 }} />
                  ) : (
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>No icon</span>
                  )}
                </div>
              </div>

              <input
                style={{ ...S.input, width: "100%" }}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Tên *"
              />

              <textarea
                style={{ ...S.textarea, width: "100%", gridColumn: "2 / 3", height: 100 }}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Mô tả"
              />

              {/* icon path + file */}
              <div style={{ gridColumn: "2 / 3", display: "grid", gridTemplateColumns: "1fr auto", columnGap: 8 }}>
                <input style={{ ...S.input, width: "100%", background: "#f8fafc" }} value={form.icon_path} readOnly placeholder="Đường dẫn icon (read-only)" />
                <label style={{ ...S.btn }}>
                  <input
                    type="file"
                    accept=".svg,.png,.jpg,.jpeg,.webp"
                    style={{ display: "none" }}
                    onChange={(e) => onPickIcon(e.target.files?.[0])}
                  />
                  Chọn file
                </label>
              </div>
              <div style={{ gridColumn: "2 / 3", fontSize: 12, color: "#64748b" }}>* Chỉ lưu đường dẫn vào DB. File chưa được upload thật.</div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button style={S.btn} onClick={() => { setOpen(false); setPreview(""); }}>
                Hủy
              </button>
              <button style={S.btnPri} onClick={onSave}>
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW: Modal gán chuyên khoa vào cơ sở */}
      {assignOpen && (
        <div style={S.modalBack} onClick={() => setAssignOpen(false)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
              Thêm chuyên khoa “{assignSpec?.name}” vào cơ sở
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <select style={S.select} value={hospPicked} onChange={(e) => setHospPicked(e.target.value)}>
                {hospList.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button style={S.btn} onClick={() => setAssignOpen(false)}>
                  Huỷ
                </button>
                <button style={S.btnPri} onClick={doAssign}>
                  Xác nhận
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== styles inline ===== */
const S = {
  head: { display: "flex", alignItems: "center", gap: 12, marginBottom: 14 },
  h1: { fontSize: 22, fontWeight: 800, margin: 0, color: "#0b2239" },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    boxShadow: "0 4px 20px rgba(15,23,42,.06)",
    padding: 12,
  },
  row: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  input: {
    height: 36,
    padding: "0 12px",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    fontSize: 14,
    outline: "none",
  },
  textarea: {
    padding: "8px 12px",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    fontSize: 14,
    outline: "none",
  },
  select: {
    height: 36,
    padding: "0 10px",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    fontSize: 14,
    background: "#fff",
  },
  btn: {
    height: 36,
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    fontSize: 14,
    cursor: "pointer",
    background: "#eef2f7",
  },
  btnPri: {
    height: 36,
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid #22c3ee",
    background: "#0ea5e9",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
  table: { width: "100%", borderCollapse: "collapse", marginTop: 12 },
  th: {
    textAlign: "left",
    fontSize: 12,
    color: "#64748b",
    padding: "10px 8px",
    borderBottom: "1px solid #e2e8f0",
  },
  td: {
    fontSize: 14,
    color: "#0f172a",
    padding: "10px 8px",
    borderBottom: "1px solid #eef2f7",
    verticalAlign: "top",
  },
  modalBack: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,.35)",
    display: "grid",
    placeItems: "center",
    zIndex: 50,
  },
  modal: {
    width: "min(720px,92vw)",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    boxShadow: "0 20px 60px rgba(15,23,42,.25)",
    padding: 16,
  },
};
