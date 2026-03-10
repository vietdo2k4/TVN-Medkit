import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SearchBars from "../components/SearchBars.jsx";
import DoctorsHero from "../components/DoctorsHero";
import "../styles/doctors-hero.css";
import "../styles/doctor-page.css";

export default function DoctorsPage() {
  const API = import.meta.env.VITE_API_BASE_URL;
  const { search, pathname } = useLocation();
  const nav = useNavigate();
  //useMemo: Parse URL query params thành object - chỉ parse lại khi URL thay đổi
  //Dependencies: [search] - optimization để tránh tạo URLSearchParams mới mỗi lần render
  const params = useMemo(() => new URLSearchParams(search), [search]);

  //useEffect: Luôn scroll lên đầu trang khi vào DoctorsPage
  //Dependencies: [] - chỉ chạy 1 lần khi mount
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);

  // đọc query khi vào trang lần đầu
  const qInit = params.get("q") || "";
  const specInit = params.get("specialty") || "";
  const hospInit = params.get("hospital") || "";
  const priceInit = params.get("price") || "";
  const pageInit = Math.max(parseInt(params.get("page") || "1", 10), 1);

  //useState: Từ khóa tìm kiếm - bind với SearchBars component
  const [q, setQ] = useState(qInit);

  //useState: ID chuyên khoa được chọn - filter theo specialty dropdown
  const [specialty, setSpec] = useState(specInit);

  //useState: ID cơ sở y tế được chọn - filter theo hospital dropdown  
  const [hospital, setHospital] = useState(hospInit);

  //useState: Khoảng giá được chọn - "lt300", "300-500", "gt500"
  const [price, setPrice] = useState(priceInit);

  //useState: Trang hiện tại (pagination) - bắt đầu từ 1
  const [page, setPage] = useState(pageInit);

  // đồng bộ URL NHƯNG không điều hướng (không remount) -> chỉ thay URL
  //Cập nhật URL mỗi khi filter thay đổi (không reload trang)
  useEffect(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (specialty) p.set("specialty", specialty);
    if (hospital) p.set("hospital", hospital);
    if (price) p.set("price", price);
    if (page !== 1) p.set("page", String(page));
    const qs = p.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    window.history.replaceState(null, "", url);
  }, [q, specialty, hospital, price, page, pathname]);

  // options - Danh sách lựa chọn cho dropdown filter
  //State: Danh sách tất cả chuyên khoa (cho dropdown)
  const [specOpts, setSpecOpts] = useState([]);
  //State: Danh sách tất cả cơ sở y tế (cho dropdown)
  const [hospOpts, setHospOpts] = useState([]);

  // dữ liệu list - Kết quả tìm kiếm
  //State: Danh sách bác sĩ hiển thị
  const [items, setItems] = useState([]);
  //State: Tổng số bác sĩ tìm thấy
  const [total, setTotal] = useState(0);
  //State: Số lượng item/trang
  const [limit, setLimit] = useState(6);
  //State: Trạng thái đang tải dữ liệu
  const [loading, setLoading] = useState(false);

  // nạp options - Gọi API lấy danh sách chuyên khoa và cơ sở y tế cho dropdown
  useEffect(() => {
    (async () => {
      try {
        const [s, h] = await Promise.all([
          fetch(`${API}/specialties`).then(r => (r.ok ? r.json() : [])),
          fetch(`${API}/hospitals/options`).then(r => (r.ok ? r.json() : [])),
        ]);
        setSpecOpts(Array.isArray(s) ? s : []);
        setHospOpts(Array.isArray(h) ? h : []);
      } catch {
        setSpecOpts([]); setHospOpts([]);
      }
    })();
  }, [API]);

  //Reset về trang 1 khi bất kỳ filter nào đổi (ví dụ: đổi chuyên khoa thì quay về trang 1)
  useEffect(() => {
    setPage(1);
  }, [q, specialty, hospital, price]);

  // nạp danh sách bác sĩ - Gọi API tìm kiếm mỗi khi filter/page thay đổi
  useEffect(() => {
    (async () => {
      //Tính offset cho pagination
      const offset = (page - 1) * limit;
      const qs = new URLSearchParams({
        q, specialty, hospital, price,
        limit: String(limit), offset: String(offset),
      });
      setLoading(true);
      try {
        const r = await fetch(`${API}/doctors?${qs.toString()}`);
        const data = r.ok ? await r.json() : { items: [], total: 0, limit };
        setItems(data.items || []);
        setTotal(Number(data.total || 0));
        setLimit(Number(data.limit || limit));
      } catch {
        setItems([]); setTotal(0);
      } finally { setLoading(false); }
    })();
  }, [API, q, specialty, hospital, price, page, limit]);

  //Tính tổng số trang
  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="doctors-page">
      <main className="container docspg">
        <DoctorsHero />

        {/* Thanh tìm kiếm: controlled, không điều hướng */}
        <div className="hero-wide">
          <SearchBars
            value={q}
            onChange={(s) => { setQ(s); }}
          />
        </div>

        <h2 className="docspg__title">
          {q || specialty || hospital || price
            ? `Đã tìm thấy ${total} kết quả phù hợp`
            : `Tất cả bác sĩ (${total})`}
        </h2>

        {/* Bộ lọc */}
        <div className="docspg__filters">
          <select className="doc-select" value={specialty}
            onChange={(e) => { setSpec(e.target.value); }}>
            <option value="">Tất cả chuyên khoa</option>
            {specOpts.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
          </select>

          <select className="doc-select" value={hospital}
            onChange={(e) => { setHospital(e.target.value); }}>
            <option value="">Tất cả cơ sở y tế</option>
            {hospOpts.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>

          <select className="doc-select" value={price}
            onChange={(e) => { setPrice(e.target.value); }}>
            <option value="">Tất cả giá</option>
            <option value="lt300">{"< 300k"}</option>
            <option value="300-500">300k – 500k</option>
            <option value="gt500">{"> 500k"}</option>
          </select>

          <button
            className="btn-reset"
            onClick={() => { setQ(""); setSpec(""); setHospital(""); setPrice(""); }}
          >
            Xóa lọc
          </button>


        </div>

        {/* Danh sách */}
        <div className="doclist doclist--2col">
          {loading && <div className="muted" style={{ textAlign: "center" }}>Đang tải…</div>}

          {!loading && items.map(d => (
            <article key={d.id} className="doc-card">
              <div className="doc-card__left">
                <img
                  src={d.avatar || "/assets/images/doctor.png"}
                  onError={(e) => { e.currentTarget.src = "/assets/images/doctor.png"; }}
                  alt={d.full_name}
                  className="doc-card__avatar"
                />
                <div className="doc-card__meta">
                  <div className="doc-card__name">{d.full_name}</div>
                  <div className="doc-card__sub">
                    {d.specialty_name || "—"} • {d.hospital_name || "—"}
                  </div>
                  <div className="doc-card__fee">
                    {d.fee_min ? `• Giá khám: ${Number(d.fee_min).toLocaleString()}đ` : ""}
                  </div>
                </div>
              </div>

              <button className="doc-btn doc-card__cta" onClick={() => nav(`/doctors/${d.id}`)}>
                Đặt khám
              </button>
            </article>
          ))}

          {!loading && items.length === 0 && (
            <div className="muted" style={{ gridColumn: "1/-1", textAlign: "center", padding: "20px 0" }}>
              Không tìm thấy thông tin bác sĩ.
            </div>
          )}
        </div>

        {/* Phân trang */}
        {total > 0 && pages > 1 && (
          <nav className="pager-wrap" aria-label="pagination">
            <button className="pager" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>‹</button>
            {Array.from({ length: pages }).slice(0, 5).map((_, i) => {
              const p = i + 1;
              return (
                <button key={p} className={"pager" + (page === p ? " active" : "")} onClick={() => setPage(p)}>
                  {p}
                </button>
              );
            })}
            <button className="pager" disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))}>›</button>
          </nav>
        )}
      </main>
    </div>
  );
}
