/* eslint-disable no-empty */
/* eslint-disable react-hooks/exhaustive-deps */
// src/components/doctor/NotificationsBell.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchNotifications, markNotificationsRead } from "../../api/doctor";

export default function NotificationsBell() {
    const nav = useNavigate();
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [unread, setUnread] = useState(0);

    // toast nhỏ xuất hiện NGAY BÊN DƯỚI chuông khi có notif mới
    const [toast, setToast] = useState(null);
    const toastTimerRef = useRef(null);

    const sinceRef = useRef(null); // ISO của notif mới nhất đã biết
    const prevUnreadRef = useRef(0);
    const boxRef = useRef(null);

    async function load(full = false) {
        try {
            const params = full ? { limit: 30 } : { since: sinceRef.current, limit: 30 };
            const data = await fetchNotifications(params);
            setItems(data.items || []);
            setUnread(data.unread || 0);
            // chỉ cập nhật mốc since khi chạy chế độ nền (polling)
            if (!full && data.items?.length) sinceRef.current = data.items[0].sent_at;

            // số unread tăng -> hiện toast + phát event để trang khác reload
            if ((data.unread || 0) > (prevUnreadRef.current || 0)) {
                showToast("Bạn có thông báo mới.");
                window.dispatchEvent(new Event("tvn-notif"));
            }
            prevUnreadRef.current = data.unread || 0;
        } catch { }
    }

    function showToast(msg) {
        setToast({ msg });
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToast(null), 4000);
    }

    useEffect(() => {
        load();
        const id = setInterval(load, 60_000);
        return () => {
            clearInterval(id);
            clearTimeout(toastTimerRef.current);
        };
    }, []);

    useEffect(() => {
        const h = (e) => {
            if (open && !boxRef.current?.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [open]);

    async function markAll() {
        const ids = items.filter((x) => !x.is_read).map((x) => x.id);
        if (!ids.length) return;
        try {
            setItems(prev => prev.map(x => ({ ...x, is_read: true })));
            setUnread(0);
            await markNotificationsRead(ids);
            await load(true); // nạp lại danh sách đầy đủ
        } catch { }
    }

    function onToastClick() {
        setToast(null);
        setOpen(true);
    }

    function openAppointment(id) {
        setOpen(false);
        // deep-link sang trang lịch hẹn
        nav(`/doctor/appointments?view=${id}`);
    }

    return (
        <div ref={boxRef} style={{ position: "relative" }}>
            {/* Nút chuông + badge */}
            <button
                aria-label="Thông báo"
                title="Thông báo"
                style={S.bell}
                onClick={async () => {
                    setOpen(v => !v);
                    setTimeout(() => load(true), 0); // khi mở dropdown, luôn tải full danh sách để
                }}  
            >
                {/* lucide-bell-ring */}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M10.268 21a2 2 0 0 0 3.464 0" />
                    <path d="M22 8c0-2.3-.8-4.3-2-6" />
                    <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
                    <path d="M4 2C2.8 3.7 2 5.7 2 8" />
                </svg>
                {unread > 0 && (
                    <span style={S.badge}>{unread > 99 ? "99+" : unread}</span>
                )}
            </button>

            {/* Toast NGAY BÊN DƯỚI chuông */}
            {toast && (
                <div style={S.toast} onClick={onToastClick}>
                    <span style={{ marginRight: 6 }}>🔔</span>
                    <span>{toast.msg}</span>
                </div>
            )}

            {/* Dropdown danh sách */}
            {open && (
                <div style={S.dropdown}>
                    <div style={S.header}>
                        <b>Thông báo</b>
                        <button style={S.link} onClick={markAll}>
                            Đánh dấu đã đọc
                        </button>
                    </div>
                    <div style={{ maxHeight: 300, overflow: "auto" }}>
                        {(items || []).map((it) => (
                            <div
                                key={it.id}
                                style={S.item(!it.is_read)}
                                onClick={() => openAppointment(it.appointment_id)}
                            >
                                <div style={S.time}>
                                    {new Date(it.sent_at).toLocaleString("vi-VN", {
                                        hour12: false,
                                    })}
                                </div>
                                <div>{it.message}</div>
                            </div>
                        ))}
                        {(!items || items.length === 0) && (
                            <div style={{ padding: 10, color: "#64748b" }}>
                                Không có thông báo.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

const S = {
    bell: {
        position: "relative",
        display: "grid",
        placeItems: "center",
        border: "1px solid #e2e8f0",
        background: "#fff",
        color: "#0369a1",
        borderRadius: 10,
        width: 36,
        height: 36,
        cursor: "pointer",
    },
    badge: {
        position: "absolute",
        top: -6,
        right: -6,
        background: "#ef4444",
        color: "#fff",
        borderRadius: 999,
        padding: "0 6px",
        fontSize: 11,
        lineHeight: "18px",
        height: 18,
        minWidth: 18,
        textAlign: "center",
        boxShadow: "0 0 0 2px #fff",
    },
    // đặt ngay dưới chuông, lệch phải cho gọn
    toast: {
        position: "absolute",
        top: 42,
        right: 0,
        background: "#0ea5e9",
        color: "#fff",
        borderRadius: 8,
        padding: "6px 10px",
        fontSize: 13,
        boxShadow: "0 8px 24px rgba(2,6,23,.18)",
        cursor: "pointer",
        whiteSpace: "nowrap",
        zIndex: 60,
    },
    dropdown: {
        position: "absolute",
        right: 0,
        top: 44,
        width: 320,
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        boxShadow: "0 10px 30px rgba(2,6,23,.15)",
        zIndex: 50,
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 10px",
        borderBottom: "1px solid #f1f5f9",
    },
    link: { border: "none", background: "transparent", color: "#0ea5e9", cursor: "pointer" },
    item: (unread) => ({
        padding: 10,
        borderBottom: "1px solid #f8fafc",
        background: unread ? "#f0f9ff" : "#fff",
        cursor: "pointer",
    }),
    time: { fontSize: 12, color: "#64748b", marginBottom: 2 },
};
