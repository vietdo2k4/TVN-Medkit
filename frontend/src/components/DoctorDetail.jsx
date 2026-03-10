// src/components/DoctorDetail.jsx
import React from "react";              


export default function DoctorDetail({ doctor, className = "", actions = null }) {
    if (!doctor) return null;

    return (
        <section className={`doctor-detail ${className}`}>
            <div className="doctor-detail__left">
                <img
                    src={doctor.avatar || "/assets/images/doctor.png"}
                    alt={doctor.name}
                    className="doctor-detail__avatar"
                />
            </div>

            <div className="doctor-detail__right">
                <h2 className="doctor-detail__name">{doctor.name}</h2>
                <p className="doctor-detail__specialty">{doctor.specialty}</p>
                <p className="doctor-detail__hospital">{doctor.hospital}</p>

                <p className="doctor-detail__info">
                    <b>Kinh nghiệm:</b> {doctor.experience || "5 năm"} <br />
                    <b>Giá khám:</b>{" "}
                    {doctor.price
                        ? doctor.price.toLocaleString("vi-VN") + "đ"
                        : "300.000đ"}
                    <br />
                    <b>Địa chỉ:</b> {doctor.address || "Đang cập nhật"}
                </p>

                {actions && <div className="doctor-detail__actions">{actions}</div>}
            </div>
        </section>
    );
}
