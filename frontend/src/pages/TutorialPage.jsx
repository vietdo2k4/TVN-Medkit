import { useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";

/** Banner nhỏ */
function GuideHero() {
  return (
    <div className="card guide-hero">
      <div className="guide-hero__title">Hướng dẫn sử dụng TVN Medkit</div>
      <div className="guide-hero__desc">
        Chọn một mục bên dưới để xem hướng dẫn chi tiết.
      </div>
    </div>
  );
}

/** Nav pills đổi view bằng query ?t=booking | ai */
function GuideTabs({ active }) {
  return (
    <div className="guide-tabs">
      <Link to="/tutorial?t=booking" className={"pill" + (active === "booking" ? " is-active" : "")}>
        Hướng dẫn đặt lịch
      </Link>
      <Link to="/tutorial?t=ai" className={"pill" + (active === "ai" ? " is-active" : "")}>
        Hướng dẫn dùng chatbot AI
      </Link>
    </div>
  );
}

/** Khối step */
function Step({ no, title, children }) {
  return (
    <div className="step">
      <div className="step__no">Bước {no}</div>
      <div className="step__body">
        <div className="step__title">{title}</div>
        <div className="step__content">{children}</div>
      </div>
    </div>
  );
}

/* ======================= PAGE 1: ĐẶT LỊCH ======================= */
function BookingGuide() {
  return (
    <div className="card guide">
      <div className="card__title">Hướng dẫn đặt lịch khám</div>

      <Step no={1} title="Tìm bác sĩ hoặc cơ sở y tế">
        <ul>
          <li>Dùng ô <strong>Tìm kiếm</strong> trên trang “Bác sĩ/CSYT” để nhập tên bác sĩ, chuyên khoa hoặc cơ sở.</li>
          <li>Dùng bộ lọc theo <em>khu vực, chuyên khoa</em> để thu hẹp kết quả.</li>
        </ul>
      </Step>

      <Step no={2} title="Xem chi tiết và chọn ngày khám">
        <ul>
          <li>Mở trang chi tiết bác sĩ để xem mô tả, cơ sở làm việc và <strong>lịch trống</strong> theo ngày.</li>
          <li>Chọn ngày trong 60 ngày tới, hệ thống hiển thị các <strong>khung giờ</strong> còn trống.</li>
        </ul>
      </Step>

      <Step no={3} title="Giữ slot và điền thông tin">
        <ul>
          <li>Chọn một khung giờ → hệ thống <strong>giữ slot tạm</strong> trong vài phút để bạn điền thông tin.</li>
          <li>Nhập họ tên, năm sinh, giới tính, số điện thoại và ghi chú triệu chứng (nếu có).</li>
        </ul>
      </Step>

      <Step no={4} title="Xác nhận đặt lịch">
        <ul>
          <li>Kiểm tra lại thông tin → Nhấn <strong>Đặt lịch</strong>.</li>
          <li>Bạn sẽ nhận <strong>thông báo</strong> và có thể xem phiếu khám trong “Phiếu khám bệnh”.</li>
        </ul>
      </Step>

      <Step no={5} title="Theo dõi và quản lý phiếu khám">
        <ul>
          <li>Xem chi tiết, hủy lịch có lý do (khi cần). Trạng thái thanh toán/chấp nhận cập nhật theo thời gian thực.</li>
          <li>Hệ thống gửi nhắc lịch trước 24h/2h; nếu quá giờ không đến có thể đánh dấu <em>Đã hủy</em>.</li>
        </ul>
      </Step>
    </div>
  );
}

/* ======================= PAGE 2: CHATBOT AI ======================= */
function AIGuide() {
  return (
    <div className="card guide">
      <div className="card__title">Hướng dẫn sử dụng chatbot AI y tế</div>

      <Step no={1} title="Mở chatbot">
        <ul>
          <li>Nhấn nút tròn ở góc phải dưới có <strong>mặt bot</strong>.</li>
          <li>Hoặc đợi khoảng 1–2 phút, chatbot sẽ hiện <strong>toast gợi ý</strong> (có nút ✕ để tắt).</li>
        </ul>
      </Step>

      <Step no={2} title="Nhập câu hỏi/triệu chứng">
        <ul>
          <li>Ví dụ: “đau đầu 3 ngày, buồn nôn nhẹ” hoặc “gợi ý bác sĩ nội tổng quát”.</li>
          <li>Tin nhắn của bạn hiển thị bên <strong>phải</strong>, phản hồi của AI bên <strong>trái</strong> kèm thời gian.</li>
        </ul>
      </Step>

      <Step no={3} title="Xem gợi ý bác sĩ/chi tiết">
        <ul>
          <li>AI trả về danh sách bác sĩ đúng chuyên khoa: chỉ hiển thị <strong>Họ tên</strong> (đã loại tiền tố), <strong>Chuyên khoa</strong>, <strong>Cơ sở</strong>, <strong>Phí tham khảo</strong>.</li>
          <li>Nói “xem chi tiết bác sĩ &lt;tên&gt;” để nhận đúng 4 dòng “chi tiết bác sĩ”.</li>
        </ul>
      </Step>

      <Step no={4} title="Cách hỏi đúng để chatbot trả kết quả chính xác">
        <ul>
          <li>
            <strong>Bác sĩ theo chuyên khoa tại bệnh viện</strong><br />
            Cú pháp: <code>Bác sĩ [chuyên khoa] ở [tên bệnh viện]</code><br />
            Ví dụ: <code>Bác sĩ tim mạch ở BV Chợ Rẫy</code>
          </li>

          <li>
            <strong>Xem lịch khám bác sĩ</strong><br />
            Cú pháp: <code>Lịch bác sĩ [tên bác sĩ]</code><br />
            Ví dụ: <code>Lịch bác sĩ Trần Quân Anh</code>
          </li>

          <li>
            <strong>Xem thông tin chi tiết bệnh viện</strong><br />
            Cú pháp: <code>Thông tin chi tiết bệnh viện [tên]</code><br />
            Ví dụ: <code>Thông tin chi tiết bệnh viện Chợ Rẫy</code>
          </li>

          <li>
            <strong>Xem thông tin chi tiết bác sĩ</strong><br />
            Cú pháp: <code>Thông tin bác sĩ [tên]</code><br />
            Ví dụ: <code>Thông tin bác sĩ Nguyễn Văn A</code>
          </li>

          <li>
            <strong>Hỏi triệu chứng & gợi ý chuyên khoa</strong><br />
            Ví dụ: <code>Đau ngực, khó thở nên khám khoa nào</code>
          </li>
        </ul>
      </Step>

      <Step no={5} title="Toàn màn hình & xóa đoạn chat">
        <ul>
          <li>Nhấn biểu tượng <strong>↔</strong> để bật <em>toàn màn hình</em>; bố cục sẽ tự scale đồng bộ.</li>
          <li>Nhấn biểu tượng <strong>thùng rác</strong> để xóa lịch sử; biểu tượng <strong>✕</strong> để đóng hộp chat.</li>
        </ul>
      </Step>

    </div>
  );
}

export default function TutorialPage() {
  const [sp] = useSearchParams();
  const tab = useMemo(() => (sp.get("t") === "ai" ? "ai" : "booking"), [sp]);

  return (
    <main className="container pv">
      <GuideHero />
      <GuideTabs active={tab} />
      {tab === "ai" ? <AIGuide /> : <BookingGuide />}

      {/* CSS inline */}
      <style>{`
        .guide-hero{padding:18px}
        .guide-hero__title{font-weight:700;font-size:20px}
        .guide-hero__desc{color:#475569;margin-top:4px}
        .guide-tabs{display:flex;gap:10px;margin:12px 0 16px}
        .pill{padding:10px 14px;border-radius:999px;border:1px solid #e5e7eb;background:#f8fafc;color:#0f172a;text-decoration:none}
        .pill.is-active{background:#2563eb;color:#fff;border-color:#2563eb}
        .guide .card__title{margin-bottom:8px}
        .step{display:flex;gap:12px;margin:14px 0;padding:12px;border:1px solid #eef2f7;border-radius:12px;background:#fff}
        .step__no{min-width:84px;height:32px;line-height:32px;text-align:center;border-radius:999px;background:#e5edff;color:#1e3a8a;font-weight:700;margin-top:2px}
        .step__title{font-weight:700;margin-bottom:6px}
        .step__content ul{padding-left:18px;margin:0}
        @media (max-width: 640px){ .step{flex-direction:column} .step__no{width:100%} }
        .step__content,
        .step__content ul,
        .step__content li {font-family: inherit;font-size: 16px;line-height: 1.6;color: #1f2937;
        }
        .step__content strong {font-weight: 600;}

        .step__content code {font-family: inherit;font-size: 14px;background: #f1f5f9;padding: 2px 6px;border-radius: 6px;color: #0f172a;}
        .step__content li {margin-bottom: 10px;}
      `}</style>
    </main>
  );
}
