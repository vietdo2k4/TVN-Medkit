import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const { pathname } = useLocation();
  const Item = ({ to, label }) => (
    <Link className={"nav__item" + (pathname === to ? " is-active" : "")} to={to}>
      {label}
    </Link>
  );
  return (
    <header className="nav">
      <div className="container nav__inner">
        <Link to="/" className="brand">🩺 TVN Medkit</Link>
        <nav className="nav__menu">
          <Item to="/" label="Trang chủ" />
          <Item to="/doctors" label="Bác sĩ/CSYT" />
          <Item to="/telemedicine" label="Telemedicine" />
          <Item to="/login" label="Đăng nhập" />
        </nav>
      </div>
    </header>
  );
}
