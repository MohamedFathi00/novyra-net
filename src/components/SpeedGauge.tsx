import React from 'react';
import type { SpeedTestPhase } from '../types/network';

interface SpeedGaugeProps {
  speedMbps: number;
  phase: SpeedTestPhase;
  phaseLabel: string;
  unitLabel: string;
  animationsEnabled?: boolean;
}

const SCALE_STOPS = [0, 10, 25, 50, 100, 250, 500];
const START_ANGLE = -135;
const END_ANGLE = 135;
const TOTAL_SPAN = END_ANGLE - START_ANGLE;

function speedToNormalized(mbps: number): number {
  if (mbps <= 0) return 0;
  if (mbps >= 500) return 1;
  for (let i = 0; i < SCALE_STOPS.length - 1; i++) {
    const low = SCALE_STOPS[i];
    const high = SCALE_STOPS[i + 1];
    if (mbps <= high) {
      const segStart = i / (SCALE_STOPS.length - 1);
      const segSpan = 1 / (SCALE_STOPS.length - 1);
      const frac = (mbps - low) / (high - low);
      return segStart + frac * segSpan;
    }
  }
  return 1;
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return ['M', start.x, start.y, 'A', radius, radius, 0, largeArc, 0, end.x, end.y].join(' ');
}

export const SpeedGauge: React.FC<SpeedGaugeProps> = ({
  speedMbps,
  phase,
  phaseLabel,
  unitLabel,
  animationsEnabled = true,
}) => {
  const normalized = speedToNormalized(speedMbps);
  const activeAngle = START_ANGLE + normalized * TOTAL_SPAN;

  const cx = 200;
  const cy = 185;
  const r = 144;

  const fullArc = describeArc(cx, cy, r, START_ANGLE, END_ANGLE);
  const activeArc = normalized > 0.005 ? describeArc(cx, cy, r, START_ANGLE, activeAngle) : '';

  const isUpload = phase === 'upload';
  const isActive = phase === 'download' || phase === 'upload' || phase === 'ping';

  const needleTip = polarToCartesian(cx, cy, 102, activeAngle);
  const needleLeft = polarToCartesian(cx, cy, 8, activeAngle - 90);
  const needleRight = polarToCartesian(cx, cy, 8, activeAngle + 90);

  return (
    <div className="relative flex flex-col items-center justify-center w-full select-none">
      <svg
        viewBox="0 0 400 315"
        className="w-full max-w-[360px] sm:max-w-[390px] overflow-visible"
        role="img"
        aria-label={`${speedMbps.toFixed(2)} ${unitLabel}`}
      >
        <defs>
          <linearGradient id="nv-gauge-arc" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#1d8bff" />
            <stop offset="45%" stopColor="#18c8ff" />
            <stop offset="72%" stopColor="#6d4cff" />
            <stop offset="100%" stopColor="#e040fb" />
          </linearGradient>
          <linearGradient id="nv-gauge-upload" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#5b3df5" />
            <stop offset="55%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#e040fb" />
          </linearGradient>
          <filter id="nv-arc-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>

        {/* Subtle ambient full-arc halo */}
        <path
          d={fullArc}
          fill="none"
          stroke={isUpload ? 'url(#nv-gauge-upload)' : 'url(#nv-gauge-arc)'}
          strokeWidth="22"
          strokeLinecap="round"
          filter="url(#nv-arc-glow)"
          opacity={isActive ? '0.52' : '0.24'}
        />

        {/* Base track */}
        <path
          d={fullArc}
          fill="none"
          stroke="currentColor"
          className="text-indigo-200/75 dark:text-[#1b2059]"
          strokeWidth="18"
          strokeLinecap="round"
        />

        {/* Full gradient ring subtle baseline + bright active arc */}
        <path
          d={fullArc}
          fill="none"
          stroke={isUpload ? 'url(#nv-gauge-upload)' : 'url(#nv-gauge-arc)'}
          strokeWidth="18"
          strokeLinecap="round"
          opacity={speedMbps > 0 ? '0.28' : '0.45'}
        />

        {activeArc && (
          <path
            d={activeArc}
            fill="none"
            stroke={isUpload ? 'url(#nv-gauge-upload)' : 'url(#nv-gauge-arc)'}
            strokeWidth="18"
            strokeLinecap="round"
            className={animationsEnabled ? 'transition-all duration-150 ease-out' : ''}
          />
        )}

        {/* Scale Ticks & Numeric Stops */}
        {SCALE_STOPS.map((stop, idx) => {
          const t = idx / (SCALE_STOPS.length - 1);
          const angle = START_ANGLE + t * TOTAL_SPAN;
          const labelPt = polarToCartesian(cx, cy, 110, angle);
          const tickOuter = polarToCartesian(cx, cy, 130, angle);
          const tickInner = polarToCartesian(cx, cy, 124, angle);
          const label = stop === 500 ? '500+' : String(stop);

          return (
            <g key={stop}>
              <line
                x1={tickInner.x}
                y1={tickInner.y}
                x2={tickOuter.x}
                y2={tickOuter.y}
                stroke="currentColor"
                className="text-indigo-400/50 dark:text-[#8892df]/60"
                strokeWidth="1.75"
              />
              <text
                x={labelPt.x}
                y={labelPt.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-[#2d3270] dark:fill-[#e8eaff] text-[15px] font-semibold font-mono-tabular"
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* Sleek Needle */}
        <g className={animationsEnabled ? 'transition-transform duration-150 ease-out' : ''}>
          <polygon
            points={`${needleTip.x},${needleTip.y} ${needleLeft.x},${needleLeft.y} ${needleRight.x},${needleRight.y}`}
            fill={isUpload ? '#a855f7' : '#18c8ff'}
            opacity={phase === 'idle' && speedMbps === 0 ? 0.35 : 0.95}
          />
          <circle
            cx={cx}
            cy={cy}
            r="9"
            className="fill-white dark:fill-[#0d1033] stroke-[#18c8ff]"
            strokeWidth="2.5"
          />
        </g>

        {/* Central Speed Readout */}
        <text
          x={cx}
          y={cy + 46}
          textAnchor="middle"
          className="fill-[#141847] dark:fill-white text-[46px] font-bold font-mono-tabular"
        >
          {speedMbps.toFixed(2)}
        </text>
        <text
          x={cx}
          y={cy + 78}
          textAnchor="middle"
          className="fill-[#0891b2] dark:fill-[#18c8ff] text-[16px] font-semibold tracking-wide"
        >
          {isUpload ? '⤒' : '⤓'} {unitLabel}
        </text>
      </svg>

      <div className="mt-0.5 text-xs font-medium text-[#4c538c] dark:text-[#cfd3ff] text-center min-h-[18px] px-2">
        {phaseLabel}
      </div>
    </div>
  );
};
