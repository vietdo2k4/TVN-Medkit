import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/spec-tooltips.css";

export default function SpecialtyItem({ item, onClick }) {
  const [hover, setHover] = useState(false);
  const nav = useNavigate();

  // Ưu tiên id -> slug -> name
  const goToDoctors = (spec) => {
    const key = spec?.id ?? spec?.slug ?? spec?.name ?? "";
    nav(`/doctors?specialty=${encodeURIComponent(String(key))}`);
  };

  const handleClick = () => {
    if (typeof onClick === "function") return onClick(item);
    goToDoctors(item);
  };

  return (
    <button
      type="button"
      className="spec-card"
      onClick={handleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={item?.name || "Chuyên khoa"}
      data-spec={item?.id || item?.slug || item?.name}
    >
      <div className="spec-card__icon">
        {item?.icon_path
          ? <img src={item.icon_path} alt="" />
          : <span className="spec-card__placeholder">🩺</span>}
      </div>
      <div className="spec-card__name">{item?.name || "—"}</div>

      {/* Tooltip mô tả */}
      <div className={`spec-tip spec-tip--brand ${hover ? "is-visible" : ""}`}>
        <div className="spec-tip__title">{item?.name}</div>
        <div className="spec-tip__body">
          {item?.description?.trim() || "Chưa có mô tả."}
        </div>
      </div>
    </button>
  );
}
