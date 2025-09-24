export default function SpecialtyItem({ label }) {
  return (
    <button className="spec">
      <div className="spec__icon">🧿</div>
      <div className="spec__name">{label}</div>
    </button>
  );
}
