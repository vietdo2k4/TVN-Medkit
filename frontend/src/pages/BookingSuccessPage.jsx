// src/pages/BookingSuccessPage.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppointmentDetail from "../components/AppointmentDetail";
import "../styles/booking-success.css";

export default function BookingSuccess() {
  const { id } = useParams();
  const nav = useNavigate();
  //State: Dữ liệu lịch hẹn vừa đặt
  const [data, setData] = useState(null);

  //Gọi API lấy chi tiết lịch hẹn vừa tạo
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || !id) return;
    (async () => {
      const r = await fetch(`${import.meta.env.VITE_API_BASE_URL}/me/appointments/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const ap = await r.json();
      setData(ap);
    })();
  }, [id]);

  //Lấy giá khám từ sessionStorage (đã lưu ở CheckoutPage)
  const totalVnd = useMemo(() => {
    const s = sessionStorage.getItem(`fee:${id}`);
    return s ? Number(s) : 0;
  }, [id]);


  if (!id) return null;

  return (
    <main className="container bs-wrap">
      <section className="bs-card">
        <div className="bs-hero">
          <div className="bs-check">✓</div>
          <div>
            <h1 className="bs-title">Đặt lịch thành công</h1>
            <p className="bs-sub">
              Bạn có thể xem Danh sách phiếu khám <Link to="/me/appointments" className="bs-link">tại đây</Link>.
            </p>
          </div>
        </div>

        <div className="bs-detail">
          <AppointmentDetail
            embedded
            code={`TVN-${String(id).padStart(6, "0")}`}
            date={data?.date}
            time={data?.time}
            doctorName={data?.doctor_name}
            hospitalName={data?.hospital_name}
            specialty={data?.specialty_name || data?.specialty || sessionStorage.getItem(`sp:${id}`) || "—"}
            serviceName={data?.service_name}
            patientName={data?.patient_name || localStorage.getItem("displayName") || ""}
            symptoms_note={data?.symptoms_note || ""}
            totalVnd={totalVnd}
            status={data?.status}
            paymentStatus={data?.payment_status}
          />
        </div>

        <div className="bs-actions">
          <Link to="/me/appointments" className="btn">Xem phiếu khám</Link>
          <button className="btn ghost" onClick={() => nav("/")}>Về trang chủ</button>
        </div>
      </section>
    </main>
  );
}
