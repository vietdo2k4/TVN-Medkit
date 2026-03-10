export function IconSpecialty({ size = 18, color = "#47627b" }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {/* Ống nghe y tế (stethoscope) - giống hệt icon đầu tiên trong ảnh 2 */}
            <path d="M12 2v8" />
            <path d="M8 6h8" />
            <circle cx="12" cy="14" r="6" />
            <path d="M18 14h3a1 1 0 0 1 1 1v1a2 2 0 0 1-2 2h-1" />
            <path d="M6 14H3a1 1 0 0 0-1 1v1a2 2 0 0 0 2 2h1" />
            <path d="M12 20v2" />
        </svg>
    );
}

export function IconFee({ size = 18, color = "#47627b" }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {/* Ví tiền với dấu $ - giống hệt icon thứ 2 trong ảnh 2 */}
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <line x1="3" y1="11" x2="21" y2="11" />
            <circle cx="12" cy="15" r="2" />
            <path d="M10 8h4" />
            <path d="M12 6v4" />
            <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="bold" fill={color}>$</text>
        </svg>
    );
}

export function IconHospital({ size = 18, color = "#47627b" }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {/* Tòa nhà bệnh viện với dấu + - giống hệt icon thứ 3 trong ảnh 2 */}
            <path d="M4 4h16v16H4z" />
            <path d="M8 2v4" />
            <path d="M16 2v4" />
            <path d="M2 8h4" />
            <path d="M18 8h4" />
            <path d="M10 10h4" />
            <path d="M12 8v4" />
            <rect x="9" y="14" width="6" height="6" rx="1" />
            <path d="M11 16h2" />
            <path d="M12 15v2" />
        </svg>
    );
}

export function IconLocation({ size = 18, color = "#47627b" }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
        </svg>
    );
}

export function IconPhone({ size = 18, color = "#47627b" }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
    );
}