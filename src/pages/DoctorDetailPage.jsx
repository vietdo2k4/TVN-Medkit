import { useLocation, useNavigate } from "react-router-dom";
import { mockDoctors, slots } from "../data/mockData";

export default function DoctorDetailPage(){
  const id=(useLocation().pathname.split("/")[2])||"1";
  const d=mockDoctors.find(x=>String(x.id)===String(id))||mockDoctors[0];
  const nav=useNavigate();

  return (
    <main className="container pv">
      <div className="row row--card">
        <img className="avatar avatar--lg" src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${d.id}`} alt={d.name}/>
        <div className="row__main">
          <div className="row__title">{d.name} <span className="pill">{d.specialty}</span></div>
          <div className="muted">{d.hospital} • ⭐ 4.7</div>
        </div>
      </div>

      <div className="card pv">
        <div className="card__title">Chọn khung giờ hôm nay</div>
        <div className="slots">
          {slots.map(s => <button key={s} className="slot" onClick={()=>nav(`/booking?doctor=${d.id}&time=${s}`)}>{s}</button>)}
        </div>
      </div>

      <div className="card">
        <div className="card__title">Thông tin</div>
        <ul className="list"><li>Kinh nghiệm 8+ năm</li><li>Lịch: Th2–Th7, 08:00–11:00; 14:00–16:30</li><li>Giá: 300k–500k</li></ul>
      </div>
    </main>
  );
}
