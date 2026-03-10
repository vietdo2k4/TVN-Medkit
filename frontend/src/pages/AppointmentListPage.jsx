// src/pages/AppointmentListPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/appointments-list.css";

//Map trạng thái sang nhãn tiếng Việt
const LABEL = {
  all: "Tất cả",
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  completed: "Đã khám",
  cancelled: "Đã hủy",
  paid: "Đã thanh toán",
  unpaid: "Chưa thanh toán",
};

//Danh sách các tab filter có thể chọn
const FILTERS = ["all", "pending", "confirmed", "completed", "cancelled", "paid", "unpaid"];
const PAGE_SIZE = 5;

//Helper: Format ngày giờ sang dạng hiển thị
function fmtDate(input, mode = "day") {
  if (mode === "created") {
    const d = new Date(input || "");
    if (!Number.isFinite(d.getTime())) return "—";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mi} ${dd}-${mm}-${yyyy}`;
  }

  // mode === "day": nhận "YYYY-MM-DD" hoặc ISO bất kỳ
  const s = String(input || "").slice(0, 10);      // "YYYY-MM-DD"
  const [yyyy, mm, dd] = s.split("-");
  if (!yyyy || !mm || !dd) return "—";
  return `${dd.padStart(2, "0")}-${mm.padStart(2, "0")}-${yyyy}`;
}

export default function AppointmentListPage() {
  const API = import.meta.env.VITE_API_BASE_URL;
  const token = localStorage.getItem("token");
  const nav = useNavigate();

  //State: Danh sách tất cả phiếu khám của user
  const [items, setItems] = useState([]);
  //State: Tab filter đang chọn (all, pending, confirmed...)
  const [tab, setTab] = useState("all");
  //State: Đang tải dữ liệu hay không
  const [loading, setLoading] = useState(false);
  //State: Trang hiện tại (pagination)
  const [page, setPage] = useState(1);

  //Gọi API lấy danh sách phiếu khám khi component mount
  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`${API}/me/appointments`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = r.ok ? await r.json() : { items: [] };
        const list = Array.isArray(data) ? data : (data.items || []);
        setItems(list);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [API, token]);

  //Reset về trang 1 khi đổi tab hoặc items thay đổi
  useEffect(() => { setPage(1); }, [tab, items]);

  //Lọc danh sách theo tab hiện tại (pending/completed...) và sắp xếp theo thời gian tạo
  const filtered = useMemo(() => {
    let arr = items;
    if (tab !== "all") {
      if (tab === "paid" || tab === "unpaid") {
        //Lọc theo trạng thái thanh toán
        arr = arr.filter((x) => (x.payment_status || x.paymentStatus || "").toLowerCase() === tab);
      } else {
        //Lọc theo trạng thái phiếu (pending, confirmed...)
        arr = arr.filter((x) => (x.status || "").toLowerCase() === tab);
      }
    }
    //Sắp xếp: Mới nhất lên đầu
    return [...arr].sort((a, b) => {
      const ta = new Date(a.created_at || a.createdAt || 0).getTime();
      const tb = new Date(b.created_at || b.createdAt || 0).getTime();
      if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return tb - ta;
      return Number(b.id || 0) - Number(a.id || 0);
    });
  }, [items, tab]);

  //Tính tổng số trang
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  //Lấy items của trang hiện tại
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  //Hàm chuyển trang (có scroll lên đầu)
  function goto(p) {
    const n = Math.min(Math.max(1, p), totalPages);
    setPage(n);
    // eslint-disable-next-line no-empty
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { }
  }

  //Tính các số trang hiện thị trong pagination (window = 7 trang)
  const pagerNums = (() => {
    const nums = [];
    const win = 7;
    let from = Math.max(1, page - Math.floor(win / 2));
    let to = from + win - 1;
    if (to > totalPages) { to = totalPages; from = Math.max(1, to - win + 1); }
    for (let i = from; i <= to; i++) nums.push(i);
    return nums;
  })();

  return (
    <div className="appt">
      <h2 className="appt__title">Danh sách phiếu khám</h2>

      <div className="appt__filters">
        {FILTERS.map((k) => (
          <button
            key={k}
            className={"appt__tab" + (tab === k ? " is-active" : "")}
            onClick={() => setTab(k)}
          >
            {LABEL[k]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="appt__empty">Đang tải…</div>
      ) : filtered.length === 0 ? (
        <div className="appt__empty">Không có phiếu nào trong mục này.</div>
      ) : (
        <>
          <ul className="appt__list">
            {pageItems.map((a) => {
              const s = (a.status || "").toLowerCase();
              const p = (a.payment_status || a.paymentStatus || "").toLowerCase();
              const date = fmtDate(a.date || a.day, "day").slice(0, 10);
              const time = a.time || "";
              const createdAt = fmtDate(a.created_at || a.createdAt, "created");
              return (
                <li
                  key={a.id}
                  className="appt__row appt__row--link"
                  onClick={() => nav(`/me/appointments/${a.id}`)}
                  role="button"
                >
                  <div className="appt__col appt__col--doc">
                    <div className="appt__doc-name">{a.doctor_name || a.doctorName}</div>
                    <div className="appt__doc-sub">{a.hospital_name || a.hospitalName}</div>
                    <div className="appt__doc-sub small">Đặt lúc: {createdAt}</div>
                  </div>

                  <div className="appt__col appt__col--dt">
                    <div className="appt__dt">{date} • {time}</div>
                  </div>

                  <div className="appt__col appt__col--badges">
                    <span className={"appt__badge " + s}>{LABEL[s] || "—"}</span>
                    <span className={"appt__badge " + (p || "neutral")}>{LABEL[p] || "—"}</span>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="appt__pager">
            <button className="appt__page-btn" onClick={() => goto(page - 1)} disabled={page <= 1} aria-label="Trang trước">‹</button>

            {pagerNums[0] > 1 && (
              <>
                <button className="appt__page-btn" onClick={() => goto(1)}>1</button>
                {pagerNums[0] > 2 && <span className="appt__page-ellipsis">…</span>}
              </>
            )}

            {pagerNums.map((n) => (
              <button key={n} className={"appt__page-btn" + (n === page ? " is-active" : "")} onClick={() => goto(n)}>
                {n}
              </button>
            ))}

            {pagerNums[pagerNums.length - 1] < totalPages && (
              <>
                {pagerNums[pagerNums.length - 1] < totalPages - 1 && <span className="appt__page-ellipsis">…</span>}
                <button className="appt__page-btn" onClick={() => goto(totalPages)}>{totalPages}</button>
              </>
            )}

            <button className="appt__page-btn" onClick={() => goto(page + 1)} disabled={page >= totalPages} aria-label="Trang sau">›</button>
          </div>

          <style>{`
            .appt__doc-sub.small{font-size:12px; opacity:.75; margin-top:2px}
            .appt__pager{display:flex; gap:6px; justify-content:center; align-items:center; margin:20px 0}
            .appt__page-btn{min-width:32px; height:32px; padding:0 8px; border-radius:8px; border:1px solid #e5e7eb; background:#fff; cursor:pointer}
            .appt__page-btn.is-active{background:#0ea5e9; color:#fff; border-color:#0ea5e9; font-weight:600}
            .appt__page-btn:disabled{opacity:.5; cursor:not-allowed}
            .appt__page-ellipsis{padding:0 4px; color:#94a3b8}
          `}</style>
        </>
      )}
    </div>
  );
}
