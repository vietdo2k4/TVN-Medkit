// src/api/appointments.js
//Hàm hủy lịch hẹn của bệnh nhân (gọi API POST /me/appointments/:id/cancel)
export async function cancelAppointment(id) {
    const token = localStorage.getItem("token");
    const r = await fetch(`${import.meta.env.VITE_API_BASE_URL}/me/appointments/${id}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.message || "Hủy phiếu thất bại");
    }
    return r.json();
}
