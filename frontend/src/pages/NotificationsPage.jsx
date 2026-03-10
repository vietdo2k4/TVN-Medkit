import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listNotifications, markRead, markAllRead } from "../api/notifications";
import "../styles/notifications.css";

export default function NotificationsPage() {
    const nav = useNavigate();

    //useState: Lưu danh sách thông báo - mảng object {id, message, is_read, created_at, appointment_id}
    const [items, setItems] = useState([]);

    //useState: Trang hiện tại của pagination - bắt đầu từ 1
    const [page, setPage] = useState(1);

    //useState: Tổng số trang - tính từ API response (total_pages)
    const [totalPages, setTotalPages] = useState(1);

    //useState: Đánh dấu đang load dữ liệu - hiển thị loading indicator
    const [loading, setLoading] = useState(false);

    //useState: Filter chỉ hiện thông báo chưa đọc - toggle bởi tabs "Tất cả" / "Chưa đọc"
    const [unreadOnly, setUnreadOnly] = useState(false);

    async function load(p = 1, unread = unreadOnly) {
        setLoading(true);
        try {
            const { items, page, total_pages } = await listNotifications({ unread, page: p, limit: 6 });
            setItems(items);
            setPage(page);
            setTotalPages(total_pages || 1);
        } catch {
            setItems([]); setTotalPages(1);
        } finally {
            setLoading(false);
        }
    }

    //useEffect: Fetch lại danh sách thông báo khi user toggle filter "Chưa đọc"
    //Dependencies: [unreadOnly] - chạy lại khi user click tab "Tất cả" hoặc "Chưa đọc"
    useEffect(() => { load(1, unreadOnly); }, [unreadOnly]);

    async function onClickItem(n) {
        if (!n.is_read) {
            await markRead(n.id);
            setItems(prev => prev.map(x => (x.id === n.id ? { ...x, is_read: true } : x)));
            window.dispatchEvent(new Event("tvn-noti-changed"));
        }
        if (n.appointment_id) nav(`/me/appointments/${n.appointment_id}`);
    }

    //useMemo: Đếm tổng số thông báo chưa đọc - hiển thị badge "Chưa đọc (N)"
    //Dependencies: [items] - chỉ tính lại khi danh sách thông báo thay đổi
    const totalUnread = useMemo(() => items.reduce((s, x) => s + (x.is_read ? 0 : 1), 0), [items]);

    return (
        <div className="noti-wrap">
            <div className="noti-head">
                <div className="noti-tabs">
                    <button className={!unreadOnly ? "on" : ""} onClick={() => setUnreadOnly(false)}>Tất cả</button>
                    <button className={unreadOnly ? "on" : ""} onClick={() => setUnreadOnly(true)}>
                        Chưa đọc {totalUnread > 0 ? `(${totalUnread})` : ""}
                    </button>
                </div>
                <div className="noti-actions">
                    <button
                        className="btn btn--light"
                        onClick={async () => { await markAllRead(); await load(page); window.dispatchEvent(new Event("tvn-noti-changed")); }}
                    >Đánh dấu tất cả đã đọc</button>
                </div>
            </div>

            {items.length === 0 && !loading && <p className="muted">Chưa có thông báo.</p>}

            <ul className="noti-list">
                {items.map(n => (
                    <li key={n.id} className={"noti-item" + (n.is_read ? " read" : "")} onClick={() => onClickItem(n)}>
                        <div className="noti-dot" aria-hidden />
                        <div className="noti-body">
                            <div className="noti-msg">{n.message}</div>
                            <div className="noti-meta">
                                <time>{formatVN(n.created_at)}</time>
                                {n.appointment_id ? <span className="noti-link">Xem phiếu</span> : null}

                            </div>
                        </div>
                    </li>
                ))}
            </ul>

            <Pager page={page} total={totalPages} onChange={(p) => load(p)} />
            {loading && <div className="noti-loading">Đang tải...</div>}
        </div>
    );
}

function Pager({ page, total, onChange }) {
    if (total <= 1) return null;
    const pages = Array.from({ length: total }, (_, i) => i + 1).slice(
        Math.max(0, page - 3), Math.max(0, page - 3) + 5
    );
    return (
        <div className="pager">
            <button disabled={page <= 1} onClick={() => onChange(page - 1)}>‹ Trước</button>
            {pages.map(p => (
                <button key={p} className={p === page ? "on" : ""} onClick={() => onChange(p)}>{p}</button>
            ))}
            <button disabled={page >= total} onClick={() => onChange(page + 1)}>Sau ›</button>
        </div>
    );
}

function formatVN(isoLike) {
    try {
        const d = new Date(isoLike);
        return d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
    } catch { return isoLike; }
}
