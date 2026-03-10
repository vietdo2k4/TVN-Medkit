
// src/api/doctor.js
const API = import.meta.env.VITE_API_BASE_URL;

//Tạo header xác thực cho các request dành riêng bác sĩ
function authHeaders() {
    const t = localStorage.getItem("token");
    return { Authorization: `Bearer ${t}`, "Content-Type": "application/json" };
}

//Helper: parse JSON từ response hoặc throw error nếu request thất bại
async function j(r) {
    if (r.ok) return r.json();
    const txt = await r.text();           // chỉ đọc 1 lần
    try {
        const obj = JSON.parse(txt);
        throw new Error(obj?.message || txt);
    } catch {
        throw new Error(txt);
    }
}

//Lấy tên hiển thị của bác sĩ đang đăng nhập
export async function getDoctorWhoAmI() {
    const API = import.meta.env.VITE_API_BASE_URL;
    const r = await fetch(`${API}/doctor/whoami`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    if (!r.ok) throw new Error("Không lấy được tên bác sĩ");
    return r.json(); // { display_name }
}

//Lấy thông tin chi tiết 1 bác sĩ (public, không cần auth)
export async function getDoctor(id) {
    return j(await fetch(`${API}/doctors/${id}`));
}

/** days: optional { from, to, limit } */
//Lấy các ngày có lịch khám của 1 bác sĩ (dùng cho calendar UI)
export async function getAvailableDays(id, opts = {}) {
    const qs = new URLSearchParams();
    if (opts.from) qs.set("from", opts.from);
    if (opts.to) qs.set("to", opts.to);
    if (opts.limit) qs.set("limit", String(opts.limit));
    const url = `${API}/doctors/${id}/available-days${qs.toString() ? `?${qs}` : ""}`;
    return j(await fetch(url)); // ["YYYY-MM-DD", ...]
}

/** slots: always return {scheduleId,time}, add {free,session} if BE có */
//Lấy danh sách slot (giờ khám) trong 1 ngày cụ thể
export async function getSlots(id, date) {
    const r = await fetch(`${API}/doctors/${id}/slots?date=${date}`);
    const rows = await j(r);
    return rows.map(x => ({
        scheduleId: x.scheduleId,
        time: x.time,
        free: x.free,         // optional
        session: x.session,   // optional
    }));
}

// danh sách lịch hẹn của bác sĩ
//Lấy danh sách lịch hẹn (appointments) của bác sĩ đang đăng nhập
export async function listDoctorAppointments(params = {}) {
    const qs = new URLSearchParams();
    for (const k of ["q", "status", "from", "to", "page", "limit"]) if (params[k]) qs.set(k, params[k]);
    return j(await fetch(`${API}/doctor/appointments?${qs}`, { headers: authHeaders() }));
}

//Thay đổi trạng thái lịch hẹn (confirm, complete, cancel) - action: 'confirm'|'complete'|'cancel'
export async function mutateDoctorAppointment(id, action, extra) {
    const payload = { action };

    // Hỗ trợ cả mutateDoctorAppointment(id, "cancel", "lý do")
    if (typeof extra === "string" && extra.trim()) {
        payload.reason = extra.trim();
    }
    // Hỗ trợ mutateDoctorAppointment(id, "cancel", { reason: "lý do", note: "..." })
    if (extra && typeof extra === "object") {
        if (extra.reason && String(extra.reason).trim()) payload.reason = String(extra.reason).trim();
        else if (extra.note && String(extra.note).trim()) payload.reason = String(extra.note).trim();
    }

    return j(
        await fetch(`${API}/doctor/appointments/${id}`, {
            method: "PATCH",
            headers: authHeaders(),
            body: JSON.stringify(payload),
        })
    );
}

//Cập nhật trạng thái thanh toán của 1 lịch hẹn (pending, completed)
export async function setDoctorPayment(id, payment_status) {
    return j(await fetch(`${API}/doctor/appointments/${id}/payment`, {
        method: "PATCH", headers: authHeaders(), body: JSON.stringify({ payment_status })
    }));
}

//Lấy chi tiết 1 lịch hẹn
export async function getDoctorAppointment(id) {
    const r = await fetch(`${API}/doctor/appointments/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    });
    if (!r.ok) throw new Error((await r.json()).message || "Không tải được chi tiết");
    return r.json();
}

//Lấy các số liệu thống kê của bác sĩ (số lịch hẹn theo trạng thái, doanh thu...)
export async function getDoctorMetrics(params = {}) {
    const qs = new URLSearchParams();
    if (params.range) qs.set("range", params.range);      // 7|14|30
    if (params.from) qs.set("from", params.from);        // YYYY-MM-DD
    if (params.to) qs.set("to", params.to);            // YYYY-MM-DD
    if (params.all) qs.set("all", "1");                 // đếm trạng thái toàn bộ thời gian
    const url = `${API}/doctor/metrics${qs.toString() ? `?${qs}` : ""}`;
    const r = await fetch(url, { headers: authHeaders() });
    if (!r.ok) throw new Error((await r.json()).message || "Không tải được số liệu");
    return r.json();
}

//Hồ sơ bác sĩ
//Lấy thông tin cá nhân của bác sĩ đang đăng nhập
export async function getDoctorMe() {
    const API = import.meta.env.VITE_API_BASE_URL;
    const r = await fetch(`${API}/doctor/me`, { headers: authHeaders() });
    return j(r);
}

//Cập nhật thông tin cá nhân (bio, phone, ...)
export async function updateDoctorSettings(payload) {
    const API = import.meta.env.VITE_API_BASE_URL;
    const r = await fetch(`${API}/doctor/me`, {
        method: "PUT", headers: authHeaders(), body: JSON.stringify(payload)
    });
    return j(r);
}

// --- Thông báo ---
//Lấy danh sách thông báo dành cho bác sĩ
export async function fetchNotifications(params = {}) {
    const API = import.meta.env.VITE_API_BASE_URL;
    const qs = new URLSearchParams();
    if (params.since) qs.set("since", params.since);
    if (params.limit) qs.set("limit", String(params.limit));
    const r = await fetch(`${API}/doctor/notifications?${qs}`, { headers: authHeaders() });
    return j(r);                 // { items, unread }
}

//Đánh dấu các thông báo là đã đọc
export async function markNotificationsRead(ids) {
    const API = import.meta.env.VITE_API_BASE_URL;
    const r = await fetch(`${API}/doctor/notifications/read`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ ids })
    });
    return j(r);
}

//Đổi mật khẩu của bác sĩ
export async function changeMyPassword(old_password, new_password) {
    const r = await fetch(`${API}/doctor/me/password`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ old_password, new_password })
    });
    return j(r); // { ok: true }
}