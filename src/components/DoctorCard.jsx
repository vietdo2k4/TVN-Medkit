export default function DoctorCard({ doctor, onDetail }) {
  return (
    <div className="row">
      <img className="avatar" src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${doctor.id}`} alt={doctor.name}/>
      <div className="row__main">
        <div className="row__title">{doctor.name} <span className="pill">{doctor.specialty}</span></div>
        <div className="muted">{doctor.hospital} • ⭐ {doctor.rating}</div>
      </div>
      <button className="btn btn--primary" onClick={onDetail}>Xem chi tiết</button>
    </div>
  );
}
