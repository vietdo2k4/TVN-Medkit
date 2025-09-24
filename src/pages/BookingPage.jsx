import { useState } from "react";

export default function BookingPage(){
  const q=new URLSearchParams(window.location.search);
  const time=q.get("time");
  const [step,setStep]=useState(1);

  return (
    <main className="container pv">
      <h2 className="section__title">Đặt lịch</h2>

      {step===1 && (
        <div className="card">
          <div className="card__title">1) Chọn dịch vụ</div>
          <select className="input"><option>Khám Nội tổng quát</option><option>Khám Nhi</option><option>Sản phụ khoa</option></select>
          <button className="btn btn--primary" onClick={()=>setStep(2)}>Tiếp tục</button>
        </div>
      )}

      {step===2 && (
        <div className="card">
          <div className="card__title">2) Chọn thời gian</div>
          <div className="slots">
            {["08:00","08:30","09:00","09:30","10:00","10:30","11:00","14:00","14:30","15:00","15:30","16:00"].map(t=>(
              <button key={t} className={"slot"+(t===time?" slot--active":"")}>{t}</button>
            ))}
          </div>
          <button className="btn btn--primary" onClick={()=>setStep(3)}>Tiếp tục</button>
        </div>
      )}

      {step===3 && (
        <div className="card">
          <div className="card__title">3) Xác nhận & Thanh toán</div>
          <div className="grid-2">
            <div>
              <label className="label">Họ tên</label><input className="input" placeholder="Nguyễn Văn A"/>
              <label className="label">Số điện thoại</label><input className="input" placeholder="09xx xxx xxx"/>
              <label className="label">Ghi chú</label><textarea className="input" rows="4" placeholder="Triệu chứng..."/>
            </div>
            <div>
              <div className="label">Phương thức thanh toán</div>
              <div className="pay">{["MoMo","VNPay","Thẻ"].map(p=><button key={p} className="pay__opt">{p}</button>)}</div>
              <div className="tiny muted">Thanh toán mô phỏng cho demo.</div>
            </div>
          </div>
          <button className="btn btn--primary btn--lg w-100">Xác nhận đặt lịch</button>
        </div>
      )}
    </main>
  );
}
