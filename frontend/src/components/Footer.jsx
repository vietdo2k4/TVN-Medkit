import { Link } from "react-router-dom";
import "../styles/footer.css";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="container footer__grid">
        {/* Brand / Mission */}
        <div className="footer__brand">
          <Link to="/" className="footer__logo">🩺 TVN Medkit</Link>
          <p className="footer__muted">Nền tảng đặt lịch khám – nhận phiếu điện tử.</p>
          <p className="footer__muted">Đơn giản • Nhanh chóng • Minh bạch</p>
        </div>

        {/* Medical Services */}
        <nav className="footer__col" aria-label="Dịch vụ y tế">
          <h3 className="footer__title">Dịch vụ y tế</h3>
          <ul className="footer__list">
            <li><Link to="/doctors?mode=by-doctor">Đặt khám theo bác sĩ</Link></li>
            <li><Link to="/hospitals">Đặt khám theo cơ sở  y tế</Link></li>
          </ul>
        </nav>

        {/* Contact / Socials */}
        <div className="footer__col" aria-label="Liên hệ">
          <h3 className="footer__title">Liên hệ</h3>
          <ul className="footer__list">
            <li>Hotline: 1900 1918</li>
            <li>TP. Hồ Chí Minh</li>
          </ul>
          <div className="footer__socials">
            <a
              className="footer__social"
              href="https://zalo.me/"
              target="_blank"
              rel="noopener"
              aria-label="Zalo"
              title="Zalo"
            >
              {/* Zalo mini icon */}
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor" /><text x="12" y="16" textAnchor="middle" fontSize="10" fill="#fff" fontWeight="700">Z</text></svg>
            </a>
            <a
              className="footer__social"
              href="https://www.facebook.com/vietdo2k4"
              target="_blank"
              rel="noopener"
              aria-label="Facebook"
              title="Facebook"
            >
              {/* Facebook mini icon */}
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor" /><path d="M13.2 8.5h1.9V6.1h-1.9c-2 0-3.3 1.2-3.3 3.2v1.4H8.8v2.4h1.1v4h2.5v-4h1.9l.4-2.4h-2.3V9.5c0-.7.3-1 1-1z" fill="#fff" /></svg>
            </a>
          </div>
        </div>

        {/* Policies */}
        <nav className="footer__col" aria-label="Chính sách">
          <h3 className="footer__title">Chính sách</h3>
          <ul className="footer__list">
            <li><Link to="/policy/privacy">Bảo mật dữ liệu</Link></li>
            <li><Link to="/policy/terms">Điều khoản sử dụng</Link></li>
          </ul>
        </nav>
      </div>

      <div className="footer__bottom">
        <div className=" center container footer__bottom-inner">
          <span>© {year} TVN Medkit</span>
          <span className="footer__sep">•</span>
          <span>All rights reserved</span>
        </div>
      </div>
    </footer>
  );
}
