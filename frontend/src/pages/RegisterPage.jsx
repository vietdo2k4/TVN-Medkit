import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/register.css";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [full_name, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password.length < 6) return setError("Mật khẩu tối thiểu 6 ký tự");
    if (password !== confirm) return setError("Mật khẩu không khớp");

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.message || "Đăng ký thất bại");

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      navigate("/");
    } catch {
      setError("Lỗi kết nối server");
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-wrapper">
        <div className="auth-left">
          <h2 className="auth-title">Tạo tài khoản TVN Medkit</h2>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="label">Họ và tên</label>
            <input
              className="input"
              value={full_name}
              onChange={(e) => setFullName(e.target.value)}
              required
            />

            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label className="label">Mật khẩu</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />

            <label className="label">Nhập lại mật khẩu</label>
            <input
              type="password"
              className="input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
            />

            {error && <p className="error">{error}</p>}

            <button className="btn btn--primary w-100" type="submit">
              Đăng ký
            </button>

            <p className="tiny">
              Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
            </p>
          </form>
        </div>

        <div className="auth-right">
          <img src="/assets/images/heroBG.png" alt="Register" />
          <p className="auth-slogan">
            “Không còn xếp hàng – Chỉ cần vài phút để bắt đầu hành trình chăm sóc sức khỏe!”
          </p>
        </div>
      </div>
    </main>
  );
}
