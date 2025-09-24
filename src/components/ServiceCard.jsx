export default function ServiceCard({ icon, title, desc }) {
  return (
    <div className="card">
      <div className="card__icon">{icon}</div>
      <div className="card__title">{title}</div>
      <div className="muted">{desc}</div>
    </div>
  );
}
