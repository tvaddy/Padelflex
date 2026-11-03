'use client';

import React from 'react';

type PadelLogoProps = {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  textClassName?: string;
};

export default function PadelLogo({
  className = '',
  size = 'md',
  showText = true,
  textClassName = '',
}: PadelLogoProps) {
  const iconSizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9 sm:w-10 sm:h-10',
    lg: 'w-12 h-12 sm:w-14 sm:h-14',
  }[size];

  return (
    <div className={`flex items-center gap-2.5 sm:gap-3 select-none ${className}`}>
      {/* Padel Racket & Ball Icon */}
      <div
        className={`${iconSizeClasses} rounded-2xl bg-gradient-to-br from-[#1c1c1c] via-[#121212] to-black border border-[#BFFF00]/30 shadow-[0_0_20px_rgba(191,255,0,0.25)] flex items-center justify-center p-1.5 shrink-0 relative overflow-hidden group`}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Padel Racket Head */}
          <g transform="rotate(-30 50 50)">
            {/* Racket Frame */}
            <rect
              x="28"
              y="12"
              width="44"
              height="50"
              rx="22"
              fill="#242424"
              stroke="#BFFF00"
              strokeWidth="4"
            />
            {/* Inner Racket Face */}
            <rect
              x="33"
              y="17"
              width="34"
              height="40"
              rx="17"
              fill="#181818"
            />
            {/* Perforated Padel Holes Grid */}
            <circle cx="43" cy="27" r="2.2" fill="#BFFF00" opacity="0.9" />
            <circle cx="50" cy="27" r="2.2" fill="#BFFF00" opacity="0.9" />
            <circle cx="57" cy="27" r="2.2" fill="#BFFF00" opacity="0.9" />

            <circle cx="40" cy="34" r="2.2" fill="#BFFF00" opacity="0.9" />
            <circle cx="46.5" cy="34" r="2.2" fill="#BFFF00" opacity="0.9" />
            <circle cx="53.5" cy="34" r="2.2" fill="#BFFF00" opacity="0.9" />
            <circle cx="60" cy="34" r="2.2" fill="#BFFF00" opacity="0.9" />

            <circle cx="40" cy="41" r="2.2" fill="#BFFF00" opacity="0.9" />
            <circle cx="46.5" cy="41" r="2.2" fill="#BFFF00" opacity="0.9" />
            <circle cx="53.5" cy="41" r="2.2" fill="#BFFF00" opacity="0.9" />
            <circle cx="60" cy="41" r="2.2" fill="#BFFF00" opacity="0.9" />

            <circle cx="43" cy="48" r="2.2" fill="#BFFF00" opacity="0.9" />
            <circle cx="50" cy="48" r="2.2" fill="#BFFF00" opacity="0.9" />
            <circle cx="57" cy="48" r="2.2" fill="#BFFF00" opacity="0.9" />

            {/* Throat / Neck */}
            <path
              d="M42 62 L45 70 L55 70 L58 62 Z"
              fill="#2E2E2E"
              stroke="#BFFF00"
              strokeWidth="2"
            />

            {/* Handle */}
            <rect
              x="46"
              y="70"
              width="8"
              height="22"
              rx="3"
              fill="#121212"
              stroke="#888888"
              strokeWidth="1.5"
            />
            {/* Handle Grip Ribs */}
            <line x1="46" y1="74" x2="54" y2="76" stroke="#BFFF00" strokeWidth="1" opacity="0.8" />
            <line x1="46" y1="78" x2="54" y2="80" stroke="#BFFF00" strokeWidth="1" opacity="0.8" />
            <line x1="46" y1="82" x2="54" y2="84" stroke="#BFFF00" strokeWidth="1" opacity="0.8" />
            <line x1="46" y1="86" x2="54" y2="88" stroke="#BFFF00" strokeWidth="1" opacity="0.8" />
          </g>

          {/* Glowing Neon Padel Ball */}
          <g transform="translate(62, 58)">
            <circle
              cx="12"
              cy="12"
              r="11"
              fill="#BFFF00"
              stroke="#0A0A0A"
              strokeWidth="1.5"
            />
            {/* Ball Seam Curved Line */}
            <path
              d="M3 12 C 7 6, 17 6, 21 12 C 17 18, 7 18, 3 12"
              stroke="#0A0A0A"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
          </g>
        </svg>
      </div>

      {showText && (
        <div className={`min-w-0 ${textClassName}`}>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="font-extrabold tracking-tight text-base sm:text-lg text-white">
              PADEL<span className="text-[#BFFF00]">FLEX</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
