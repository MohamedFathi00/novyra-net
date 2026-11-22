import React from 'react';

interface MiniSparklineProps {
  samples: number[];
  strokeColor: string;
  fillId: string;
}

export const MiniSparkline: React.FC<MiniSparklineProps> = ({
  samples,
  strokeColor,
  fillId,
}) => {
  const width = 200;
  const height = 68;

  if (!samples || samples.length < 2) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16 sm:h-[72px] opacity-40" aria-hidden="true">
        <line
          x1="0"
          y1={height - 10}
          x2={width}
          y2={height - 10}
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
      </svg>
    );
  }

  const max = Math.max(...samples, 1);
  const min = Math.min(...samples, 0);
  const span = Math.max(max - min, 1);

  const pts = samples.map((val, idx) => {
    const x = (idx / (samples.length - 1)) * width;
    const y = height - 6 - ((val - min) / span) * (height - 16);
    return { x, y };
  });

  let line = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const midX = ((p0.x + p1.x) / 2).toFixed(1);
    line += ` C ${midX} ${p0.y.toFixed(1)}, ${midX} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16 sm:h-[72px] overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.38" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${fillId})`} />
      <path d={line} fill="none" stroke={strokeColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};
