/* eslint-disable no-empty */
const API = import.meta.env.VITE_API_BASE_URL;
//Helper: lấy Authorization header nếu đã đăng nhập
const auth = () => {
    const t = localStorage.getItem("token");
    return t ? { Authorization: `Bearer ${t}` } : {};
};

//Tạo "hold" (giữ chỗ tạm thời) cho 1 slot khám bệnh
export async function createHold({ scheduleId, doctorId, dateISO, timeHM, firm = false }) {
    const body = scheduleId
        ? { scheduleId, firm }
        : { doctorId, date: dateISO, slot: timeHM, firm };

    const r = await fetch(`${API}/holds`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth() },
        body: JSON.stringify(body),
    });
    if (!r.ok) {
        let msg = "Không giữ được chỗ";
        try { const e = await r.json(); if (e?.message) msg = e.message; } catch { }
        throw new Error(msg);
    }
    return r.json(); // { scheduleId, expiresAt }
}

//Hủy hold (giải phóng chỗ đã giữ)
export async function releaseHold(scheduleId) {
    if (!scheduleId) return;
    try {
        await fetch(`${API}/holds/${scheduleId}`, {
            method: "DELETE",
            headers: { ...auth() },
        });
    } catch { }
}

//Tạo booking chính thức (xác nhận đặt lịch)
export async function createBooking(payload) {
    const r = await fetch(`${API}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth() },
        body: JSON.stringify(payload), // payload có { doctorId, date, slot, symptoms_note, ... }
    });
    if (!r.ok) {
        let msg = "Đặt lịch thất bại";
        try {
            const e = await r.json();
            if (e?.message) msg = e.message;
        } catch { }
        throw new Error(msg);
    }
    return r.json();
}
