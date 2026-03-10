export default function AIBotLogo({ size = 56 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden="true">
            <defs>
                {/* Gradient cho phần mũ/nón đầu */}
                <linearGradient id="headGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#93c5fd" />
                    <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>

                {/* Highlight bóng trên mũ */}
                <radialGradient id="highlight">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </radialGradient>
            </defs>

            {/* BỎ nền tròn xanh → logo sẽ trong suốt, chỉ hiện nhân vật trên nền nút xanh của .assistant-fab */}

            {/* Mặt trắng - phần thân chính (phóng to toàn bộ) */}
            <circle cx="28" cy="30" r="16" fill="#f8fafc" />

            {/* Phần mũ/nón màu xanh với độ bóng */}
            <path d="M14 20 Q28 8, 42 20 Q45 28, 42 30 L14 30 Q11 28, 14 20 Z" fill="url(#headGrad)" />
            <ellipse cx="22" cy="15" rx="6" ry="4" fill="url(#highlight)" opacity="0.7" />

            {/* Tai nghe - phần xanh đậm hai bên đầu */}
            <path d="M11 25 Q6 30, 9 38 L12 38 Q13 32, 11 25 Z" fill="#1e40af" />
            <path d="M45 25 Q50 30, 47 38 L44 38 Q43 32, 45 25 Z" fill="#1e40af" />

            {/* Mắt dễ thương, to hơn */}
            <circle cx="20" cy="27" r="4.5" fill="#0f172a" />
            <circle cx="36" cy="27" r="4.5" fill="#0f172a" />
            <circle cx="21.5" cy="25.5" r="1.5" fill="#ffffff" opacity="0.9" />
            <circle cx="37.5" cy="25.5" r="1.5" fill="#ffffff" opacity="0.9" />

            {/* Miệng cười nhẹ nhàng */}
            <path d="M18 35 Q28 40, 38 35" stroke="#0f172a" strokeWidth="2.5" fill="none" strokeLinecap="round" />

            {/* Ống nghe y tế cách điệu (stethoscope) - phần đặc trưng y tế */}
            <path d="M20 42 Q28 50, 36 42" fill="none" stroke="#2563eb" strokeWidth="5" strokeLinecap="round" />
            <path d="M22 44 Q28 52, 34 44" fill="none" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
            <circle cx="16" cy="41" r="3" fill="#1e40af" />
            <circle cx="40" cy="41" r="3" fill="#1e40af" />

            {/* Điểm sáng nhỏ trên mũ để tăng độ hiện đại */}
            <circle cx="34" cy="13" r="3" fill="#ffffff" opacity="0.6" />
        </svg>
    );
}