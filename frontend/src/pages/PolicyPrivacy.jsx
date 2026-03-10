import "../styles/policy.css";
export default function PolicyPrivacy()
{

    const updated = "01/12/2025";
    return (
        <main className="policy container">
            <h1>Chính sách bảo mật dữ liệu – TVN Medkit</h1>
            <p className="policy__meta">Hiệu lực: {updated} • Phiên bản 1.0</p>

            <section>
                <h2>1. Mục đích & phạm vi</h2>
                <p>
                    Chính sách này mô tả cách TVN Medkit thu thập, sử dụng, lưu trữ và bảo vệ dữ liệu cá nhân khi
                    người dùng đặt lịch, quản lý hồ sơ và sử dụng các dịch vụ y tế trên nền tảng.
                </p>
            </section>

            <section>
                <h2>2. Dữ liệu chúng tôi thu thập</h2>
                <ul>
                    <li>Thông tin tài khoản: họ tên, email, số điện thoại.</li>
                    <li>Hồ sơ bệnh nhân: ngày sinh, giới tính, địa chỉ, BHYT (nếu có).</li>
                    <li>Dữ liệu đặt lịch: bác sĩ/cơ sở, ngày giờ khám, trạng thái, thanh toán.</li>
                    <li>Dữ liệu kỹ thuật: cookie, địa chỉ IP rút gọn, loại thiết bị/ trình duyệt.</li>
                </ul>
            </section>

            <section>
                <h2>3. Mục đích sử dụng</h2>
                <ul>
                    <li>Cung cấp, duy trì, cải thiện dịch vụ đặt lịch và quản lý hồ sơ.</li>
                    <li>Gửi thông báo liên quan tới lịch hẹn, kết quả thao tác, hỗ trợ khách hàng.</li>
                    <li>Phân tích ẩn danh nhằm nâng cao chất lượng dịch vụ.</li>
                    <li>Tuân thủ yêu cầu pháp luật khi có cơ quan có thẩm quyền.</li>
                </ul>
            </section>

            <section>
                <h2>4. Chia sẻ dữ liệu</h2>
                <ul>
                    <li>Với cơ sở y tế/bác sĩ mà bạn chọn để thực hiện dịch vụ.</li>
                    <li>Với nhà cung cấp hạ tầng (lưu trữ/ gửi email/ SMS) theo hợp đồng bảo mật.</li>
                    <li>Với cơ quan nhà nước có thẩm quyền theo quy định pháp luật.</li>
                    <li>Không bán dữ liệu cá nhân cho bên thứ ba.</li>
                </ul>
            </section>

            <section>
                <h2>5. Lưu trữ & bảo mật</h2>
                <ul>
                    <li>Mã hoá khi truyền; kiểm soát truy cập ở mức hệ thống và ứng dụng.</li>
                    <li>Thời hạn lưu trữ: trong suốt vòng đời tài khoản và tối đa 05 năm sau khi đóng/tất toán nghĩa vụ.</li>
                </ul>
            </section>

            <section>
                <h2>6. Quyền của người dùng</h2>
                <ul>
                    <li>Truy cập, chỉnh sửa, cập nhật thông tin cá nhân.</li>
                    <li>Yêu cầu xoá/ ẩn/ hạn chế xử lý theo quy định pháp luật hiện hành.</li>
                    <li>Rút lại chấp thuận xử lý dữ liệu (có thể ảnh hưởng việc cung cấp dịch vụ).</li>
                </ul>
            </section>

            <section>
                <h2>7. Cookie</h2>
                <p>
                    Chúng tôi dùng cookie phiên để ghi nhớ trạng thái đăng nhập và tuỳ chọn giao diện. Bạn có thể
                    tắt cookie trong trình duyệt nhưng một số tính năng có thể hoạt động không đầy đủ.
                </p>
            </section>

            <section>
                <h2>8. Liên hệ</h2>
                <p>
                    Email: support@tvnmedkit.vn • Hotline: 1900 2115 • Địa chỉ: TP. Hồ Chí Minh.
                </p>
            </section>

            <section>
                <h2>9. Thay đổi chính sách</h2>
                <p>
                    Khi chính sách thay đổi, thời điểm hiệu lực mới sẽ được cập nhật tại trang này.
                </p>
            </section>
        </main>
    );
}
