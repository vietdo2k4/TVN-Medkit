import "../styles/policy.css";
export default function PolicyTerms() {
    const updated = "01/12/2025";
    return (
        <main className="policy container">
            <h1>Điều khoản sử dụng – TVN Medkit</h1>
            <p className="policy__meta">Hiệu lực: {updated} • Phiên bản 1.0</p>

            <section>
                <h2>1. Phạm vi áp dụng</h2>
                <p>
                    Điều khoản này điều chỉnh việc truy cập và sử dụng nền tảng TVN Medkit, bao gồm đặt lịch khám,
                    quản trị hồ sơ, nhận thông báo và các tiện ích liên quan.
                </p>
            </section>

            <section>
                <h2>2. Tài khoản & bảo mật</h2>
                <ul>
                    <li>Người dùng chịu trách nhiệm bảo mật thông tin đăng nhập và mọi hoạt động phát sinh.</li>
                    <li>Không được mạo danh, giả mạo thông tin bệnh nhân hoặc xâm nhập trái phép.</li>
                </ul>
            </section>

            <section>
                <h2>3. Đặt lịch & huỷ lịch</h2>
                <ul>
                    <li>Thông tin đặt lịch phải chính xác. TVN Medkit chỉ là nền tảng kết nối.</li>
                    <li>Quy định huỷ/đổi lịch tuân theo chính sách của cơ sở y tế liên quan.</li>
                </ul>
            </section>

            <section>
                <h2>4. Phí & thanh toán</h2>
                <ul>
                    <li>Giá hiển thị (nếu có) mang tính tham khảo; phí thực tế do cơ sở y tế quyết định.</li>
                    <li>Hoàn/huỷ/đổi thanh toán (nếu phát sinh) tuân theo mục “Quy định hoàn tiền”.</li>
                </ul>
            </section>

            <section>
                <h2>5. Hành vi bị cấm</h2>
                <ul>
                    <li>Can thiệp hệ thống, thu thập dữ liệu trái phép, phát tán mã độc.</li>
                    <li>Lợi dụng nền tảng cho mục đích thương mại trái phép hoặc vi phạm pháp luật.</li>
                </ul>
            </section>

            <section>
                <h2>6. Trách nhiệm & miễn trừ</h2>
                <ul>
                    <li>TVN Medkit không thay thế tư vấn y khoa; bác sĩ/cơ sở chịu trách nhiệm chuyên môn.</li>
                    <li>Không chịu trách nhiệm cho gián đoạn ngoài khả năng kiểm soát (sự cố hạ tầng, thiên tai…).</li>
                </ul>
            </section>

            <section>
                <h2>7. Sửa đổi điều khoản</h2>
                <p>
                    Chúng tôi có thể cập nhật điều khoản và sẽ thông báo bằng cách cập nhật ngày hiệu lực.
                </p>
            </section>

            <section>
                <h2>8. Luật áp dụng & liên hệ</h2>
                <p>
                    Luật Việt Nam. Mọi thắc mắc xin liên hệ: support@tvnmedkit.vn • 1900 2115.
                </p>
            </section>
        </main>
    );
}
