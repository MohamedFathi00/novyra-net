import React from 'react';

interface NovyraBotProps {
  className?: string;
}

export const NovyraBot: React.FC<NovyraBotProps> = ({ className = 'w-20 h-24 sm:w-24 sm:h-28' }) => {
  return (
    <svg
      viewBox="0 0 110 120"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <ellipse cx="55" cy="108" rx="30" ry="7" fill="#18c8ff" fillOpacity="0.22" />
      <rect x="22" y="14" width="66" height="52" rx="24" fill="#e9ecff" />
      <rect x="30" y="24" width="50" height="32" rx="15" fill="#0a0d33" />
      <circle cx="45" cy="40" r="6" fill="#18c8ff" />
      <circle cx="65" cy="40" r="6" fill="#18c8ff" />
      <rect x="14" y="30" width="8" height="20" rx="4" fill="#18c8ff" />
      <rect x="88" y="30" width="8" height="20" rx="4" fill="#18c8ff" />
      <rect x="32" y="70" width="46" height="34" rx="16" fill="#d9dcf7" />
      <circle cx="55" cy="86" r="5" fill="#18c8ff" />
    </svg>
  );
};
