import React, { useMemo, useState } from 'react';
import type { LiveSample } from '../types/network';

interface TrafficChartProps {
  samples: LiveSample[];
  rangeMinutes: 1 | 5 | 15 | 30 | 60;
  mode?: 'combined' | 'latency' | 'activity';
  emptyLabel: string;
  primaryLabel: string;
  secondaryLabel: string;
  height?: number;
}

function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const midX = (p0.x + p1.x) / 2;
    d += ` C ${midX} ${p0.y}, ${midX} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

export const TrafficChart: React.FC<TrafficChartProps> = ({
  samples,
  rangeMinutes,
  mode = 'combined',
  emptyLabel,
  primaryLabel,
  secondaryLabel,
  height = 190,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const cutoff = Date.now() - rangeMinutes * 60_000;
    return samples.filter((s) => s.timestamp >= cutoff);
  }, [samples, rangeMinutes]);

  const width = 640;
  const padLeft = 38;
  const padRight = 14;
  const padTop = 14;
  const padBottom = 26;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const { primaryPts, secondaryPts, maxVal, yTicks, areaPrimary, areaSecondary } = useMemo(() => {
    if (filtered.length === 0) {
      return {
        primaryPts: [] as Array<{ x: number; y: number; val: number }>,
        secondaryPts: [] as Array<{ x: number; y: number; val: number }>,
        maxVal: 100,
        yTicks: [0, 25, 50, 75, 100],
        areaPrimary: '',
        areaSecondary: '',
      };
    }

    const vals1 = filtered.map((s) =>
      mode === 'activity' ? s.downloadActivityMbps : s.latencyMs ?? 0,
    );
    const vals2 = filtered.map((s) =>
      mode === 'activity' ? s.uploadActivityMbps : s.downloadActivityMbps,
    );

    const rawMax = Math.max(
      mode === 'latency' ? 60 : 50,
      ...vals1,
      ...(mode === 'latency' ? [0] : vals2),
    );
    const roundedMax = Math.ceil(rawMax / 25) * 25 || 100;

    const toPoints = (arr: number[]) =>
      arr.map((val, i) => {
        const x =
          arr.length === 1
            ? padLeft + plotW / 2
            : padLeft + (i / (arr.length - 1)) * plotW;
        const y = padTop + plotH - (Math.min(val, roundedMax) / roundedMax) * plotH;
        return { x, y, val };
      });

    const pPts = toPoints(vals1);
    const sPts = toPoints(vals2);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(roundedMax * t));

    const buildArea = (pts: Array<{ x: number; y: number }>) => {
      if (pts.length < 2) return '';
      const line = buildSmoothPath(pts);
      return `${line} L ${pts[pts.length - 1].x} ${padTop + plotH} L ${pts[0].x} ${padTop + plotH} Z`;
    };

    return {
      primaryPts: pPts,
      secondaryPts: sPts,
      maxVal: roundedMax,
      yTicks: ticks,
      areaPrimary: buildArea(pPts),
      areaSecondary: mode !== 'latency' ? buildArea(sPts) : '',
    };
  }, [filtered, mode, plotH, plotW]);

  if (filtered.length < 2) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#c4cbf2] dark:border-[#262a6b] text-xs text-[#5a6099] dark:text-[#9aa0d6]"
        style={{ height }}
      >
        <span>{emptyLabel}</span>
      </div>
    );
  }

  const primaryLine = buildSmoothPath(primaryPts);
  const secondaryLine = buildSmoothPath(secondaryPts);
  const hoveredSample = hoverIdx !== null ? filtered[hoverIdx] : null;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="nv-chart-c1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#18c8ff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#18c8ff" stopOpacity="0.03" />
          </linearGradient>
          <linearGradient id="nv-chart-c2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0.03" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => {
          const y = padTop + plotH - (tick / maxVal) * plotH;
          return (
            <g key={tick}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="currentColor"
                className="text-indigo-200 dark:text-[#2a2f80]"
                strokeWidth="0.8"
              />
              <text
                x={padLeft - 8}
                y={y + 3}
                textAnchor="end"
                className="fill-[#5a6099] dark:fill-[#9aa0d6] text-[10px] font-mono-tabular"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {areaPrimary && <path d={areaPrimary} fill="url(#nv-chart-c1)" />}
        {areaSecondary && <path d={areaSecondary} fill="url(#nv-chart-c2)" />}

        <path
          d={primaryLine}
          fill="none"
          stroke="#18c8ff"
          strokeWidth="2.4"
          strokeLinecap="round"
        />

        {mode !== 'latency' && (
          <path
            d={secondaryLine}
            fill="none"
            stroke="#a855f7"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        )}

        <text
          x={padLeft}
          y={height - 6}
          textAnchor="start"
          className="fill-[#5a6099] dark:fill-[#9aa0d6] text-[10px] font-mono-tabular"
        >
          -{rangeMinutes}m
        </text>
        <text
          x={padLeft + plotW / 2}
          y={height - 6}
          textAnchor="middle"
          className="fill-[#5a6099] dark:fill-[#9aa0d6] text-[10px] font-mono-tabular"
        >
          -{Math.max(1, Math.round(rangeMinutes / 2))}m
        </text>
        <text
          x={width - padRight}
          y={height - 6}
          textAnchor="end"
          className="fill-[#2d3270] dark:fill-[#eef0ff] text-[10px] font-medium"
        >
          Now
        </text>

        {primaryPts.map((pt, i) => {
          const colW = plotW / Math.max(primaryPts.length - 1, 1);
          return (
            <rect
              key={i}
              x={pt.x - colW / 2}
              y={padTop}
              width={Math.max(colW, 6)}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
            />
          );
        })}

        {hoverIdx !== null && primaryPts[hoverIdx] && (
          <g>
            <line
              x1={primaryPts[hoverIdx].x}
              y1={padTop}
              x2={primaryPts[hoverIdx].x}
              y2={padTop + plotH}
              stroke="#18c8ff"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.7"
            />
            <circle cx={primaryPts[hoverIdx].x} cy={primaryPts[hoverIdx].y} r="4" fill="#18c8ff" />
            {mode !== 'latency' && secondaryPts[hoverIdx] && (
              <circle cx={secondaryPts[hoverIdx].x} cy={secondaryPts[hoverIdx].y} r="4" fill="#a855f7" />
            )}
          </g>
        )}
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#4c538c] dark:text-[#9aa0d6]">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-xs bg-[#18c8ff]" />
            <span>{primaryLabel}</span>
          </span>
          {mode !== 'latency' && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-xs bg-[#a855f7]" />
              <span>{secondaryLabel}</span>
            </span>
          )}
        </div>
        {hoveredSample && (
          <div className="font-mono-tabular text-[#141847] dark:text-[#eef0ff]">
            {new Date(hoveredSample.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
            {' · '}
            {hoveredSample.latencyMs !== null ? `${hoveredSample.latencyMs} ms` : 'Timeout'}
            {hoveredSample.downloadActivityMbps > 0 && ` · DL ${hoveredSample.downloadActivityMbps} Mbps`}
            {hoveredSample.uploadActivityMbps > 0 && ` · UL ${hoveredSample.uploadActivityMbps} Mbps`}
          </div>
        )}
      </div>
    </div>
  );
};
