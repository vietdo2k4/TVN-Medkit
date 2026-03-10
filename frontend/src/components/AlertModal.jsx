import "../styles/modal.css";

export default function AlertModal({
  open,
  title = "Thông báo",
  message,
  actions,
  onClose,
}) {
  if (!open) return null;
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card" role="document">
        <div className="modal-header">{title}</div>
        <div className="modal-body">{message}</div>
        <div className="modal-actions">
          {Array.isArray(actions) && actions.length > 0 ? (
            actions.map((a, i) => (
              <button
                key={i}
                type="button"
                className={a.variant || "btn btn-primary"}
                onClick={a.onClick}
                autoFocus={i === 0}
              >
                {a.label}
              </button>
            ))
          ) : (
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Đóng
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
