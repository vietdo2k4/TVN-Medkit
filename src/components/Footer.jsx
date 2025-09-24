export default function Footer(){
  return (
    <footer className="footer">
      <div className="container grid-3">
        <div>
          <div className="foot__title">TVN Medkit</div>
          <p className="muted">Đặt lịch khám, tư vấn video, nhận phiếu điện tử.</p>
        </div>
        <div>
          <div className="foot__title">Liên hệ</div>
          <p className="muted">Hotline: 1900 2115</p>
          <p className="muted">TP. Hồ Chí Minh</p>
        </div>
        <div>
          <div className="foot__title">Chính sách</div>
          <ul className="list">
            <li>Bảo mật dữ liệu</li>
            <li>Điều khoản sử dụng</li>
            <li>Quy định hoàn tiền</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
