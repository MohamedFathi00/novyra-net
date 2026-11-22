import React, { useState } from 'react';

interface NovyraLogoProps {
  size?: number;
  className?: string;
}

const ICON_SRC = '/assets/aistudio/Neon_Blue_Ribbon_App_Icon_7d827408.png';

export const NovyraLogo: React.FC<NovyraLogoProps> = ({ size = 44, className = '' }) => {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`group relative nv-logo-float select-none shrink-0 ${className}`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-1 rounded-[28%] bg-gradient-to-tr from-[#18c8ff]/35 via-[#4f46e5]/25 to-[#a855f7]/35 blur-md nv-logo-halo"
        />
        <svg
          width={size}
          height={size}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10 h-full w-full transition-transform duration-300 group-hover:scale-105"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="nv-logo-fallback" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#18c8ff" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          <rect
            x="1"
            y="1"
            width="46"
            height="46"
            rx="11"
            className="fill-[#141a38] stroke-[#2c3470]"
            strokeWidth="1.5"
          />
          <path
            d="M14 35V13h4.5l11 15.5V13H34v22h-4.5L18.5 19.5V35z"
            fill="url(#nv-logo-fallback)"
          />
        </svg>
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={`group relative nv-logo-float select-none shrink-0 ${className}`}
    >
      {/* Breathing neon ambient aura */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-1 rounded-[28%] bg-gradient-to-tr from-[#18c8ff]/45 via-[#3b82f6]/25 to-[#a855f7]/40 blur-md nv-logo-halo transition-opacity duration-300 group-hover:opacity-100"
      />

      {/* Orbital neon rim container */}
      <div className="relative z-10 h-full w-full overflow-hidden rounded-[24%] p-[1.5px] bg-[#09122e] shadow-lg shadow-[#18c8ff]/25 transition-transform duration-300 ease-out group-hover:scale-105">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-[-50%] nv-logo-orbit"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0deg, rgba(24, 200, 255, 0.95) 55deg, rgba(168, 85, 247, 0.85) 115deg, transparent 185deg, rgba(24, 200, 255, 0.35) 260deg, transparent 360deg)',
          }}
        />

        {/* Inner masked icon + diagonal light sheen */}
        <div className="relative h-full w-full overflow-hidden rounded-[22%] bg-[#040714]">
          <img
            src={ICON_SRC}
            alt="NOVYRA Net"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover scale-[1.16] transition-transform duration-500 ease-out group-hover:scale-[1.2] select-none"
            draggable={false}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 nv-logo-sheen"
            style={{
              background:
                'linear-gradient(105deg, transparent 10%, rgba(24, 200, 255, 0.28) 45%, rgba(255, 255, 255, 0.45) 50%, rgba(168, 85, 247, 0.24) 55%, transparent 90%)',
            }}
          />
        </div>
      </div>
    </div>
  );
};
