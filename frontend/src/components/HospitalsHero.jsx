// src/components/HospitalsHero.jsx
export default function HospitalsHero() {
    return (
        <section className="doc-hero">
            <div
                className="doc-hero__bg"
                style={{
                    background:
                        `linear-gradient(180deg, rgba(247,251,255,.92) 0%, rgba(247,251,255,.75) 40%, rgba(247,251,255,.85) 100%),
             url("/assets/images/hospitalBG.png") center/cover no-repeat`,
                }}
                aria-hidden="true"
            />
            <div className="doc-hero__inner container">
                <div className="doc-hero__card">
                    <h2 className="doc-hero__title">ĐẶT KHÁM THEO CƠ SỞ Y TẾ</h2>
                    <ul className="doc-hero__bullets">
                        <li>Đặt khám theo giờ – hạn chế chờ đợi</li>
                        <li>Hệ thống cơ sở y tế uy tín, đánh giá minh bạch</li>
                        <li>Hỗ trợ hoàn phí khi hủy (nếu CSYT áp dụng)</li>
                    </ul>
                </div>
            </div>
        </section>
    );
}
