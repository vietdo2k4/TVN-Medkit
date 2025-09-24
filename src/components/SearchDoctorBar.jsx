export default function SearchDoctorBar({ onSubmit }) {
  return (
    <div className="searchbar__inner">
      <div className="searchbar__field"><span>🔎</span><input placeholder="Chuyên khoa, bác sĩ, cơ sở" /></div>
      <div className="searchbar__field"><span>📍</span><input placeholder="TP. Hồ Chí Minh" /></div>
      <div className="searchbar__field"><span>🗓️</span><input placeholder="Hôm nay / Mai" /></div>
      <button className="btn btn--primary" onClick={onSubmit}>Tìm bác sĩ</button>
    </div>
  );
}
