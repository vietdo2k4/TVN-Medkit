export default function StepPayment({ value, onChange, onNext, onBack }) {
    const opts = [
        { id: "momo", label: "MoMo" },
        { id: "vnpay", label: "VNPay" },
        { id: "card", label: "Thẻ ngân hàng" },
        { id: "cash", label: "Thanh toán tại cơ sở" },
    ];
    return (
        <div className="step">
            <h3>Chọn phương thức thanh toán</h3>
            <div className="list">
                {opts.map(o => (
                    <label key={o.id} className={"radio" + (value === o.id ? " active" : "")}>
                        <input type="radio" name="pm" value={o.id}
                            checked={value === o.id} onChange={() => onChange(o.id)} />
                        <span>{o.label}</span>
                    </label>
                ))}
            </div>
            <div className="actions">
                <button className="btn" onClick={onBack}>Quay lại</button>
                <button className="btn btn--primary" onClick={onNext} disabled={!value}>Tiếp tục</button>
            </div>
        </div>
    );
}
