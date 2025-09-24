import { Link } from "react-router-dom";

export default function RegisterPage(){
  return (
    <main className="auth">
      <div className="auth__card">
        <h2>Đăng ký</h2>
        <label className="label">Họ tên</label>
        <input className="input" placeholder="Nguyễn Văn A" />
        <label className="label">Số điện thoại</label>
        <input className="input" placeholder="09xx xxx xxx" />
        <label className="label">Email</label>
        <input className="input" placeholder="email@example.com" />
        <label className="label">Mật khẩu</label>
        <input type="password" className="input" placeholder="••••••" />
        <button className="btn btn--primary w-100">Đăng ký</button>
        <p className="tiny">Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>
      </div>
    </main>
  );
}
