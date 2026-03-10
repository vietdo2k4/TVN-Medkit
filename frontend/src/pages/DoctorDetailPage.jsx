/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getDoctor, getAvailableDays, getSlots } from "../api/doctor";
import StepSelectTime from "../components/booking/StepSelectTime";
import "../styles/doctor-detail.css";
import "../styles/checkout.css";

export default function DoctorDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();

  //useState: Lưu thông tin chi tiết bác sĩ (full_name, specialty, bio, avatar, fee...)
  const [doctor, setDoctor] = useState(null);

  //useState: Danh sách các ngày có lịch khám (array of "YYYY-MM-DD") - không dùng nhiều nhưng giữ để tương thích
  const [days, setDays] = useState([]);

  //useState: Ngày được chọn để xem slots - format "YYYY-MM-DD" (GMT+7)
  const [selectedDate, setSelectedDate] = useState("");

  //useState: Danh sách khung giờ khám trong ngày đã chọn - array of {scheduleId, time, session, booked}
  const [slots, setSlots] = useState([]);

  //useState: Khung giờ được chọn để đặt lịch - object {scheduleId, time, session}
  const [selectedSlot, setSelectedSlot] = useState(null);

  //useRef: Lưu ID của interval polling - dùng để clear interval khi component unmount hoặc ngày thay đổi
  //Tránh memory leak và multiple intervals chạy cùng lúc
  const pollRef = useRef(null);

  //useMemo: Tính ngày hôm nay theo format "YYYY-MM-DD" (GMT+7) - chỉ tính 1 lần khi component mount
  //Dependencies: [] - không đổi trong suốt lifecycle của component
  const todayISO = useMemo(() => new Date().toLocaleDateString("en-CA"), []);

  //useMemo: Tính ngày tối đa có thể đặt lịch (60 ngày kể từ hôm nay)
  //Dependencies: [] - chỉ tính 1 lần, không cần recalculate
  const maxISO = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 60);
    return d.toLocaleDateString("en-CA");
  }, []);

  //useEffect: Fetch thông tin bác sĩ và danh sách ngày có lịch khi component mount hoặc id thay đổi
  //Dependencies: [id] - chạy lại khi user xem trang bác sĩ khác
  useEffect(() => {
    getDoctor(id).then(setDoctor);
    getAvailableDays(id).then(setDays).catch(() => setDays([]));
  }, [id]);

  // util: nạp slot theo ngày và map về shape FE cần
  //Hàm gọi API lấy danh sách slot trong ngày, chuyển đổi sang format phù hợp FE
  async function refreshSlots(dateISO = selectedDate) {
    if (!dateISO) { setSlots([]); return; }
    try {
      const list = await getSlots(id, dateISO);
      const mapped = (Array.isArray(list) ? list : []).map((r) => {
        const scheduleId = r.scheduleId ?? r.id ?? r.schedule_id;
        const start = r.start_time ?? r.startTime ?? null; // "YYYY-MM-DD HH:mm:ss"
        const time =
          r.time ??
          (start ? String(start).slice(11, 16) : "");       // HH:mm
        const hour =
          r.hour != null
            ? Number(r.hour)
            : start
              ? Number(String(start).slice(11, 13))
              : undefined;
        const session = r.session || (hour < 12 ? "morning" : "afternoon");
        const capacity = r.capacity ?? 1;
        const bookedCnt = r.booked_count ?? r.bookedCount ?? r.booked ?? 0;
        const booked = bookedCnt >= capacity;
        return { scheduleId, time, session, booked };
      });
      setSlots(mapped);

      // nếu slot đang chọn không còn khả dụng → bỏ chọn
      if (
        selectedSlot &&
        !mapped.some((s) => s.scheduleId === (selectedSlot.scheduleId ?? selectedSlot?.schedule_id) && !s.booked)
      ) {
        setSelectedSlot(null);
      }
    } catch {
      setSlots([]);
    }
  }

  //useEffect: Fetch slots khi user chọn ngày + bật polling mỗi 5s để cập nhật real-time
  //Dependencies: [id, selectedDate] - chạy lại khi đổi bác sĩ hoặc đổi ngày
  //Polling giúp phát hiện khi slot bị người khác đặt → prevent double booking
  useEffect(() => {
    if (!selectedDate) { setSlots([]); setSelectedSlot(null); return; }
    refreshSlots(selectedDate);

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => refreshSlots(selectedDate), 5000);

    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [id, selectedDate]);

  //useEffect: Refresh slots khi user quay lại tab (focus event)
  //Dependencies: [selectedDate] - cần selectedDate để refresh đúng ngày
  //Giúp cập nhật slots nếu user mở tab khác rồi quay lại (có thể có slot mới bị đặt)
  useEffect(() => {
    const onFocus = () => refreshSlots();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [selectedDate]);

  return (
    <main className="container">
      {doctor && (
        <section className="dd-card">
          <img
            className="dd-avatar"
            src={doctor.avatar || "/assets/images/doctor.png"}
            onError={(e) => { e.currentTarget.src = "/assets/images/doctor.png"; }}
            alt={doctor?.name || "Doctor"}
          />
          <div className="dd-info">
            <h1 className="dd-name">{doctor.name}</h1>
            <div className="dd-badges">
              <span className="chip">Bác sĩ</span>
              {doctor.experience_years != null && (
                <span className="chip">{doctor.experience_years} năm kinh nghiệm</span>
              )}
            </div>
            <div className="dd-row">
              <span className="dd-label">Chuyên khoa:</span>
              {doctor.specialty ? <span className="chip">{doctor.specialty}</span> : <span>—</span>}
            </div>
            <div className="dd-row">
              <span className="dd-label">Nơi công tác:</span>
              {doctor.hospital ? <span className="chip">{doctor.hospital}</span> : <span>—</span>}
            </div>
            <div className="dd-note dd-note--warn">
              <b>⚠ Lưu ý:</b> Nếu bệnh nhân không đến khám được vui lòng hủy lịch đã đặt và chọn ngày khác.
            </div>
          </div>
        </section>
      )}

      <section className="dd-picker">
        <StepSelectTime
          todayISO={todayISO}
          maxISO={maxISO}
          availableDays={days}
          selectedDate={selectedDate}
          onDateChange={(d) => { setSelectedDate(d); setSelectedSlot(null); }}
          slots={slots}
          selectedSlot={selectedSlot}
          onSelectSlot={setSelectedSlot}
          onNext={() => {
            if (!doctor || !selectedDate || !selectedSlot) return;
            nav("/checkout", {
              state: { doctor, dateISO: selectedDate, slot: selectedSlot, me: null },
            });
          }}
          onNeedRefresh={() => refreshSlots()}   // <<< reload ngay khi StepSelectTime báo 409
        />
      </section>

      {doctor && (
        <section className="dd-section">
          <h3>Giới thiệu</h3>
          <h4>{doctor.name}</h4>
          <ul className="dd-bio">
            {String(doctor?.bio || "")
              .trim()
              .split(/\r?\n|[•\-–;]|·/)
              .map((t) => t.trim())
              .filter(Boolean)
              .slice(0, 3)
              .map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </section>
      )}
    </main>
  );
}
