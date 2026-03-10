// src/api/admin.js
const API = import.meta.env.VITE_API_BASE_URL;

//Hàm helper để gọi API với token xác thực (dành cho Admin)
function authFetch(path, opts = {}) {
    const token = localStorage.getItem("token");
    return fetch(`${API}${path}`, {
        ...opts,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(opts.headers || {}),
        },
    }).then(async (r) => {
        const data = await r.json().catch(() => null);
        //Nếu request lỗi, throw error kèm message từ server
        if (!r.ok) throw Object.assign(new Error(data?.message || "Request error"), { status: r.status, data });
        return data;
    });
}

/* Dashboard */
//Lấy số liệu thống kê tổng quan cho trang Dashboard (số user, doctor, appointment...)
export const getAdminMetrics = () => authFetch(`/admin/metrics`);

/* Users */
//Lấy danh sách người dùng (có thể filter theo role, status, q - từ khóa tìm kiếm)
export const listUsers = (params) => {
    const q = new URLSearchParams(params || {}).toString();
    return authFetch(`/admin/users${q ? `?${q}` : ""}`);
};
//Lấy chi tiết 1 user theo ID
export const getUser = (id) => authFetch(`/admin/users/${id}`);
//Tạo user mới (payload: {email, password, role, status})
export const createUser = (payload) =>
    authFetch(`/admin/users`, { method: "POST", body: JSON.stringify(payload) });
//Cập nhật thông tin user (có thể đổi email, role, status, password)
export const updateUser = (id, payload) =>
    authFetch(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
//Xóa user khỏi hệ thống
export const deleteUser = (id) =>
    authFetch(`/admin/users/${id}`, { method: "DELETE" });

/* Doctors */
//Lấy danh sách bác sĩ (filter theo q, hospitalId, specialtyId)
export const listDoctors = (params) => {
    const q = new URLSearchParams(params || {}).toString();
    return authFetch(`/admin/doctors${q ? `?${q}` : ""}`);
};
//Lấy chi tiết 1 bác sĩ
export const getDoctor = (id) => authFetch(`/admin/doctors/${id}`);
//Tạo bác sĩ mới (chỉ tạo profile, chưa có tài khoản)
export const createDoctor = (payload) =>
    authFetch(`/admin/doctors`, { method: "POST", body: JSON.stringify(payload) });
//Cập nhật thông tin bác sĩ
export const updateDoctor = (id, payload) =>
    authFetch(`/admin/doctors/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
//Xóa bác sĩ (nếu có tài khoản thì xóa luôn)
export const deleteDoctor = (id) =>
    authFetch(`/admin/doctors/${id}`, { method: "DELETE" });
//Tạo tài khoản đăng nhập cho bác sĩ đã tồn tại
export const createDoctorAccount = (id, payload) =>
    authFetch(`/admin/doctors/${id}/create-account`, { method: "POST", body: JSON.stringify(payload) });

/* Hospitals */
export const listHospitals = (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return authFetch(`/admin/hospitals${q ? `?${q}` : ""}`);
};

export const getHospital = (id) =>
    authFetch(`/admin/hospitals/${id}`);

export const createHospital = ({ name, address, phone, image_url, details }) =>
    authFetch(`/admin/hospitals`, {
        method: "POST",
        body: JSON.stringify({ name, address, phone, image_url, details }),
    });

export const updateHospital = (id, patch) => {
    // Chỉ gửi các field có giá trị (tránh ghi đè thành null)
    const { name, address, phone, image_url, details } = patch;
    const body = {};
    if (name !== undefined) body.name = name;
    if (address !== undefined) body.address = address;
    if (phone !== undefined) body.phone = phone;
    if (image_url !== undefined) body.image_url = image_url;
    if (details !== undefined) body.details = details;

    return authFetch(`/admin/hospitals/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
    });
};

export const deleteHospital = (id) =>
    authFetch(`/admin/hospitals/${id}`, { method: "DELETE" });


/* Services */
//Lấy danh sách dịch vụ y tế
export const listServices = (params) => {
    const q = new URLSearchParams(params || {}).toString();
    return authFetch(`/admin/services${q ? `?${q}` : ""}`);
};
//Lấy chi tiết 1 dịch vụ
export const getService = (id) => authFetch(`/admin/services/${id}`);
//Tạo dịch vụ mới (payload: {name, description})
export const createService = (payload) =>
    authFetch(`/admin/services`, { method: "POST", body: JSON.stringify(payload) });
//Cập nhật dịch vụ
export const updateService = (id, payload) =>
    authFetch(`/admin/services/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
//Xóa dịch vụ
export const deleteService = (id) =>
    authFetch(`/admin/services/${id}`, { method: "DELETE" });

/* Doctor–Services mapping */
export const listDoctorServices = (params) => {
    const q = new URLSearchParams(params || {}).toString();
    return authFetch(`/admin/doctor-services${q ? `?${q}` : ""}`);
};
export const addDoctorService = (payload) =>
    authFetch(`/admin/doctor-services`, { method: "POST", body: JSON.stringify(payload) });
export const removeDoctorService = (payload) =>
    authFetch(`/admin/doctor-services`, { method: "DELETE", body: JSON.stringify(payload) });

/* Specialties */
//Lấy danh sách chuyên khoa y tế
export const listSpecialties = (params) => {
    const q = new URLSearchParams(params || {}).toString();
    return authFetch(`/admin/specialties${q ? `?${q}` : ""}`);
};
//Tạo chuyên khoa mới
export const createSpecialty = (payload) =>
    authFetch(`/admin/specialties`, {
        method: "POST",
        body: JSON.stringify(payload), // { name, description?, icon_path? }
    });
//Cập nhật chuyên khoa
export const updateSpecialty = (id, payload) =>
    authFetch(`/admin/specialties/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload), // { name?, description?, icon_path? }
    });
//Xóa chuyên khoa (chỉ xóa được nếu không có bác sĩ nào thuộc chuyên khoa này)
export const deleteSpecialty = (id) =>
    authFetch(`/admin/specialties/${id}`, { method: "DELETE" });


/* Appointments */
export const listAppointments = (params = {}) => {
    // q: tên bệnh nhân; status; hospital_id; doctor_id; date_from, date_to (YYYY-MM-DD)
    // page/limit phân trang
    const q = new URLSearchParams();
    if (params.q) q.set("q", params.q);
    if (params.status) q.set("status", params.status);
    if (params.hospital_id) q.set("hospital_id", params.hospital_id);
    if (params.doctor_id) q.set("doctor_id", params.doctor_id);
    const from = params.date_from ?? params.from;
    const to = params.date_to ?? params.to;
    if (from) q.set("date_from", from);
    if (to) q.set("date_to", to);
    q.set("page", String(params.page ?? 1));
    q.set("limit", String(params.limit ?? 20));
    return authFetch(`/admin/appointments${q.toString() ? `?${q}` : ""}`);
};

export const getAppointment = (id) =>
    authFetch(`/admin/appointments/${id}`);

// Cập nhật trạng thái: { status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' }
export const updateAppointmentStatus = (id, { status }) =>
    authFetch(`/admin/appointments/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
    });

// Dời lịch: { schedule_id: number } (đã kiểm tra hợp lệ ở BE)
export const rescheduleAppointment = (id, { schedule_id }) =>
    authFetch(`/admin/appointments/${id}/reschedule`, {
        method: "POST",
        body: JSON.stringify({ schedule_id }),
    });


//Lấy chuyên khoa theo cơ sở y tế
export const getHospitalSpecialties = (id) =>
    authFetch(`/admin/hospitals/${id}/specialties`);
