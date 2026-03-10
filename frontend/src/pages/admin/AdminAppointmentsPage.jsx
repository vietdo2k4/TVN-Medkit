import { useEffect, useMemo, useState } from "react";
import {
  listAppointments,
  listHospitals,
  listDoctors,
} from "../../api/admin";

// fmt hiển thị thời gian theo locale VN
const fmt = (s) => (s ? new Date(s).toLocaleString("vi-VN") : "");
// toSQL chuyển datetime-local -> 'YYYY-MM-DD HH:mm:ss' cho BE
const toSQL = (dtLocal) =>
  dtLocal ? new Date(dtLocal).toISOString().slice(0, 19).replace("T", " ") : "";


const STATUS_META = {
  pending: { text: "Chờ xác nhận", bg: "#fff7ed", bd: "#fed7aa", fg: "#9a3412" },
  confirmed: { text: "Đã xác nhận", bg: "#ecfeff", bd: "#bae6fd", fg: "#075985" },
  completed: { text: "Đã khám", bg: "#ecfdf5", bd: "#bbf7d0", fg: "#166534" },
  cancelled: { text: "Đã hủy", bg: "#fee2e2", bd: "#fecaca", fg: "#991b1b" },
  no_show: { text: "Không đến", bg: "#f3f4f6", bd: "#e5e7eb", fg: "#374151" },
};

export default function AdminAppointmentsPage() {
  /*State filter + phân trang*/
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [hospitalId, setHospitalId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  /*Danh mục cơ sở/bác sĩ cho filter*/
  const [hospitals, setHospitals] = useState([]);
  const [doctors, setDoctors] = useState([]);

  /*Dữ liệu bảng*/
  const [items, setItems] = useState([]);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  /*Load danh sách cơ sở khi mở trang*/
  useEffect(() => {
    (async () => {
      try {
        setHospitals(await listHospitals({ limit: 200 }));
      } catch { /* empty */ }
    })();
  }, []);

  /*Khi chọn cơ sở -> nạp danh sách bác sĩ thuộc cơ sở*/
  useEffect(() => {
    (async () => {
      try {
        setDoctors(await listDoctors({ hospitalId, limit: 200 }));
      } catch { /* empty */ }
    })();
  }, [hospitalId]);

  /*Gọi API lấy danh sách lịch hẹn theo filter*/
  useEffect(() => {
    (async () => {
      try {
        setLoading(true); setErr("");
        const arr = await listAppointments({
          q, status, hospitalId, doctorId,
          from: toSQL(from), to: toSQL(to),
          page, limit,
        });
        setItems(Array.isArray(arr) ? arr : []);
        setHasNext(Array.isArray(arr) && arr.length === limit);
      } catch (e) { setErr(e.message || "Request error"); }
      finally { setLoading(false); }
    })();
  }, [q, status, hospitalId, doctorId, from, to, page]);

  /* Memo hoá rows (dễ gắn thêm transform nếu cần)*/
  const rows = useMemo(() => items, [items]);

  /*Reset filter nhanh*/
  const clear = () => {
    setQ(""); setStatus(""); setHospitalId(""); setDoctorId("");
    setFrom(""); setTo(""); setPage(1);
  };

  /*Render chip trạng thái */
  const Chip = ({ st }) => {
    const m = STATUS_META[st] || { text: st, bg: "#eef2f7", bd: "#e2e8f0", fg: "#0f172a" };
    return (
      <span
        style={{
          padding: "2px 10px",
          borderRadius: 999,
          background: m.bg,
          color: m.fg,
          border: `1px solid ${m.bd}`,
          fontSize: 12,
          fontWeight: 700,
          whiteSpace: "nowrap",
        }}
        title={st}
      >
        {m.text}
      </span>
    );
  };

  return (
    <div>
      {/* Tiêu đề trang */}
      <div style={S.head}>
        <h2 style={S.h1}>Quản lý phiếu khám</h2>
      </div>

      {/* Khối filter */}
      <div style={{ ...S.card, marginBottom: 12 }}>
        <div style={S.row}>
          {/* Tên bệnh nhân */}
          <input
            style={{ ...S.input, width: 260 }}
            placeholder="Tìm tên bệnh nhân…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
          />

          {/* Trạng thái (filter) */}
          <select
            style={S.select}
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="pending">Chờ xác nhận</option>
            <option value="confirmed">Đã xác nhận</option>
            <option value="completed">Đã khám</option>
            <option value="cancelled">Đã hủy</option>
            <option value="no_show">Không đến</option>
          </select>

          {/* Cơ sở */}
          <select
            style={S.select}
            value={hospitalId}
            onChange={(e) => { setHospitalId(e.target.value); setDoctorId(""); setPage(1); }}
          >
            <option value="">Tất cả cơ sở</option>
            {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>

          {/* Bác sĩ */}
          <select
            style={S.select}
            value={doctorId}
            onChange={(e) => { setDoctorId(e.target.value); setPage(1); }}
          >
            <option value="">Tất cả bác sĩ</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </select>

          {/* Khoảng thời gian */}
          <input type="datetime-local" style={S.input}
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          <input type="datetime-local" style={S.input}
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1); }} />

          {/* Nút xoá lọc + chuyển trang */}
          <button style={S.btn} onClick={clear}>Xóa lọc</button>
          <div style={{ marginLeft: "auto" }} />
          <button style={S.btn}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}>
            Prev
          </button>
          <span style={{ fontSize: 12, color: "#64748b" }}>Trang {page}</span>
          <button style={S.btn}
            onClick={() => hasNext && setPage((p) => p + 1)}
            disabled={!hasNext}>
            Next
          </button>
        </div>
      </div>

      {/* Bảng dữ liệu */}
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
                <th style={S.th}>Thời gian</th>
                <th style={S.th}>Bệnh nhân</th>
                <th style={S.th}>Bác sĩ</th>
                <th style={S.th}>Cơ sở</th>
                <th style={S.th}>Trạng thái</th>
                <th style={S.th}>Tạo lúc</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td style={S.td}>{fmt(a.start_time)}</td>
                  <td style={S.td}>{a.patient_name}</td>
                  <td style={S.td}>{a.doctor_name}</td>
                  <td style={S.td}>{a.hospital_name}</td>
                  <td style={S.td}>
                    {/* CHỈ XEM: chip, không còn select chỉnh trạng thái */}
                    <Chip st={a.status} />
                  </td>
                  <td style={S.td}>{fmt(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ======================= CSS inline (đặt cuối file) ======================= */
const S = {
  // Header trang
  head: { display: "flex", alignItems: "center", gap: 12, marginBottom: 14 },
  h1: { fontSize: 22, fontWeight: 800, margin: 0, color: "#0b2239" },

  // Card/khối
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    boxShadow: "0 4px 20px rgba(15,23,42,.06)",
    padding: 12,
  },

  // Hàng filter
  row: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },

  // Ô input/select/nút
  input: {
    height: 36,
    padding: "0 12px",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    fontSize: 14,
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

  // Bảng
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
    verticalAlign: "middle",
  },
};
