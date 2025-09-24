import { Link } from "react-router-dom";

export default function LoginPage(){
  return (
    <main className="auth">
      <div className="auth__card">
        <h2>Đăng nhập</h2>
        <label className="label">Email / Tài khoản</label>
        <input className="input" placeholder="email@example.com" />
        <label className="label">Mật khẩu</label>
        <input type="password" className="input" placeholder="••••••" />
        <button className="btn btn--primary w-100">Đăng nhập</button>
        <p className="tiny">Chưa có tài khoản? <Link to="/register">Đăng ký</Link></p>
      </div>
    </main>
  );
}
