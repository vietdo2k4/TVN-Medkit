import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DoctorCard from "../components/DoctorCard";
import { mockDoctors } from "../data/mockData";

export default function DoctorsPage(){
  const [spec,setSpec]=useState("");
  const filtered=useMemo(()=>mockDoctors.filter(d=>!spec||d.specialty===spec),[spec]);
  const nav=useNavigate();
  return (
    <main className="container pv">
      <div className="layout">
        <aside className="aside">
          <div className="aside__title">Bộ lọc</div>
          <label className="label">Chuyên khoa</label>
          <select className="input" value={spec} onChange={e=>setSpec(e.target.value)}>
            <option value="">Tất cả</option>
            <option>Nội tổng quát</option><option>Nhi</option><option>Sản</option><option>Tim mạch</option>
          </select>
          <label className="label">Khung giờ</label>
          <select className="input"><option>Tất cả</option><option>Buổi sáng</option><option>Buổi chiều</option></select>
          <label className="label">Giá</label>
          <select className="input"><option>Tất cả</option><option>{"< 300k"}</option><option>300k–500k</option><option>{"> 500k"}</option></select>
        </aside>
        <section className="content">
          <h2 className="section__title">Bác sĩ / Cơ sở</h2>
          {filtered.map(d=>(
            <DoctorCard key={d.id} doctor={d} onDetail={()=>nav(`/doctor/${d.id}`)} />
          ))}
        </section>
      </div>
    </main>
  );
}
