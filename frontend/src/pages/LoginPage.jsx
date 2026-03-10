import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/login.css";

//Helper: Tím role từ phản hồi API (có thể nằm trong data.user.role hoặc trong JWT token)
function getRoleFrom(data) {
  if (data?.user?.role) return data.user.role;
  try {
    const payload = JSON.parse(atob(String(data?.token || "").split(".")[1]));
    return payload?.role || null;
  } catch { return null; }
}

export default function LoginPage() {
  const nav = useNavigate();

  //useState: Lưu email người dùng nhập - bind 2 chiều với input email
  const [email, setEmail] = useState("");

  //useState: Lưu mật khẩu người dùng nhập - bind 2 chiều với input password
  const [password, setPassword] = useState("");

  //useState: Lưu thông báo lỗi khi đăng nhập thất bại (sai email/password, lỗi server...)
  const [error, setError] = useState("");

  //useState: Đánh dấu đang xử lý request login - dùng để disable button và hiển thị "Đang xử lý..."
  const [loading, setLoading] = useState(false);

  //Hàm xử lý khi submit form đăng nhập
  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      //Gọi API đăng nhập
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoading(false);
        return setError(data.message || "Đăng nhập thất bại");
      }

      // lưu token + user vào localStorage
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user || {}));
      localStorage.removeItem("displayName");
      window.dispatchEvent(new Event("tvn-auth-changed"));

      const role = getRoleFrom(data); // "doctor" | "admin" | "patient" | null

      // đặt displayName theo role (lấy từ server)
      (async () => {
        try {
          const API = import.meta.env.VITE_API_BASE_URL;
          let displayName = "Người dùng";
          if (role === "doctor") {
            const r = await fetch(`${API}/doctor/me`, {
              headers: { Authorization: `Bearer ${data.token}` },
            });
            const d = r.ok ? await r.json() : null;
            displayName = d?.doctor?.full_name || "Bác sĩ";
          } else {
            const r = await fetch(`${API}/me`, {
              headers: { Authorization: `Bearer ${data.token}` },
            });
            const me = r.ok ? await r.json() : null;
            displayName = me?.profile?.full_name || "Người dùng";
          }
          localStorage.setItem("displayName", displayName);
          window.dispatchEvent(new Event("tvn-auth-changed"));
          // eslint-disable-next-line no-empty
        } catch { }
      })();

      // điều hướng theo role (admin/doctor đi vào trang quản lý riêng, patient về trang chủ)
      if (role === "doctor") nav("/doctor");
      else if (role === "admin") nav("/admin");
      else nav("/");
    } catch {
      setError("Lỗi kết nối server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-wrapper">
        <div className="auth-left">
          <h2 className="auth-title">Đăng nhập TVN Medkit</h2>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label className="label">Mật khẩu</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && <p className="error">{error}</p>}

            <button className="btn btn--primary w-100" type="submit" disabled={loading}>
              {loading ? "Đang xử lý..." : "Đăng nhập"}
            </button>

            <p className="tiny">
              Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
            </p>
          </form>
        </div>

        <div className="auth-right">
          <img src="/assets/images/heroBG.png" alt="Login" />
          <p className="auth-slogan">“Không còn xếp hàng – Chỉ cần vài phút để bắt đầu hành trình chăm sóc sức khỏe!”</p>
        </div>
      </div>
    </main>
  );
}
