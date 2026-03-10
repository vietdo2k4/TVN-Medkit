import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getUnreadCount } from "../api/notifications";
import "../styles/navbar.css";

function NavIcon(name) {
  if (name === "calendar") {
    return (
      <svg className="nav__dd-ic" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 2h2v2h6V2h2v2h3a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3V2zm13 8H4v10h16V10z" />
      </svg>
    );
  }
  if (name === "bell") {
    return (
      <svg className="nav__dd-ic" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6V11a6 6 0 1 0-12 0v5L4 18v1h16v-1l-2-2z" />
      </svg>
    );
  }
  if (name === "logout") {
    return (
      <svg className="nav__dd-ic" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4v-2H6V6h4V4zm9.707 7.293-3-3-1.414 1.414L17.586 11H11v2h6.586l-2.293 2.293 1.414 1.414 3-3a1 1 0 0 0 0-1.414z" />
      </svg>
    );
  }
  return (
    <svg className="nav__dd-ic" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm-7 9a7 7 0 0 1 14 0H5z" />
    </svg>
  );
}

export default function Navbar() {
  const { pathname } = useLocation();
  const nav = useNavigate();

  const user = (() => {
    try { return JSON.parse(localStorage.getItem("user") || "null"); }
    catch { return null; }
  })();

  const [name, setName] = useState(localStorage.getItem("displayName") || "Người dùng");

  // dropdown states
  const [openUser, setOpenUser] = useState(false);
  const [openMenu, setOpenMenu] = useState(null); // 'svc' | 'news' | 'help' | null

  // refs for outside-click
  const userBoxRef = useRef(null);
  const svcRef = useRef(null);
  const newsRef = useRef(null);
  const helpRef = useRef(null);

  // notifications
  const [notiCount, setNotiCount] = useState(0);
  const prevCount = useRef(0);
  const [toast, setToast] = useState("");

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  // unread counter polling
  useEffect(() => {
    let stop = false;
    async function tick() {
      const token = localStorage.getItem("token");
      if (!token) { prevCount.current = 0; setNotiCount(0); return; }
      try {
        const c = await getUnreadCount();
        const next = c.unread || 0;
        if (!stop) {
          if (next > prevCount.current) showToast(`Bạn có ${next - prevCount.current} thông báo mới`);
          prevCount.current = next;
          setNotiCount(next);
        }
      } catch { if (!stop) setNotiCount(0); }
    }
    tick();
    const id = setInterval(tick, 60000);
    const onChanged = () => tick();
    window.addEventListener("tvn-noti-changed", onChanged);
    return () => { stop = true; clearInterval(id); window.removeEventListener("tvn-noti-changed", onChanged); };
  }, [user]);

  // close all on route change
  useEffect(() => { setOpenUser(false); setOpenMenu(null); }, [pathname]);

  // close on outside click or ESC (ổn định dropdown)
  useEffect(() => {
    const onDown = (e) => {
      if (
        !userBoxRef.current?.contains(e.target) &&
        !svcRef.current?.contains(e.target) &&
        !newsRef.current?.contains(e.target) &&
        !helpRef.current?.contains(e.target)
      ) {
        setOpenUser(false);
        setOpenMenu(null);
      }
    };
    const onKey = (e) => e.key === "Escape" && (setOpenUser(false), setOpenMenu(null));
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, []);

  // keep display name in sync
  useEffect(() => { setName(localStorage.getItem("displayName") || "Người dùng"); }, [pathname, user]);
  useEffect(() => {
    const onAuth = () => setName(localStorage.getItem("displayName") || "Người dùng");
    window.addEventListener("tvn-auth-changed", onAuth);
    return () => window.removeEventListener("tvn-auth-changed", onAuth);
  }, []);
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!user || !token) return;
    if (localStorage.getItem("displayName")) return;
    fetch(`${import.meta.env.VITE_API_BASE_URL}/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(me => {
        const displayName = me?.profile?.full_name || "Người dùng";
        localStorage.setItem("displayName", displayName);
        setName(displayName);
      })
      .catch(() => { });
  }, [user]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("displayName");
    setNotiCount(0);
    window.dispatchEvent(new Event("tvn-auth-changed"));
    nav("/login");
  };

  const Item = ({ to, label }) => (
    <Link className="nav__item" to={to} onMouseDown={(e) => e.currentTarget.blur()}>
      {label}
    </Link>
  );

  return (
    <header className="nav">
      <div className="container nav__inner">
        <Link to="/" className="nav__brand">🩺TVN Medkit</Link>

        <nav className="nav__menu">
          <Item to="/" label="Trang chủ" />

          {/* Dịch vụ y tế */}
          <div ref={svcRef} className={"nav__group" + (openMenu === "svc" ? " open" : "")}>
            <button
              type="button"
              className="nav__item nav__has-dd"
              aria-haspopup="menu"
              aria-expanded={openMenu === "svc"}
              onClick={() => setOpenMenu(openMenu === "svc" ? null : "svc")}
            >
              Dịch vụ y tế<span className="nav__caret">▾</span>
            </button>
            <div className="nav__menu-dd" role="menu">
              <div className="nav__dd-links">
                <Link className="nav__dd-link" to="/doctors?mode=by-doctor" onClick={() => setOpenMenu(null)}>
                  Đặt khám theo bác sĩ
                </Link>
                <Link className="nav__dd-link" to="/hospitals" onClick={() => setOpenMenu(null)}>
                  Đặt khám theo cơ sở y tế
                </Link>
              </div>
            </div>
          </div>

          {/* Tin tức y khoa */}
          <div ref={newsRef} className={"nav__group" + (openMenu === "news" ? " open" : "")}>
            <button
              type="button"
              className="nav__item nav__has-dd"
              aria-haspopup="menu"
              aria-expanded={openMenu === "news"}
              onClick={() => setOpenMenu(openMenu === "news" ? null : "news")}
            >
              Tin tức y khoa<span className="nav__caret">▾</span>
            </button>
            <div className="nav__menu-dd" role="menu">
              <div className="nav__dd-links">
                <Link className="nav__dd-link" to="/news/service" onClick={() => setOpenMenu(null)}>
                  Tin dịch vụ
                </Link>
                <Link className="nav__dd-link" to="/news/domestic" onClick={() => setOpenMenu(null)}>
                  Tin y tế trong nước
                </Link>
                <Link className="nav__dd-link" to="/news/world" onClick={() => setOpenMenu(null)}>
                  Tin y tế thế giới
                </Link>
              </div>
            </div>
          </div>

          {/* Hướng dẫn */}
          <div ref={helpRef} className={"nav__group" + (openMenu === "help" ? " open" : "")}>
            <button
              type="button"
              className="nav__item nav__has-dd"
              aria-haspopup="menu"
              aria-expanded={openMenu === "help"}
              onClick={() => setOpenMenu(openMenu === "help" ? null : "help")}
            >
              Hướng dẫn<span className="nav__caret">▾</span>
            </button>
            <div className="nav__menu-dd" role="menu">
              <div className="nav__dd-links">
                <Link className="nav__dd-link" to="/tutorial?t=booking" onClick={() => setOpenMenu(null)}>
                  Hướng dẫn đặt lịch
                </Link>
                <div className="nav__dd-sep"></div>
                <Link className="nav__dd-link" to="/tutorial?t=ai" onClick={() => setOpenMenu(null)}>
                  Hướng dẫn sử dụng chatbot AI
                </Link>
              </div>
            </div>
          </div>

          {/* Chuông thông báo */}
          {user && (
            <button
              type="button"
              className="nav__bell"
              onClick={() => nav("/me/notifications")}
              aria-label="Thông báo"
              title="Thông báo"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6V11a6 6 0 1 0-12 0v5L4 18v1h16v-1l-2-2z" />
              </svg>
              {notiCount > 0 && <span className="nav__bell-badge">{notiCount > 99 ? "99+" : notiCount}</span>}
            </button>
          )}

          {/* Dropdown tài khoản */}
          {!user ? (
            <Item to="/login" label="Đăng nhập" />
          ) : (
            <div ref={userBoxRef} className={"nav__user" + (openUser ? " open" : "")}>
              <button
                type="button"
                className="nav__user-btn nav__user-btn--outline"
                aria-haspopup="menu"
                aria-expanded={openUser ? "true" : "false"}
                onClick={async () => {
                  const next = !openUser;
                  setOpenUser(next);
                  if (next) {
                    try {
                      const c = await getUnreadCount();
                      prevCount.current = c.unread || 0;
                      setNotiCount(c.unread || 0);
                    } catch { setNotiCount(0); }
                  }
                }}
              >
                <svg className="nav__user-ic" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm-7 9a7 7 0 0 1 14 0H5z" />
                </svg>
                <span className="name">{name}</span>
                <span className="caret" aria-hidden>▾</span>
              </button>

              <div className="nav__dropdown" role="menu">
                <div className="nav__dd-hd">
                  <div className="nav__dd-avatar">👤</div>
                  <div>
                    <div className="nav__dd-hi">Xin chào,</div>
                    <Link to="/me" className="nav__dd-name" onClick={() => setOpenUser(false)}>{name}</Link>
                  </div>
                </div>

                <div className="nav__dd-list">
                  <Link to="/me" className="nav__dd-item" onClick={() => setOpenUser(false)}>
                    {NavIcon("user")} <span>Hồ sơ bệnh nhân</span>
                  </Link>
                  <Link to="/me/appointments" className="nav__dd-item" onClick={() => setOpenUser(false)}>
                    {NavIcon("calendar")} <span>Phiếu khám bệnh</span>
                  </Link>
                  <Link to="/me/notifications" className="nav__dd-item" onClick={() => setOpenUser(false)}>
                    {NavIcon("bell")} <span>Thông báo</span>
                    {notiCount > 0 && <span className="nav__dd-meta">{notiCount > 99 ? "99+" : notiCount}</span>}
                  </Link>

                  <div className="nav__dd-divider"></div>
                  <button onClick={() => { setOpenUser(false); logout(); }} className="nav__dd-item danger">
                    {NavIcon("logout")} <span>Đăng xuất</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </nav>
      </div>

      {toast && <div className="nav__toast">{toast}</div>}
    </header>
  );
}
