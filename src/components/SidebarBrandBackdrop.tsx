import React, { useEffect, useRef } from 'react';
import type { AnimationStyle } from '../types/network';

interface SidebarBrandBackdropProps {
  animationsEnabled?: boolean;
  animationStyle?: AnimationStyle;
}

interface FloatingSpark {
  x: number;
  y: number;
  vy: number;
  vx: number;
  r: number;
  alpha: number;
  hue: 'cyan' | 'violet';
  phase: number;
}

interface MatrixBeam {
  x: number;
  y: number;
  len: number;
  vy: number;
  color: string;
}

interface WarpStreak {
  angle: number;
  dist: number;
  speed: number;
  len: number;
  color: string;
}

export const SidebarBrandBackdrop: React.FC<SidebarBrandBackdropProps> = ({
  animationsEnabled = true,
  animationStyle = 'cyber',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const activeStyle: AnimationStyle =
    !animationsEnabled || animationStyle === 'off' ? 'off' : animationStyle;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const shouldAnimate = activeStyle !== 'off' && !reducedMotion;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let rafId = 0;
    let time = 0;

    const sparks: FloatingSpark[] = [];
    const beams: MatrixBeam[] = [];
    const warpStreaks: WarpStreak[] = [];

    const initAssets = (w: number, h: number) => {
      sparks.length = 0;
      for (let i = 0; i < 18; i++) {
        sparks.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vy: 0.18 + Math.random() * 0.28,
          vx: (Math.random() - 0.5) * 0.14,
          r: 1 + Math.random() * 1.5,
          alpha: 0.35 + Math.random() * 0.55,
          hue: i % 2 === 0 ? 'cyan' : 'violet',
          phase: Math.random() * Math.PI * 2,
        });
      }

      beams.length = 0;
      const beamCols = 11;
      const colors = ['#18c8ff', '#a855f7', '#22e06b', '#6366f1'];
      for (let i = 0; i < 18; i++) {
        const col = i % beamCols;
        beams.push({
          x: ((col + 0.5) / beamCols) * w,
          y: Math.random() * h,
          len: 20 + Math.random() * 38,
          vy: 0.95 + Math.random() * 1.35,
          color: colors[i % colors.length],
        });
      }

      warpStreaks.length = 0;
      const wColors = ['34, 211, 238', '168, 85, 247', '99, 102, 241'];
      for (let i = 0; i < 36; i++) {
        warpStreaks.push({
          angle: Math.random() * Math.PI * 2,
          dist: 8 + Math.random() * 90,
          speed: 0.65 + Math.random() * 1.15,
          len: 8 + Math.random() * 18,
          color: wColors[i % wColors.length],
        });
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (sparks.length === 0) {
        initAssets(width, height);
      }
    };

    resize();
    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas);

    const drawSpotlight = (alphaBoost = 1) => {
      const auraPulse = 0.86 + 0.14 * Math.sin(time * 1.6);
      const centerAura = ctx.createRadialGradient(
        width * 0.5,
        height * 0.45,
        4,
        width * 0.5,
        height * 0.48,
        width * 0.68,
      );
      centerAura.addColorStop(0, `rgba(24, 200, 255, ${(0.22 * auraPulse * alphaBoost).toFixed(3)})`);
      centerAura.addColorStop(0.45, `rgba(91, 61, 245, ${(0.24 * auraPulse * alphaBoost).toFixed(3)})`);
      centerAura.addColorStop(1, 'rgba(6, 10, 35, 0)');
      ctx.fillStyle = centerAura;
      ctx.fillRect(0, 0, width, height);
    };

    const drawCyber = () => {
      drawSpotlight(1);

      const ribbons = [
        {
          yRatio: 0.72,
          amp: 15,
          freq: 0.02,
          speed: 1.05,
          crest: 'rgba(168, 85, 247, 0.72)',
          glow: 'rgba(168, 85, 247, 0.28)',
          fillTop: 'rgba(109, 40, 217, 0.28)',
          lw: 1.8,
        },
        {
          yRatio: 0.80,
          amp: 12,
          freq: 0.025,
          speed: -1.35,
          crest: 'rgba(34, 211, 238, 0.78)',
          glow: 'rgba(24, 200, 255, 0.30)',
          fillTop: 'rgba(24, 200, 255, 0.18)',
          lw: 1.9,
        },
        {
          yRatio: 0.89,
          amp: 8,
          freq: 0.031,
          speed: 1.7,
          crest: 'rgba(99, 102, 241, 0.6)',
          glow: 'rgba(99, 102, 241, 0)',
          fillTop: 'rgba(79, 70, 229, 0.2)',
          lw: 1.3,
        },
      ];

      for (const rb of ribbons) {
        const yMid = height * rb.yRatio;
        ctx.beginPath();
        for (let x = 0; x <= width; x += 4) {
          const y =
            yMid +
            Math.sin(x * rb.freq + time * rb.speed) * rb.amp +
            Math.cos(x * rb.freq * 0.58 - time * rb.speed * 0.72) * (rb.amp * 0.38);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        if (!rb.glow.endsWith(', 0)')) {
          ctx.strokeStyle = rb.glow;
          ctx.lineWidth = rb.lw * 3.4;
          ctx.stroke();
        }

        ctx.strokeStyle = rb.crest;
        ctx.lineWidth = rb.lw;
        ctx.stroke();

        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        const fg = ctx.createLinearGradient(0, yMid - rb.amp, 0, height);
        fg.addColorStop(0, rb.fillTop);
        fg.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = fg;
        ctx.fill();
      }

      const pedestalY = height * 0.74;
      const rx = Math.min(72, width * 0.34);
      const ry = 10;
      const ringAlpha = 0.45 + 0.25 * Math.sin(time * 2.1);

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(width * 0.5, pedestalY, rx, ry, 0, 0, Math.PI * 2);
      const ringGrad = ctx.createLinearGradient(width * 0.5 - rx, pedestalY, width * 0.5 + rx, pedestalY);
      ringGrad.addColorStop(0, 'rgba(24, 200, 255, 0)');
      ringGrad.addColorStop(0.5, `rgba(24, 200, 255, ${(0.55 * ringAlpha).toFixed(3)})`);
      ringGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');
      ctx.strokeStyle = ringGrad;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();

      for (const s of sparks) {
        if (shouldAnimate) {
          s.y -= s.vy;
          s.x += s.vx + Math.sin(time * 1.5 + s.phase) * 0.14;
          if (s.y < 10) {
            s.y = height - 6;
            s.x = Math.random() * width;
          }
          if (s.x < 4) s.x = width - 4;
          if (s.x > width - 4) s.x = 4;
        }
        const topFade = Math.min(1, Math.max(0, (s.y - 8) / (height * 0.28)));
        const botFade = Math.min(1, Math.max(0, (height - s.y) / 18));
        const twinkle = 0.6 + 0.4 * Math.sin(time * 2.8 + s.phase);
        const alpha = s.alpha * topFade * botFade * twinkle * 0.92;
        const rgb = s.hue === 'cyan' ? '34, 211, 238' : '168, 85, 247';

        ctx.fillStyle = `rgba(${rgb}, ${(alpha * 0.25).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(${rgb}, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawAurora = () => {
      drawSpotlight(1.1);

      const curtains = [
        { yRatio: 0.55, amp: 18, freq: 0.018, speed: 0.75, crest: 'rgba(34, 224, 107, 0.48)', fill: 'rgba(34, 224, 107, 0.16)' },
        { yRatio: 0.68, amp: 16, freq: 0.022, speed: -0.95, crest: 'rgba(24, 200, 255, 0.65)', fill: 'rgba(24, 200, 255, 0.20)' },
        { yRatio: 0.80, amp: 14, freq: 0.026, speed: 1.2, crest: 'rgba(168, 85, 247, 0.62)', fill: 'rgba(168, 85, 247, 0.22)' },
      ];

      for (const cur of curtains) {
        const yMid = height * cur.yRatio;
        ctx.beginPath();
        for (let x = 0; x <= width; x += 4) {
          const y =
            yMid +
            Math.sin(x * cur.freq + time * cur.speed) * cur.amp +
            Math.sin(x * cur.freq * 1.9 - time * cur.speed * 0.6) * (cur.amp * 0.3);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = cur.crest;
        ctx.lineWidth = 1.6;
        ctx.stroke();

        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        const fg = ctx.createLinearGradient(0, yMid - cur.amp, 0, height);
        fg.addColorStop(0, cur.fill);
        fg.addColorStop(1, 'rgba(6, 10, 35, 0)');
        ctx.fillStyle = fg;
        ctx.fill();
      }

      for (const s of sparks) {
        if (shouldAnimate) {
          s.y -= s.vy * 0.65;
          s.x += Math.sin(time + s.phase) * 0.18;
          if (s.y < 12) s.y = height - 8;
        }
        const alpha = (0.35 + 0.35 * Math.sin(time * 1.8 + s.phase)) * s.alpha;
        ctx.fillStyle = `rgba(34, 211, 238, ${(alpha * 0.5).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawMatrix = () => {
      drawSpotlight(0.75);

      for (const b of beams) {
        if (shouldAnimate) {
          b.y -= b.vy;
          if (b.y + b.len < 0) {
            b.y = height + 10;
            b.len = 22 + Math.random() * 38;
          }
        }
        const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.len);
        g.addColorStop(0, b.color);
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x, b.y + b.len);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawWarp = () => {
      drawSpotlight(1.05);
      const cx = width * 0.5;
      const cy = height * 0.44;
      const maxDist = Math.hypot(width, height) * 0.65;

      for (const ws of warpStreaks) {
        if (shouldAnimate) {
          ws.dist += ws.speed * (1 + ws.dist * 0.015);
          if (ws.dist > maxDist) {
            ws.dist = 6 + Math.random() * 14;
            ws.angle = Math.random() * Math.PI * 2;
          }
        }
        const x1 = cx + Math.cos(ws.angle) * ws.dist;
        const y1 = cy + Math.sin(ws.angle) * ws.dist;
        const x2 = cx + Math.cos(ws.angle) * (ws.dist + ws.len);
        const y2 = cy + Math.sin(ws.angle) * (ws.dist + ws.len);
        const alpha = Math.min(0.85, ws.dist / 50);

        ctx.strokeStyle = `rgba(${ws.color}, ${alpha.toFixed(3)})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    };

    const drawMinimal = () => {
      drawSpotlight(0.7);
      const lineY = height * 0.78;
      const g = ctx.createLinearGradient(width * 0.1, lineY, width * 0.9, lineY);
      g.addColorStop(0, 'rgba(24, 200, 255, 0)');
      g.addColorStop(0.5, 'rgba(24, 200, 255, 0.36)');
      g.addColorStop(1, 'rgba(168, 85, 247, 0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(width * 0.1, lineY);
      ctx.lineTo(width * 0.9, lineY);
      ctx.stroke();

      for (let i = 0; i < sparks.length; i += 3) {
        const s = sparks[i];
        if (shouldAnimate) {
          s.y -= s.vy * 0.45;
          if (s.y < 12) s.y = height - 10;
        }
        const tw = 0.25 + 0.45 * Math.sin(time * 1.4 + s.phase);
        ctx.fillStyle = `rgba(147, 197, 253, ${Math.max(0.08, tw).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawFrame = () => {
      if (width <= 0 || height <= 0) return;
      ctx.clearRect(0, 0, width, height);

      if (activeStyle === 'cyber') drawCyber();
      else if (activeStyle === 'aurora') drawAurora();
      else if (activeStyle === 'matrix') drawMatrix();
      else if (activeStyle === 'warp') drawWarp();
      else if (activeStyle === 'minimal') drawMinimal();
      else drawSpotlight(0.65);
    };

    const tick = () => {
      time += 0.016;
      drawFrame();
      rafId = requestAnimationFrame(tick);
    };

    if (shouldAnimate) {
      rafId = requestAnimationFrame(tick);
    } else {
      time = 1.5;
      drawFrame();
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [activeStyle]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none select-none absolute inset-0 h-full w-full z-0"
      style={{
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 18%, black 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 18%, black 100%)',
      }}
    />
  );
};
