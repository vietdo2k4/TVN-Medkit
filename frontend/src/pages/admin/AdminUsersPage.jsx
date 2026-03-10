// src/pages/admin/AdminUsersPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";

// ====== Inline styles ======
const S = {
  head: { display: "flex", alignItems: "center", gap: 12, marginBottom: 14 },
  h1: { fontSize: 22, fontWeight: 800, margin: 0, color: "#0b2239" },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    boxShadow: "0 4px 20px rgba(15,23,42,0.06)",
    padding: 12,
  },
  row: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  input: {
    height: 36,
    padding: "0 12px",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    outline: "none",
    fontSize: 14,
  },
  nameLink: {
    border: "none",
    background: "transparent",
    color: "#3f687bff",          // cùng palette admin
    cursor: "pointer",
    padding: 0,
    fontWeight: 600,           // đậm hơn cho tiêu đề dòng
    fontSize: 15,              // khớp visual với danh sách bác sĩ
    fontFamily:
      'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  },
  select: {
    height: 36,
    padding: "0 10px",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    outline: "none",
    fontSize: 14,
    background: "#fff",
  },
  btn: {
    height: 36,
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid #e2e8f0ff",
    fontSize: 14,
    cursor: "pointer",
    background: "#e6e6e8de",
  },
  btnPrimary: {
    height: 36,
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid #22c3ee",
    background: "#0ea5e9",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
  table: { width: "100%", borderCollapse: "collapse", marginTop: 12 },
  th: { textAlign: "left", fontSize: 12, color: "#64748b", padding: "10px 8px", borderBottom: "1px solid #e2e8f0" },
  td: { fontSize: 14, color: "#0f172a", padding: "10px 8px", borderBottom: "1px solid #eef2f7", verticalAlign: "top" },
  badge: (color) => ({
    display: "inline-block",
    fontSize: 12,
    padding: "2px 8px",
    borderRadius: 999,
    background: color === "ok" ? "rgba(34,197,94,.1)" : "rgba(244,63,94,.1)",
    color: color === "ok" ? "#16a34a" : "#e11d48",
    border: `1px solid ${color === "ok" ? "#bbf7d0" : "#fecdd3"}`,
  }),
  pager: { display: "flex", gap: 8, alignItems: "center", marginTop: 12 },
  modalBack: {
    position: "fixed", inset: 0, background: "rgba(15,23,42,.35)",
    display: "grid", placeItems: "center", zIndex: 50,
  },
  modal: {
    width: "min(640px, 92vw)",
    background: "#fff",
    borderRadius: 14,
    border: "1px solid #e2e8f0",
    boxShadow: "0 20px 60px rgba(15,23,42,.25)",
    padding: 16,
  },
};


const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const token = () => localStorage.getItem("token") || "";
const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token()}`,
});
const fmtTime = (s) => (s ? new Date(s).toLocaleString("vi-VN") : "");

// ====== Page component ======
export default function AdminUsersPage() {
  // filters
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  // list
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [hasNext, setHasNext] = useState(false);

  // create form
  const [cEmail, setCEmail] = useState("");
  const [cRole, setCRole] = useState("patient");
  const [cStatus, setCStatus] = useState("active");
  const [cPwd, setCPwd] = useState("");

  // detail modal
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);

  const qDebounceRef = useRef(0);

  // fetch list
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const u = new URL(`${API}/admin/users`);
        if (q) u.searchParams.set("q", q);
        if (role) u.searchParams.set("role", role);
        if (status) u.searchParams.set("status", status);
        u.searchParams.set("page", String(page));
        u.searchParams.set("limit", String(limit));
        const r = await fetch(u.toString(), { headers: headers(), signal: ac.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const arr = await r.json();
        setItems(Array.isArray(arr) ? arr : []);
        setHasNext(Array.isArray(arr) && arr.length === limit);
      } catch (e) {
        if (e.name !== "AbortError") setErr(e.message || "Request error");
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [q, role, status, page]);

  // debounce search input
  const onChangeQ = (v) => {
    setQ(v);
    setPage(1);
    window.clearTimeout(qDebounceRef.current);
    qDebounceRef.current = window.setTimeout(() => setQ((x) => x), 250);
  };

  // create
  const onCreate = async () => {
    if (!cEmail.trim()) return alert("Nhập email");
    try {
      const r = await fetch(`${API}/admin/users`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ email: cEmail.trim(), role: cRole, status: cStatus, password: cPwd || undefined }),
      });
      if (r.status === 409) {
        const m = await r.json().catch(() => ({}));
        return alert(m?.message || "Email đã tồn tại");
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      // reset
      setCEmail(""); setCPwd(""); setCRole("patient"); setCStatus("active");
      // refresh
      setPage(1);
      setQ(""); setRole(""); setStatus("");
    } catch (e) {
      alert(e.message || "Không tạo được");
    }
  };

  // update inline
  const onUpdate = async (id, patch) => {
    try {
      const r = await fetch(`${API}/admin/users/${id}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      // optimistic
      setItems((xs) => xs.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    } catch (e) {
      alert(e.message || "Không cập nhật được");
    }
  };

  // delete
  const onDelete = async (id) => {
    if (!confirm("Xóa người dùng này?")) return;
    try {
      const r = await fetch(`${API}/admin/users/${id}`, { method: "DELETE", headers: headers() });
      if (r.status === 409) {
        const m = await r.json().catch(() => ({}));
        return alert(m?.message || "Không thể xóa do ràng buộc");
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setItems((xs) => xs.filter((x) => x.id !== id));
    } catch (e) {
      alert(e.message || "Không xóa được");
    }
  };

  // detail
  const openDetail = async (id) => {
    try {
      const r = await fetch(`${API}/admin/users/${id}`, { headers: headers() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setDetail(await r.json());
      setOpen(true);
    } catch (e) {
      alert(e.message || "Không tải được chi tiết");
    }
  };

  const rows = useMemo(() => items, [items]);

  return (
    <div>
      <div style={S.head}>
        <h2 style={S.h1}>Quản lý người dùng</h2>
        <div style={{ marginLeft: "auto" }} />
        <div style={{ color: "#64748b", fontSize: 12 }}>Trang {page}</div>
      </div>

      {/* Bộ lọc */}
      <div style={{ ...S.card, marginBottom: 12 }}>
        <div style={S.row}>
          <input
            value={q}
            onChange={(e) => onChangeQ(e.target.value)}
            placeholder="Tìm theo tên hoặc email…"
            style={{ ...S.input, width: 280 }}
          />
          <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} style={S.select}>
            <option value="">Tất cả role</option>
            <option value="patient">patient</option>
            <option value="doctor">doctor</option>
            <option value="admin">admin</option>
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={S.select}>
            <option value="">Tất cả trạng thái</option>
            <option value="active">active</option>
            <option value="blocked">blocked</option>
          </select>
          <button style={S.btn} onClick={() => { setQ(""); setRole(""); setStatus(""); setPage(1); }}>Xóa lọc</button>

          <div style={{ marginLeft: "auto" }} />
          <div style={S.pager}>
            <button
              style={S.btn}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              title="Prev"
            >
              Prev
            </button>
            <button
              style={S.btn}
              onClick={() => hasNext && setPage((p) => p + 1)}
              disabled={!hasNext}
              title="Next"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Form tạo nhanh */}
      <div style={{ ...S.card, marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Tạo người dùng</div>
        <div style={S.row}>
          <input style={{ ...S.input, width: 260 }} placeholder="Email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} />
          <select style={S.select} value={cRole} onChange={(e) => setCRole(e.target.value)}>
            <option value="patient">patient</option>
            <option value="doctor">doctor</option>
            <option value="admin">admin</option>
          </select>
          <select style={S.select} value={cStatus} onChange={(e) => setCStatus(e.target.value)}>
            <option value="active">active</option>
            <option value="blocked">blocked</option>
          </select>
          <input style={{ ...S.input, width: 220 }} placeholder="Password (tùy chọn)" value={cPwd} onChange={(e) => setCPwd(e.target.value)} />
          <button style={S.btnPrimary} onClick={onCreate}>Tạo</button>
        </div>
      </div>

      {/* Bảng dữ liệu */}
      <div style={S.card}>
        {loading ? (
          <div style={{ padding: 12 }}>Đang tải…</div>
        ) : err ? (
          <div style={{ padding: 12, color: "#e11d48" }}>Lỗi: {String(err)}</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 12, color: "#64748b" }}>Không có dữ liệu</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>ID</th>
                <th style={S.th}>Họ tên</th>
                <th style={S.th}>Email</th>
                <th style={S.th}>Role</th>
                <th style={S.th}>Trạng thái</th>
                <th style={S.th}>Ngày tạo</th>
                <th style={S.th}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td style={S.td}>{u.id}</td>
                  <td style={S.td}>
                    <button
                      onClick={() => openDetail(u.id)}
                      style={S.nameLink}
                      title="Xem chi tiết"
                    >
                      {u.full_name || <span style={{ color: "#64748b" }}>(chưa có hồ sơ)</span>}
                    </button>
                  </td>
                  <td style={S.td}>{u.email}</td>
                  <td style={S.td}>
                    <select
                      value={u.role}
                      onChange={(e) => onUpdate(u.id, { role: e.target.value })}
                      style={S.select}
                    >
                      <option value="patient">patient</option>
                      <option value="doctor">doctor</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td style={S.td}>
                    <span style={S.badge(u.status === "active" ? "ok" : "bad")}>{u.status}</span>
                    <select
                      value={u.status}
                      onChange={(e) => onUpdate(u.id, { status: e.target.value })}
                      style={{ ...S.select, marginLeft: 8 }}
                    >
                      <option value="active">active</option>
                      <option value="blocked">blocked</option>
                    </select>
                  </td>
                  <td style={S.td}>{fmtTime(u.created_at)}</td>
                  <td style={S.td}>
                    <button
                      style={S.btn}
                      onClick={() => {
                        const p = prompt("Nhập mật khẩu mới (bỏ trống để hủy):", "");
                        if (p && p.trim()) onUpdate(u.id, { password: p.trim() });
                      }}
                      title="Đổi mật khẩu"
                    >
                      Đổi MK
                    </button>
                    <button
                      style={{ ...S.btn, marginLeft: 8, borderColor: "#fecdd3", background: "#fee2e2", color: "#000000ff" }}
                      onClick={() => onDelete(u.id)}
                      title="Xóa"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Phân trang dưới */}
        {!loading && rows.length > 0 && (
          <div style={{ ...S.pager, justifyContent: "flex-end" }}>
            <button style={S.btn} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              Prev
            </button>
            <div style={{ fontSize: 12, color: "#64748b" }}>Trang {page}</div>
            <button style={S.btn} onClick={() => hasNext && setPage((p) => p + 1)} disabled={!hasNext}>
              Next
            </button>
          </div>
        )}
      </div>

      {/* Modal chi tiết */}
      {open && (
        <div style={S.modalBack} onClick={() => setOpen(false)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Thông tin chi tiết</div>
              <div style={{ marginLeft: "auto" }} />
              <button style={S.btn} onClick={() => setOpen(false)}>Đóng</button>
            </div>
            <div style={{ marginTop: 10, fontSize: 14 }}>
              {detail ? (
                <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", rowGap: 8 }}>
                  <div style={{ color: "#64748b" }}>ID</div><div>{detail.id}</div>
                  <div style={{ color: "#64748b" }}>Email</div><div>{detail.email}</div>
                  <div style={{ color: "#64748b" }}>Họ tên</div><div>{detail.full_name || "(chưa có hồ sơ)"}</div>
                  <div style={{ color: "#64748b" }}>Role</div><div>{detail.role}</div>
                  <div style={{ color: "#64748b" }}>Trạng thái</div><div>{detail.status}</div>
                  <div style={{ color: "#64748b" }}>Tạo lúc</div><div>{fmtTime(detail.created_at)}</div>
                  <div style={{ color: "#64748b" }}>Cập nhật</div><div>{fmtTime(detail.updated_at)}</div>
                </div>
              ) : (
                "Đang tải…"
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
