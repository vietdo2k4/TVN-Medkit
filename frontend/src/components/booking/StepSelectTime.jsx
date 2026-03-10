
import { useEffect, useMemo, useRef, useState } from "react";
import { createHold, releaseHold } from "../../api/booking";
import "../../styles/step-select-time.css";

//Helper: Chuyển Date object thành chuỗi "YYYY-MM-DD" (GMT+7)
function toISODateLocal(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
}

//Helper: Hiện thông báo tạm thời
function toast(msg) {
    if (window?.toast?.show) window.toast.show(msg);
    else alert(msg);
}

//Component chính: Chọn ngày và giờ khám (calendar + slots)
export default function StepSelectTime({
    todayISO,
    maxISO,
    selectedDate,
    onDateChange,
    slots = [],           // [{scheduleId,time,session,booked}]
    onSelectSlot,
    selectedSlot,
    onNext,
    onNeedRefresh,        // <<< NEW: yêu cầu parent làm mới slots
}) {
    //Ref lưu scheduleId đang được "hold" (giữ chỗ tạm thời)
    const heldRef = useRef(null);
    //Ref lưu ngày trước đó để detect thay đổi
    const prevDateRef = useRef(selectedDate);

    const baseTodayISO = todayISO || toISODateLocal(new Date());
    const baseMaxISO = maxISO || toISODateLocal(new Date(Date.now() + 60 * 86400000));

    const todayObj = useMemo(() => new Date(`${baseTodayISO}T00:00:00`), [baseTodayISO]);
    const maxObj = useMemo(() => new Date(`${baseMaxISO}T00:00:00`), [baseMaxISO]);

    //State: Tháng đang hiển thị trên calendar
    const [viewMonth, setViewMonth] = useState(() => {
        const d = selectedDate ? new Date(selectedDate) : todayObj;
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });

    const bcRef = useRef(null); // BroadcastChannel

    // Lắng nghe tín hiệu refresh từ tab khác (đặt lịch, hủy…)
    //BroadcastChannel: Đồng bộ real-time giữa các tab/cửa sổ browser
    useEffect(() => {
        try {
            bcRef.current = new BroadcastChannel("tvnmedkit-slots");
            const h = (ev) => { if (ev?.data === "refresh-slots") onNeedRefresh?.(); };
            bcRef.current.addEventListener("message", h);
            return () => bcRef.current?.close();
        } catch { /* Safari private mode: bỏ qua */ }
    }, [onNeedRefresh]);

    // Làm mới khi tab được focus lại (người dùng quay lại tab)
    useEffect(() => {
        const h = () => onNeedRefresh?.();
        window.addEventListener("focus", h, { passive: true });
        return () => window.removeEventListener("focus", h);
    }, [onNeedRefresh]);

    //Polling: Refresh slots mỗi 3s để cập nhật trạng thái real-time
    useEffect(() => {
        let i = setInterval(() => onNeedRefresh?.(), 3000); // 3s để "mất" gần như ngay giữa các trình duyệt/ẩn danh
        return () => clearInterval(i);
    }, [onNeedRefresh]);

    //Đồng bộ viewMonth khi selectedDate thay đổi từ parent
    useEffect(() => {
        if (selectedDate) {
            const d = new Date(selectedDate);
            setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
        }
    }, [selectedDate]);

    // Thả giữ khi unmount (component bị xóa khỏi DOM)
    useEffect(() => {
        return () => {
            if (heldRef.current) releaseHold(heldRef.current).catch(() => { });
        };
    }, []);

    // Nếu parent đổi selectedDate từ ngoài → cũng thả giữ
    useEffect(() => {
        if (prevDateRef.current !== selectedDate && heldRef.current) {
            releaseHold(heldRef.current).catch(() => { });
            heldRef.current = null;
            onSelectSlot?.(null);
        }
        prevDateRef.current = selectedDate;
    }, [selectedDate, onSelectSlot]);

    //Tính toán 42 ô (6 tuần x 7 ngày) cho calendar
    const cells = useMemo(() => {
        const start = new Date(viewMonth);
        const firstDow = start.getDay(); // Sun=0..Sat=6
        start.setDate(start.getDate() - firstDow);
        const arr = [];
        for (let i = 0; i < 42; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            const iso = toISODateLocal(d);
            const isOutMonth = d.getMonth() !== viewMonth.getMonth();
            const isPast = iso < baseTodayISO;
            const afterMax = iso > baseMaxISO;
            const isToday = iso === baseTodayISO;
            const isEnabled = !isPast && !afterMax && !isOutMonth;
            arr.push({ d, iso, isOutMonth, isPast, afterMax, isToday, isEnabled });
        }
        return arr;
    }, [viewMonth, baseTodayISO, baseMaxISO]);

    //State: Thu/mở calendar (khi đã chọn ngày thì tự động thu gọn)
    const [collapsed, setCollapsed] = useState(Boolean(selectedDate));

    //Hàm xử lý khi người dùng chọn 1 ngày trên calendar
    const handlePick = (iso) => {
        // Đổi ngày → THẢ giữ mềm (nếu có), không giữ khi chọn ngày
        if (heldRef.current) {
            releaseHold(heldRef.current).catch(() => { });
            heldRef.current = null;
            onSelectSlot?.(null);
        }
        onDateChange?.(iso);
        setCollapsed(true);
    };

    //Hàm xử lý khi người dùng chọn 1 slot (giờ khám)
    async function pickSlot(s) {
        // Nếu đang giữ slot khác → thả trước
        if (heldRef.current && heldRef.current !== s.scheduleId) {


            try { await releaseHold(heldRef.current); } catch { /* empty */ }
            heldRef.current = null;
        }
        // Giữ mềm (firm=false) khi CHỌN giờ (giữ tạm thời, chưa confirm)
        try {
            await createHold({ scheduleId: s.scheduleId, firm: false });
            heldRef.current = s.scheduleId;
            onSelectSlot?.(s);
        } catch (e) {
            toast(e?.message || "Khung giờ đã có người chọn, vui lòng chọn giờ khác.");
            onNeedRefresh?.(); // <<< yêu cầu parent reload slots ngay
        }
    }

    // Ẩn hẳn slot đã có người đặt (lọc ra chỉ còn slot trống)
    const morning = slots.filter((s) => s.session === "morning" && (s.booked !== true));
    const afternoon = slots.filter((s) => s.session === "afternoon" && (s.booked !== true));
    const evening = slots.filter(s => s.session === "evening" && s.booked !== true);

    return (
        <div className="step-select">
            <div className="cal-header">
                <div className="cal-title">Vui lòng chọn ngày khám</div>
                <div className="cal-nav">
                    <button
                        type="button"
                        aria-label="Prev"
                        className="cal-arrow"
                        onClick={() =>
                            setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))
                        }
                        disabled={
                            new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1) <
                            new Date(todayObj.getFullYear(), todayObj.getMonth(), 1)
                        }
                    >
                        ←
                    </button>
                    <div className="cal-month">
                        THÁNG {String(viewMonth.getMonth() + 1).padStart(2, "0")}-{viewMonth.getFullYear()}
                    </div>
                    <button
                        type="button"
                        aria-label="Next"
                        className="cal-arrow"
                        onClick={() =>
                            setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))
                        }
                        disabled={
                            new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1) >
                            new Date(maxObj.getFullYear(), maxObj.getMonth(), 1)
                        }
                    >
                        →
                    </button>
                </div>
            </div>

            <div className={"calendar" + (collapsed ? " calendar--collapsed" : "")}>
                <div className="cal-grid cal-grid--dow">
                    {["CN", "Hai", "Ba", "Tư", "Năm", "Sáu", "Bảy"].map((d) => (
                        <div key={d} className="cal-dow">{d}</div>
                    ))}
                </div>
                <div className="cal-grid">
                    {cells.map((c) => {
                        const isSelected = selectedDate === c.iso;
                        const cls =
                            "cal-cell" +
                            (c.isOutMonth ? " out" : "") +
                            (c.isPast ? " past" : "") +
                            (c.afterMax ? " past" : "") +
                            (c.isToday ? " today" : "") +
                            (isSelected ? " selected" : "") +
                            (c.isEnabled ? " enabled" : " disabled");
                        return (
                            <button
                                type="button"
                                key={c.iso}
                                className={cls}
                                onClick={() => c.isEnabled && handlePick(c.iso)}
                                disabled={!c.isEnabled}
                            >
                                {String(c.d.getDate()).padStart(2, "0")}
                            </button>
                        );
                    })}
                </div>
            </div>

            {selectedDate && (
                <div className="slots-wrap">
                    <div className="slots-bar">
                        <div className="slots-title">Ngày {selectedDate.split("-").reverse().join("/")}</div>
                        <button type="button" className="toggle-calendar" onClick={() => setCollapsed(v => !v)}>
                            {collapsed ? "Mở lịch" : "Đóng"}
                        </button>
                    </div>

                    {morning.length === 0 && afternoon.length === 0 && evening.length === 0 ? (
                        <div className="no-slots">Ngày này không còn lịch trống</div>
                    ) : (
                        <>
                            {morning.length > 0 && (
                                <>
                                    <div className="session-title">Buổi sáng</div>
                                    <div className="slots">
                                        {morning.map((s) => {
                                            const active = selectedSlot && selectedSlot.scheduleId === s.scheduleId;
                                            const cls = "slot" + (active ? " active" : "") + (s.held ? " held" : "");
                                            return (
                                                <button
                                                    key={s.scheduleId}
                                                    type="button"
                                                    className={cls}
                                                    onClick={() => pickSlot(s)}
                                                >
                                                    {s.time}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>
                            )}

                            {afternoon.length > 0 && (
                                <>
                                    <div className="session-title">Buổi chiều</div>
                                    <div className="slots">
                                        {afternoon.map((s) => {
                                            const active = selectedSlot && selectedSlot.scheduleId === s.scheduleId;
                                            const cls = "slot" + (active ? " active" : "") + (s.held ? " held" : "");
                                            return (
                                                <button
                                                    key={s.scheduleId}
                                                    type="button"
                                                    className={cls}
                                                    onClick={() => pickSlot(s)}
                                                >
                                                    {s.time}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>
                            )}

                            {evening.length > 0 && (
                                <>
                                    <div className="session-title">Buổi tối</div>
                                    <div className="slots">
                                        {evening.map((s) => {
                                            const active = selectedSlot && selectedSlot.scheduleId === s.scheduleId;
                                            const cls = "slot" + (active ? " active" : "") + (s.held ? " held" : "");
                                            return (
                                                <button
                                                    key={s.scheduleId}
                                                    type="button"
                                                    className={cls}
                                                    onClick={() => pickSlot(s)}
                                                >
                                                    {s.time}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>
                            )}



                        </>
                    )}

                    <div className="actions">
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={async () => {
                                try {
                                    //Khi nhấn "Tiếp tục", nâng cấp hold từ "mềm" lên "cứng" (firm=true)
                                    if (heldRef.current) {
                                        await createHold({ scheduleId: heldRef.current, firm: true });
                                    }
                                } catch (e) {
                                    toast(e?.message || "Khung giờ vừa có thay đổi. Vui lòng chọn khung giờ khác.");
                                    onNeedRefresh?.(); // <<< yêu cầu reload ngay
                                    return;
                                }
                                onNext?.();
                            }}
                            disabled={!selectedSlot}
                        >
                            Tiếp tục
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ========================================================================
   📚 GIẢI THÍCH LOGIC VÀ CÁCH CHẠY FILE StepSelectTime.jsx
   ========================================================================

   🎯 MỤC ĐÍCH CHÍNH:
   Component này cho phép người dùng chọn ngày và giờ khám bệnh với cơ chế
   "hold" (giữ chỗ tạm thời) để tránh double booking (2 người đặt cùng 1 slot).

   📋 LUỒNG HOẠT ĐỘNG CHÍNH:

   1. HIỂN THỊ CALENDAR (Lịch chọn ngày)
   ----------------------------------------
   - Component nhận props `todayISO` và `maxISO` để xác định ngày hợp lệ.
   - Tính toán 42 ô (6 tuần x 7 ngày) bằng hàm `useMemo(() => cells)`.
   - Từng ô có trạng thái:
     * `isEnabled`: Có thể chọn (không phải quá khứ, không quá xa tương lai)
     * `isToday`: Là ngày hôm nay
     * `isSelected`: Đang được chọn
     * `isPast/afterMax`: Disable (màu xám)

   2. CHỌN NGÀY (handlePick)
   --------------------------
   - Khi user click vào 1 ngày:
     a. NẾU đang có slot được hold → Gọi `releaseHold()` để thả hold cũ
     b. Reset `selectedSlot` về null
     c. Gọi `onDateChange(iso)` → Parent (DoctorDetailPage) nhận ngày mới
        → Parent gọi API lấy danh sách slots cho ngày đó
     d. Tự động thu gọn calendar (`setCollapsed(true)`)

   3. HIỂN THỊ SLOTS (Khung giờ khám)
   -----------------------------------
   - Parent truyền xuống mảng `slots` = [{scheduleId, time, session, booked}]
   - Component lọc ra:
     * Buổi sáng:   `session === "morning" && !booked`
     * Buổi chiều:  `session === "afternoon" && !booked`
     * Buổi tối:    `session === "evening" && !booked`
   - Ẩn hẳn các slot đã có người đặt (`booked === true`)

   4. Cơ CHẾ "HOLD" (Giữ chỗ) - 2 MỨC ĐỘ
   ----------------------------------------
   a. SOFT HOLD (firm=false) - Khi CHỌN slot:
      - User click vào 1 slot → Gọi `pickSlot(s)`
      - Gọi API `createHold({ scheduleId, firm: false })`
      - Lưu vào `heldRef.current` để nhớ slot đang giữ
      - LÚC NÀY: Slot chỉ được giữ TẠM THỜI, người khác vẫn thấy nhưng
        không đặt được (backend sẽ kiểm tra)
   
   b. FIRM HOLD (firm=true) - Khi nhấn "Tiếp tục":
      - User nhấn button "Tiếp tục"
      - Gọi lại `createHold({ scheduleId, firm: true })` để NÂNG CẤP hold
      - Sau đó gọi `onNext()` → Chuyển sang CheckoutPage
      - CheckoutPage sẽ tiếp tục giữ slot này cho đến khi hoàn tất booking

   5. REAL-TIME SYNCHRONIZATION (Đồng bộ thời gian thực)
   -------------------------------------------------------
   Component sử dụng 3 cơ chế để cập nhật slot real-time:
   
   a. POLLING (Tự động làm mới):
      ```javascript
      setInterval(() => onNeedRefresh?.(), 3000);
      ```
      → Mỗi 3 giây gọi lại API lấy slots mới
   
   b. BROADCAST CHANNEL (Đồng bộ giữa các tab):
      - Khi tab A đặt lịch xong → Broadcast event "refresh-slots"
      - Tab B nhận được → Gọi `onNeedRefresh()` → Cập nhật slots
   
   c. WINDOW FOCUS (Khi quay lại tab):
      - User chuyển qua tab khác rồi quay lại
      - Event "focus" trigger → Gọi `onNeedRefresh()`

   6. XỬ LÝ TRƯỜNG HỢP XUNG ĐỘT
   -----------------------------
   - Nếu user A đang hold slot, user B cũng cố chọn slot đó:
     → Backend trả về lỗi 409 Conflict
     → Frontend hiện toast: "Khung giờ đã có người chọn"
     → Tự động reload slots (`onNeedRefresh()`)
   
   - Nếu user đang hold mềm, đổi ngày:
     → Tự động `releaseHold()` slot cũ trước khi đổi

   7. CLEANUP (Dọn dẹp)
   ---------------------
   - Khi component unmount (bị xóa khỏi DOM):
     → `useEffect cleanup` tự động gọi `releaseHold()`
     → Đảm bảo không giữ slot vô thời hạn nếu user thoát trang

   ⚠️ ĐIỂM QUAN TRỌNG KHI BẢO VỆ:
   --------------------------------
   1. "Tại sao cần 2 loại hold (soft/firm)?"
      → Soft hold: Giữ tạm khi đang chọn, tránh tranh chấp
      → Firm hold: Giữ chắc chắn khi sang trang thanh toán

   2. "Làm sao tránh 2 người đặt cùng 1 slot?"
      → Backend check hold status trước khi cho phép tạo hold mới
      → Frontend polling + BroadcastChannel cập nhật real-time

   3. "Tại sao dùng BroadcastChannel?"
      → Để các tab browser khác nhau của cùng 1 user đồng bộ
      → User mở 2 tab → Tab 1 đặt xong → Tab 2 tự động thấy slot đã hết

   4. "useRef dùng để làm gì?"
      → `heldRef`: Lưu scheduleId đang hold (không trigger re-render)
      → `prevDateRef`: Lưu ngày trước đó để so sánh thay đổi
      → `bcRef`: Lưu BroadcastChannel instance để cleanup sau

   ======================================================================== */
