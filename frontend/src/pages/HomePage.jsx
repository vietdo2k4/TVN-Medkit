import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import ServiceCard from "../components/ServiceCard";
import FacilitySection from "../components/FacilitySection";
import SpecialtyItem from "../components/SpecialtyItem";
import DoctorBookingSection from "../components/DoctorBookingSection";

import AssistantButton from "../components/chatbot/AssistantButton";
import ListNews from "../components/ListNews";
import "../styles/hero.css";

export default function HomePage() {
  useEffect(() => { document.title = "TVN Medkit"; }, []);
  const nav = useNavigate();
  const isAuthed = !!localStorage.getItem("token");
  const API = import.meta.env.VITE_API_BASE_URL;

  const [specs, setSpecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    fetch(`${API}/specialties`, { signal: ac.signal })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => setSpecs(Array.isArray(data) ? data : []))
      .catch(() => setSpecs([]))
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [API]);

  return (
    <main>
      {/* HERO */}
      <section className="hero-bg">
        <div className="hero-overlay">
          <h1 className="hero-title">Kết nối Người Dân với Cơ sở & Dịch vụ Y tế hàng đầu</h1>
          <div className="hero hero-search">
            <div className="hero-wide">
              <SearchBar onSearch={(val) => nav(`/doctors?q=${encodeURIComponent(val)}`)} />
            </div>
          </div>
          <ul className="benefits-list">
            <li>Đặt khám nhanh - Lấy số thứ tự trực tuyến - Tư vấn sức khỏe từ xa</li>
            <li>Đặt khám theo giờ - Đặt càng sớm để được khám bênh sớm nhất</li>
            <li>Tìm kiếm dễ dàng - Chọn chuyên khoa, bác sĩ bạn muốn khám </li>
          </ul>
        </div>
      </section>

      {/* 3 tính năng */}
      <section className="section">
        <div className="container cards-3">
          <ServiceCard to="/hospitals" icon="📅" title="Đặt khám tại cơ sở" desc="Đặt lịch nhanh chóng" square />
          <ServiceCard to="/doctors?mode=by-doctor" icon="🩺" title="Đặt khám theo bác sĩ" desc="Chọn bác sĩ mong muốn" square />
          <ServiceCard to={isAuthed ? "/me" : "/login"} icon="👤" title="Hồ sơ cá nhân" desc="Quản lý hồ sơ y tế" square />
        </div>

        {/* CSS bổ sung để lưới 3 cột cân đều */}
        <style>{`
          .cards-3{
            display:grid;
            grid-template-columns:repeat(3, minmax(0, 1fr));
            gap:24px;
          }
          @media (max-width: 1024px){
            .cards-3{ grid-template-columns:repeat(2, minmax(0, 1fr)); }
          }
          @media (max-width: 640px){
            .cards-3{ grid-template-columns:1fr; }
          }
        `}</style>
      </section>

      <DoctorBookingSection />

      {/* Cơ sở yêu thích */}
      <FacilitySection />

      {/* Chuyên khoa */}
      <section className="container">
        <h2 className="section__title">CHUYÊN KHOA</h2>

        <div className="spec-grid spec-grid-6">
          {loading
            ? Array.from({ length: 12 }).map((_, i) => <div key={i} className="spec skeleton" />)
            : (expanded ? specs : specs.slice(0, 12)).map((it) => (
              <SpecialtyItem key={it.id} item={it} />
            ))}
        </div>

        {!loading && specs.length > 12 && (
          <div className="see-all-wrap">
            <button
              type="button"
              className="see-all-btn"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Thu gọn ▲" : "Xem tất cả ▼"}
            </button>
          </div>
        )}
      </section>
      {/*Hiển thị tin tức*/}
      <ListNews />

      <AssistantButton />
    </main>
  );
}
