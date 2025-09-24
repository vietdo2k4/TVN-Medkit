export default function FacilityCard({ name, address }) {
  return (
    <div className="facility">
      <div className="facility__logo">🏥</div>
      <div className="facility__name">{name}</div>
      <div className="muted">{address}</div>
      <div className="stars">★★★★☆</div>
      <button className="btn btn--primary w-100">Đặt khám ngay</button>
    </div>
  );
}
