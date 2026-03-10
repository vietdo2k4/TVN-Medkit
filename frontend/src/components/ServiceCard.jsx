// Button-card có thể bấm, dùng Link để điều hướng
import { Link } from "react-router-dom";

/**
 * ServiceCard dạng button:
 *  - to: đường dẫn khi bấm
 *  - icon/title/desc: nội dung hiển thị
 */
export default function ServiceCard({ to, icon, title, desc }) {
  return (
    <Link to={to} className="card card--action" role="button" aria-label={title}>
      <div className="card__icon" aria-hidden>{icon}</div>
      <div className="card__title">{title}</div>
      <div className="muted">{desc}</div>
    </Link>
  );
}
