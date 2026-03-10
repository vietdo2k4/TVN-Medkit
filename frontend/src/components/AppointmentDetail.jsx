import "../styles/appointment-detail.css";

//Map trạng thái sang nhãn hiển thị
const LABEL = {
    paid: "Đã thanh toán",
    unpaid: "Chưa thanh toán",
    pending: "Chờ xác nhận",
    confirmed: "Đã xác nhận",
    completed: "Đã khám",
    cancelled: "Đã hủy",
};

//Helper: Hiển thị giá trị hoặc "—" nếu rỗng
const v = (x) => (x === 0 ? "0" : (x ?? "").toString().trim() ? x : "—");

//Helper: Format ngày từ "YYYY-MM-DD" sang "DD-MM-YYYY"
function fmtDay(input) {
    const s = String(input || "").slice(0, 10);
    const [yyyy, mm, dd] = s.split("-");
    if (!yyyy || !mm || !dd) return "—";
    return `${dd.padStart(2, "0")}-${mm.padStart(2, "0")}-${yyyy}`;
}
//Component hiển thị chi tiết phiếu khám (dùng chung cho user view và success page)
export default function AppointmentDetail({
    code,
    doctorName,
    hospitalName,
    date,
    time,
    specialty,
    // serviceName,
    patientName,
    symptoms_note,
    cancel_reason,
    totalVnd,
    status,
    paymentStatus,
    embedded = false,
}) {
    const stt = String(status || "").toLowerCase();
    const pay = String(paymentStatus || "").toLowerCase();


    return (
        <section className={`apd-card ${embedded ? "apd-embed" : ""}`}>
            <div className="apd-rows">
                <div className="apd-row"><div className="apd-key">Bác sĩ</div><div className="apd-val">{v(doctorName)}</div></div>
                <div className="apd-row"><div className="apd-key">Cơ sở</div><div className="apd-val">{v(hospitalName)}</div></div>

                <div className="apd-row"><div className="apd-key">Ngày khám</div><div className="apd-val">{fmtDay(date)}</div></div>
                <div className="apd-row"><div className="apd-key">Thời gian</div><div className="apd-val">{v(time)}</div></div>

                <div className="apd-row"><div className="apd-key">Chuyên khoa</div><div className="apd-val">{v(specialty)}</div></div>
                {/* <div className="apd-row"><div className="apd-key">Dịch vụ</div><div className="apd-val">{v(serviceName)}</div></div> */}

                <div className="apd-row"><div className="apd-key">Bệnh nhân</div><div className="apd-val">{v(patientName)}</div></div>
                <div className="apd-row"><div className="apd-key">Trạng thái phiếu</div><div className={"apd-chip " + (stt || "neutral")}>{LABEL[stt] || "—"}</div></div>

                <div className="apd-row apd-row--span">
                    <div className="apd-key">Lí do khám</div>
                    <div className="apd-val">{v(symptoms_note)}</div>
                </div>

                {String(status || "").toLowerCase() === "cancelled" && (
                    <div className="apd-row apd-row--span">
                        <div className="apd-key">Lý do hủy</div>
                        <div className="apd-val">{(cancel_reason ?? "—") || "—"}</div>
                    </div>
                )}

                <div className="apd-sep" />

                <div className="apd-row"><div className="apd-key">Trạng thái thanh toán</div><div className={"apd-chip " + (pay || "neutral")}>{LABEL[pay] || "—"}</div></div>
                <div className="apd-row apd-row--total">
                    <div className="apd-key">Tổng tiền</div>
                    <div className="apd-val apd-price">{Number(totalVnd ?? 0).toLocaleString("vi-VN")} VND</div>
                </div>

                <div className="apd-row apd-row--code">
                    <div className="apd-key">Mã đặt lịch</div>
                    <div className="apd-val apd-code">{v(code)}</div>
                </div>
            </div>
        </section>
    );
}
