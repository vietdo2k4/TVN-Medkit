import { useNavigate } from "react-router-dom";
import SearchDoctorBar from "../components/SearchDoctorBar";
import ServiceCard from "../components/ServiceCard";
import FacilityCard from "../components/FacilityCard";
import SpecialtyItem from "../components/SpecialtyItem";
import { specialties } from "../data/mockData";

export default function HomePage() {
  const nav = useNavigate();
  return (
    <main>
      {/* Hero clone phong cách Medpro */}
      <section className="hero">
        <div className="hero__banner">
          <div className="hero__content">
            <h1>Kết nối Người Dân với Cơ sở & Dịch vụ Y tế hàng đầu</h1>
            <div className="hero__search"><SearchDoctorBar onSubmit={()=>nav("/doctors")} /></div>
            <ul className="hero__features">
              <li>✔️ Đặt khám nhanh - lấy số thứ tự trực tuyến</li>
              <li>✔️ Đặt khám theo giờ - đặt sớm có số thứ tự thấp</li>
              <li>✔️ Hoàn tiền khi hủy khám</li>
            </ul>
          </div>
          <div className="hero__image" aria-hidden>
            <img src="https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1400&auto=format&fit=crop" alt="Doctor banner"/>
          </div>
        </div>
      </section>

      <section className="container cards-4">
        <ServiceCard icon="📅" title="Đặt khám tại cơ sở" desc="Đặt lịch nhanh chóng" />
        <ServiceCard icon="🎥" title="Tư vấn video" desc="Gặp bác sĩ trực tuyến" />
        <ServiceCard icon="💊" title="Mua thuốc" desc="Liên kết nhà thuốc" />
        <ServiceCard icon="👤" title="Hồ sơ cá nhân" desc="Quản lý hồ sơ y tế" />
      </section>

      <section className="container">
        <h2 className="section__title">Chuyên khoa</h2>
        <div className="spec-grid">
          {specialties.map((s,i)=><SpecialtyItem key={i} label={s} />)}
        </div>
      </section>

      <section className="container">
        <h2 className="section__title">Cơ sở y tế được yêu thích</h2>
        <div className="grid-4">
          {[1,2,3,4].map(i=>(
            <FacilityCard key={i} name={`Bệnh viện/Phòng khám ${i}`} address={`Quận ${i}, TP. Hồ Chí Minh`} />
          ))}
        </div>
      </section>
    </main>
  );
}
