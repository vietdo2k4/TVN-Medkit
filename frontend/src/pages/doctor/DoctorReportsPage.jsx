// frontend/src/pages/doctor/DoctorReportsPage.jsx
import { useMemo, useState } from "react";

function firstDayOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString("en-CA");
}
function todayISO() {
  return new Date().toLocaleDateString("en-CA");
}

export default function DoctorReportsPage() {
  const [from, setFrom] = useState(firstDayOfMonthISO());
  const [to, setTo] = useState(todayISO());
  const [busy, setBusy] = useState(false);

  const API = import.meta.env.VITE_API_BASE_URL;
  const token = localStorage.getItem("token");

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p.toString();
  }, [from, to]);

  async function download(url, filename) {
    setBusy(true);
    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) {
        const t = await r.text();
        alert(`Tải thất bại: ${r.status}\n${t}`);
        return;
      }
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      alert(e?.message || "Lỗi tải file");
    } finally {
      setBusy(false);
    }
  }

  const fileName = (base) => `${base}_${from || "all"}_${to || "all"}.csv`;

  return (
    <div style={S.page}>
      <div style={S.head}>
        <div style={S.title}>Báo cáo</div>
        <div style={S.filters}>
          <label style={S.label}>Từ ngày</label>
          <input type="date" style={S.input} value={from} onChange={(e) => setFrom(e.target.value)} />
          <label style={S.label}>Đến ngày</label>
          <input type="date" style={S.input} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div style={S.desc}>
        Xuất <b>Excel doanh thu</b> theo khoảng ngày (lọc theo <b>ngày khám</b>)
      </div>

      <div style={S.cards}>
        <div style={S.card}>
          <div style={S.cardLabel}>In Excel doanh thu</div>
          <div style={S.cardDesc}>
            Bảng chi tiết từng phiếu: STT, ngày đặt, ngày/giờ khám, bệnh nhân, trạng thái, phí khám (đã thanh toán).
          </div>
          <button
            disabled={busy}
            style={S.btn}
            onClick={() =>
              download(`${API}/doctor/reports/revenue-excel?${qs}`, fileName("revenue_detail"))
            }
          >
            Tải Excel doanh thu
          </button>
        </div>
      </div>
    </div>
  );
}

/* inline CSS */
const S = {
  page: { maxWidth: 1120, margin: "0 auto", padding: 16, color: "#0f172a" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 20, fontWeight: 800 },
  filters: { display: "flex", gap: 8, alignItems: "center" },
  label: { fontSize: 13, color: "#475569" },
  input: { border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 10px", outline: "none" },

  desc: { margin: "6px 0 14px", color: "#475569" },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 },
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, boxShadow: "0 2px 10px rgba(2,6,23,.04)", padding: 14, display: "grid", gap: 10 },
  cardLabel: { fontWeight: 700, color: "#0f172a" },
  cardDesc: { color: "#475569", minHeight: 42 },
  btn: { border: "1px solid #0ea5e9", background: "#fff", color: "#0369a1", padding: "10px 12px", borderRadius: 12, cursor: "pointer", justifySelf: "start" },
};
