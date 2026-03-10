//Địa chỉ URL gốc của Backend API (cấu hình trong file .env)
export const API = import.meta.env.VITE_API_BASE_URL;

//Hàm wrapper để gọi API, tự động đính kèm token xác thực nếu có
export async function http(path, opts = {}) {
    //Lấy token từ localStorage (được lưu khi đăng nhập thành công)
    const token = localStorage.getItem("token");
    const r = await fetch(`${API}${path}`, {
        ...opts,
        headers: {
            "Content-Type": "application/json",
            ...(opts.headers || {}),
            //Tự động thêm Authorization header nếu đã đăng nhập
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });
    //Nếu server trả về 401 (Unauthorized), xóa token và chuyển về trang đăng nhập
    if (r.status === 401) { localStorage.removeItem("token"); location.assign("/login"); return Promise.reject(); }
    return r;
}
