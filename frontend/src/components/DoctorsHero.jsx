export default function DoctorsHero()                                                                       {
  return (
    <section className="doc-hero">
      {/* NỀN: gradient + ảnh bạn vừa thêm */}
      <div
        className="doc-hero__bg"
        style={{
          background:
            `linear-gradient(180deg, rgba(247,251,255,.92) 0%, rgba(247,251,255,.75) 40%, rgba(247,251,255,.85) 100%),
             url("/assets/images/doctorPageBG.png") center/cover no-repeat`
        }}
        aria-hidden="true"
      />

      <div className="doc-hero__inner container">
        <div className="doc-hero__card">
          <h2 className="doc-hero__title">ĐẶT KHÁM BÁC SĨ</h2>
          <ul className="doc-hero__bullets">
            <li>Đặt khám theo giờ, không chờ lấy số; hỗ trợ thanh toán online (nếu CSYT mở).</li>
            <li>Đặt sớm để có số thứ tự thấp, tránh hết số.</li>
            <li>Hưởng chính sách hoàn tiền khi đặt trên Medkit (nếu áp dụng).</li>
          </ul>
        </div>

        <div className="doc-hero__art">
          <img
            src="/assets/hero/hospital-hero.svg"
            alt="Minh họa bệnh viện"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        </div>
      </div>
    </section>
  );
}
