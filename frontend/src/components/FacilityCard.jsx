/**
 * Thẻ cơ sở y tế. Ảnh/logo lấy từ /public/assets nếu có.
 * Hành động chính: "Đặt khám ngay" (hiện chưa gắn route cụ thể).
 */
export default function FacilityCard({ name, address, logoSrc = "/assets/images/facility-default.png" }) {
  return (
    <div className="facility">
      <img className="facility__logo" src={logoSrc} alt="" />
      <div className="facility__name">{name}</div>
      <div className="muted">{address}</div>
      <div className="stars" aria-label="Đánh giá 4/5">★★★★☆</div>
      <button className="btn btn--primary w-100">Đặt khám ngay</button>
    </div>
  );
}
