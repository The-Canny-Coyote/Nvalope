export function CoyoteIcon({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Friendly tech-styled coyote head */}
      
      {/* Ears - rounded and friendly */}
      <path
        d="M20 14 C20 10, 22 8, 24 8 C26 8, 28 10, 28 14 L24 18 Z"
        fill="#8b6944"
        stroke="#8b6944"
        strokeWidth="1"
      />
      <path
        d="M44 14 C44 10, 42 8, 40 8 C38 8, 36 10, 36 14 L40 18 Z"
        fill="#8b6944"
        stroke="#8b6944"
        strokeWidth="1"
      />
      
      {/* Small circuit accent in ears */}
      <circle cx="24" cy="12" r="1.5" fill="#66bb6a" />
      <circle cx="40" cy="12" r="1.5" fill="#66bb6a" />
      
      {/* Head - rounded and friendly */}
      <ellipse
        cx="32"
        cy="30"
        rx="18"
        ry="20"
        fill="#c4a57b"
        stroke="#8b6944"
        strokeWidth="2"
      />
      
      {/* Inner face shading */}
      <ellipse
        cx="32"
        cy="32"
        rx="14"
        ry="16"
        fill="#a68a64"
        opacity="0.5"
      />
      
      {/* Eyes - big and friendly with sparkle */}
      <ellipse cx="26" cy="28" rx="4" ry="5" fill="#0a0e0d" />
      <ellipse cx="38" cy="28" rx="4" ry="5" fill="#0a0e0d" />
      
      {/* Eye sparkles */}
      <circle cx="27" cy="26.5" r="1.5" fill="#66bb6a" />
      <circle cx="39" cy="26.5" r="1.5" fill="#66bb6a" />
      <circle cx="25.5" cy="29" r="0.8" fill="white" />
      <circle cx="37.5" cy="29" r="0.8" fill="white" />
      
      {/* Eyebrows - friendly expression */}
      <path
        d="M22 24 Q26 22, 30 24"
        stroke="#0a0e0d"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M34 24 Q38 22, 42 24"
        stroke="#0a0e0d"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        opacity="0.6"
      />
      
      {/* Nose - small and cute */}
      <circle
        cx="32"
        cy="34"
        r="2.5"
        fill="#0a0e0d"
      />
      
      {/* Friendly smile */}
      <path
        d="M32 36 Q28 38, 24 37"
        stroke="#0a0e0d"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M32 36 Q36 38, 40 37"
        stroke="#0a0e0d"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      
      {/* Cheek blush - makes it more friendly */}
      <ellipse cx="20" cy="32" rx="3" ry="2" fill="#43a047" opacity="0.3" />
      <ellipse cx="44" cy="32" rx="3" ry="2" fill="#43a047" opacity="0.3" />
      
      {/* Tech circuit pattern details - subtle */}
      <circle cx="18" cy="26" r="1" fill="#1b5e20" opacity="0.6" />
      <circle cx="46" cy="26" r="1" fill="#1b5e20" opacity="0.6" />
      <line x1="18" y1="26" x2="20" y2="28" stroke="#1b5e20" strokeWidth="0.5" opacity="0.6" />
      <line x1="46" y1="26" x2="44" y2="28" stroke="#1b5e20" strokeWidth="0.5" opacity="0.6" />
      
      {/* Collar with tech chip */}
      <path
        d="M24 46 L32 50 L40 46"
        fill="#1b5e20"
        stroke="#66bb6a"
        strokeWidth="1.5"
      />
      <rect x="30" y="46" width="4" height="3" fill="#66bb6a" rx="0.5" />
      <circle cx="32" cy="47.5" r="0.8" fill="#0a0e0d" />
    </svg>
  );
}