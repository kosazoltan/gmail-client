interface ZMailLogoProps {
  size?: number;
  className?: string;
}

export function ZMailLogo({ size = 24, className = '' }: ZMailLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      aria-label="ZMail logo"
    >
      {/* Envelope body */}
      <rect x="4" y="10" width="40" height="28" rx="3" fill="#3B82F6" />
      {/* Envelope flap */}
      <path
        d="M4 13L24 26L44 13"
        stroke="#1E40AF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Z letter */}
      <path
        d="M16 18H32L16 30H32"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Shine effect */}
      <ellipse cx="38" cy="14" rx="3" ry="2" fill="white" opacity="0.3" />
    </svg>
  );
}
