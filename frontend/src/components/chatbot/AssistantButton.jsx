import { useEffect, useState } from "react";
import AssistantBoxchat from "./AssistantBoxchat";
import "../../styles/assistant.css";
import AIBotLogo from "./AIBotLogo";

const TIP_INTERVAL_MS = 10 * 60 * 1000;

export default function AssistantButton() {
    const [open, setOpen] = useState(false);
    const [tip, setTip] = useState(false);

    useEffect(() => {
        const h = () => setOpen(true);
        window.addEventListener("open-assistant", h);
        return () => window.removeEventListener("open-assistant", h);
    }, []);

    // Toast nhắc nhẹ sau 10p
    useEffect(() => {
        const id = setInterval(() => {
            if (!open) setTip(true);
        }, TIP_INTERVAL_MS);
        return () => clearInterval(id);
    }, [open]);

    const openChat = () => {
        setOpen(true);
        setTip(false);
    };

    return (
        <>
            <button
                type="button"
                className="assistant-fab"
                aria-label="Trợ lý AI y tế"
                title="Trợ lý AI y tế"
                onClick={openChat}
            >
                <span className="assistant-fab__pulse" />
                <AIBotLogo />
            </button>

            {tip && !open && (
                <div className="assistant-tip" role="status">
                    <button
                        className="assistant-tip__close"
                        aria-label="Đóng"
                        title="Đóng"
                        onClick={() => setTip(false)}
                    >
                        {/* icon X */}
                        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                            <path fill="currentColor" d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z" />
                        </svg>
                    </button>
                    <div className="assistant-tip__text">
                        Hỏi triệu chứng, tôi gợi ý bệnh viện, chuyên khoa, bác sĩ.
                    </div>
                </div>
            )}

            {open && <AssistantBoxchat onClose={() => setOpen(false)} />}
        </>
    );
}
