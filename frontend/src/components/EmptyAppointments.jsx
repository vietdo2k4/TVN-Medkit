export default function EmptyAppointments({ text = "Bạn chưa có phiếu khám nào" }) {
    return (
        <div className="empty-state">
            <svg
                className="empty-illust"
                viewBox="0 0 640 420"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
            >
               
                <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ecf8ff" />
                        <stop offset="100%" stopColor="#e6f6ff" />
                    </linearGradient>
                    <linearGradient id="gBlue" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#31c2ff" />
                        <stop offset="100%" stopColor="#1fb1f5" />
                    </linearGradient>
                </defs>

                <circle cx="320" cy="210" r="190" fill="url(#g1)" />

               
                <g opacity="0.95">
                    <rect x="220" y="80" width="230" height="220" rx="16" fill="#ffffff" />
                    <rect x="220" y="80" width="230" height="22" rx="11" fill="url(#gBlue)" />
                    <rect x="260" y="130" width="150" height="14" rx="7" fill="#bfe9ff" />
                    <rect x="260" y="160" width="180" height="14" rx="7" fill="#bfe9ff" />
                    <rect x="260" y="190" width="170" height="14" rx="7" fill="#d6f2ff" />
                    <ellipse cx="335" cy="280" rx="95" ry="18" fill="#eef9ff" />
                </g>

             
                <g opacity="0.9">
                    <rect x="190" y="170" width="110" height="150" rx="14" fill="#f6fbff" />
                    <rect x="210" y="190" width="32" height="20" rx="10" fill="#bfe9ff" />
                    <rect x="215" y="225" width="70" height="10" rx="5" fill="#cfefff" />
                    <rect x="215" y="245" width="70" height="10" rx="5" fill="#cfefff" />
                    <rect x="215" y="265" width="70" height="10" rx="5" fill="#e2f6ff" />
                </g>

               
                <g opacity="0.85">
                    <rect x="390" y="18" width="110" height="70" rx="14" fill="#f2fbff" />
                    <circle cx="420" cy="54" r="7" fill="#91defe" />
                    <circle cx="445" cy="54" r="7" fill="#91defe" />
                    <circle cx="470" cy="54" r="7" fill="#91defe" />
                </g>

              
                <g fill="#bfe9ff">
                    <circle cx="250" cy="28" r="6" />
                    <circle cx="528" cy="98" r="8" />
                    <path d="M138 64l8-18 8 18 18 8-18 8-8 18-8-18-18-8 18-8z" opacity=".5" />
                    <path d="M445 350l8-18 8 18 18 8-18 8-8 18-8-18-18-8 18-8z" opacity=".5" />
                </g>

              
                <g transform="translate(0,0)">
               
                    <circle cx="365" cy="220" r="105" fill="#ffffff" stroke="url(#gBlue)" strokeWidth="24" />
             
                    <g stroke="#ff4a4a" strokeWidth="22" strokeLinecap="round">
                        <line x1="325" y1="180" x2="405" y2="260" />
                        <line x1="405" y1="180" x2="325" y2="260" />
                    </g>
                    
                    <line x1="436" y1="290" x2="515" y2="365"
                        stroke="url(#gBlue)" strokeWidth="34" strokeLinecap="round" />
                </g>
            </svg>

            <p className="muted">{text}</p>
        </div>
    );
}
