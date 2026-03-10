const API = import.meta.env.VITE_API_BASE_URL;

//Tạo header xác thực cho API thông báo
function authHeaders() {
  const token = localStorage.getItem("token");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

// NEW: page/limit
//Lấy danh sách thông báo (có thể lọc chỉ lấy chưa đọc, phân trang)
export async function listNotifications({ unread = false, page = 1, limit = 6 } = {}) {
  const qs = new URLSearchParams();
  if (unread) qs.set("unread", "1");
  qs.set("page", String(page));
  qs.set("limit", String(limit));
  const r = await fetch(`${API}/notifications?` + qs.toString(), { headers: authHeaders() });
  if (!r.ok) throw new Error("Không tải được danh sách");
  return r.json();
}

//Đánh dấu 1 thông báo là đã đọc
export async function markRead(id) {
  const r = await fetch(`${API}/notifications/${id}/read`, { method: "PATCH", headers: authHeaders() });
  if (!r.ok) throw new Error("Không đánh dấu đã đọc");
  return r.json();
}

//Đánh dấu tất cả thông báo là đã đọc (có thể chỉ định trước thời điểm nào đó)
export async function markAllRead(before) {
  const body = before ? { before } : {};
  const r = await fetch(`${API}/notifications/read-all`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("Không thể đánh dấu tất cả đã đọc");
  return r.json();
}

//Lấy số lượng thông báo chưa đọc
export async function getUnreadCount() {
  const token = localStorage.getItem("token");
  if (!token) return { unread: 0 };
  const r = await fetch(`${API}/notifications/unread_count`, { headers: authHeaders() });
  if (r.status === 401) return { unread: 0 };
  if (!r.ok) throw new Error("Không lấy được số chưa đọc");
  return r.json();
}
