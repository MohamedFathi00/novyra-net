import React, { useEffect, useRef } from 'react';
import type { AnimationStyle } from '../types/network';

interface HeaderAnimatedBackdropProps {
  isTesting?: boolean;
  animationsEnabled?: boolean;
  animationStyle?: AnimationStyle;
}

interface NetworkNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hue: 'cyan' | 'indigo' | 'violet';
  phase: number;
}

interface DataPacket {
  fromIdx: number;
  toIdx: number;
  progress: number;
  speed: number;
  color: string;
}

interface FiberStreak {
  x: number;
  y: number;
  len: number;
  speed: number;
  color: string;
  alpha: number;
}

interface WarpStar {
  x: number;
  y: number;
  z: number;
  prevZ: number;
  hue: 'cyan' | 'violet' | 'sky';
}

interface TwinkleStar {
  x: number;
  y: number;
  r: number;
  phase: number;
  vx: number;
  vy: number;
}

export const HeaderAnimatedBackdrop: React.FC<HeaderAnimatedBackdropProps> = ({
  isTesting = false,
  animationsEnabled = true,
  animationStyle = 'cyber',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isTestingRef = useRef(isTesting);
  isTestingRef.current = isTesting;

  const activeStyle: AnimationStyle =
    !animationsEnabled || animationStyle === 'off' ? 'off' : animationStyle;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const headerEl = canvas.closest('header');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const shouldAnimate = activeStyle !== 'off' && !reducedMotion;

    let width = 0;
    let height = 0;
    let lastWidth = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let rafId = 0;
    let time = 0;

    const pointer = { x: -9999, y: -9999, active: false };

    const nodes: NetworkNode[] = [];
    const packets: DataPacket[] = [];
    const streaks: FiberStreak[] = [];
    const warpStars: WarpStar[] = [];
    const stars: TwinkleStar[] = [];

    const createSceneAssets = (w: number, h: number) => {
      nodes.length = 0;
      packets.length = 0;
      const count = Math.max(26, Math.min(48, Math.round(w / 28)));
      const hues: Array<NetworkNode['hue']> = ['cyan', 'indigo', 'violet'];
      for (let i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * w,
          y: 10 + Math.random() * Math.max(20, h - 20),
          vx: (Math.random() - 0.5) * 0.42,
          vy: (Math.random() - 0.5) * 0.24,
          radius: 1.5 + Math.random() * 2.0,
          hue: hues[i % hues.length],
          phase: Math.random() * Math.PI * 2,
        });
      }

      streaks.length = 0;
      const lanes = 7;
      const fiberColors = ['#18c8ff', '#a855f7', '#22e06b', '#6366f1'];
      for (let i = 0; i < 28; i++) {
        const lane = i % lanes;
        streaks.push({
          x: Math.random() * w,
          y: ((lane + 0.5) / lanes) * h,
          len: 36 + Math.random() * 78,
          speed: 1.8 + Math.random() * 3.4,
          color: fiberColors[i % fiberColors.length],
          alpha: 0.45 + Math.random() * 0.45,
        });
      }

      warpStars.length = 0;
      const starHues: Array<WarpStar['hue']> = ['cyan', 'violet', 'sky'];
      for (let i = 0; i < 95; i++) {
        const z = 0.08 + Math.random() * 0.92;
        warpStars.push({
          x: (Math.random() - 0.5) * w * 1.4,
          y: (Math.random() - 0.5) * h * 2.2,
          z,
          prevZ: z,
          hue: starHues[i % starHues.length],
        });
      }

      stars.length = 0;
      for (let i = 0; i < 36; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 0.8 + Math.random() * 1.4,
          phase: Math.random() * Math.PI * 2,
          vx: (Math.random() - 0.5) * 0.12,
          vy: (Math.random() - 0.5) * 0.08,
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
      if (nodes.length === 0 || Math.abs(width - lastWidth) > 120) {
        createSceneAssets(width, height);
        lastWidth = width;
      } else {
        for (const n of nodes) {
          n.x = Math.min(width, Math.max(0, n.x));
          n.y = Math.min(height, Math.max(0, n.y));
        }
      }
    };

    resize();
    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas);

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active =
        pointer.x >= 0 && pointer.x <= rect.width && pointer.y >= 0 && pointer.y <= rect.height;
    };
    const onMouseLeave = () => {
      pointer.active = false;
    };

    if (headerEl) {
      headerEl.addEventListener('mousemove', onMouseMove, { passive: true });
      headerEl.addEventListener('mouseleave', onMouseLeave, { passive: true });
    }

    const spawnPacket = () => {
      if (nodes.length < 2) return;
      const fromIdx = Math.floor(Math.random() * nodes.length);
      const from = nodes[fromIdx];
      let bestIdx = -1;
      let bestDist = 175 * 175;
      for (let j = 0; j < nodes.length; j++) {
        if (j === fromIdx) continue;
        const dx = nodes[j].x - from.x;
        const dy = nodes[j].y - from.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestDist && d2 > 400) {
          bestDist = d2;
          bestIdx = j;
        }
      }
      if (bestIdx !== -1) {
        const palette = ['#22d3ee', '#38bdf8', '#a855f7', '#22e06b'];
        packets.push({
          fromIdx,
          toIdx: bestIdx,
          progress: 0,
          speed: (isTestingRef.current ? 0.045 : 0.022) + Math.random() * 0.018,
          color: palette[Math.floor(Math.random() * palette.length)],
        });
      }
    };

    const drawCyber = (testing: boolean) => {
      const speedMult = testing ? 2.15 : 1;
      const scanX = ((time * (testing ? 260 : 125)) % (width + 420)) - 210;
      const gridStep = 22;

      for (let gx = 10; gx < width; gx += gridStep) {
        const distScan = Math.abs(gx - scanX);
        const scanBoost = Math.max(0, 1 - distScan / 170);
        for (let gy = 10; gy < height; gy += gridStep) {
          const alpha = 0.14 + scanBoost * 0.34;
          ctx.fillStyle = `rgba(56, 189, 248, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(gx, gy, 1 + scanBoost * 0.65, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const beamGrad = ctx.createLinearGradient(scanX - 150, 0, scanX + 150, 0);
      beamGrad.addColorStop(0, 'rgba(24, 200, 255, 0)');
      beamGrad.addColorStop(0.5, 'rgba(24, 200, 255, 0.10)');
      beamGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');
      ctx.fillStyle = beamGrad;
      ctx.fillRect(Math.max(0, scanX - 150), 0, 300, height);

      const waveConfigs = [
        {
          amp: testing ? 14 : 9.5,
          freq: 0.011,
          speed: 1.9,
          yBase: height * 0.64,
          stroke: 'rgba(24, 200, 255, 0.48)',
          fillTop: 'rgba(24, 200, 255, 0.12)',
          lineWidth: 1.75,
        },
        {
          amp: testing ? 11.5 : 8,
          freq: 0.0145,
          speed: -1.45,
          yBase: height * 0.56,
          stroke: 'rgba(168, 85, 247, 0.44)',
          fillTop: 'rgba(168, 85, 247, 0.1)',
          lineWidth: 1.5,
        },
        {
          amp: testing ? 7.5 : 5,
          freq: 0.02,
          speed: 2.5,
          yBase: height * 0.72,
          stroke: 'rgba(99, 102, 241, 0.36)',
          fillTop: 'rgba(99, 102, 241, 0)',
          lineWidth: 1.1,
        },
      ];

      for (const wv of waveConfigs) {
        ctx.beginPath();
        for (let x = 0; x <= width; x += 8) {
          const env = Math.sin((x / width) * Math.PI);
          const y =
            wv.yBase +
            Math.sin(x * wv.freq + time * wv.speed) * wv.amp * (0.45 + 0.55 * env) +
            Math.cos(x * wv.freq * 0.55 - time * wv.speed * 0.7) * (wv.amp * 0.4);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = wv.stroke;
        ctx.lineWidth = wv.lineWidth;
        ctx.stroke();

        if (!wv.fillTop.endsWith(', 0)')) {
          ctx.lineTo(width, height);
          ctx.lineTo(0, height);
          ctx.closePath();
          const fg = ctx.createLinearGradient(0, wv.yBase - wv.amp, 0, height);
          fg.addColorStop(0, wv.fillTop);
          fg.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = fg;
          ctx.fill();
        }
      }

      const linkDist = Math.min(165, Math.max(115, width * 0.13));
      const linkDistSq = linkDist * linkDist;

      if (shouldAnimate) {
        for (const n of nodes) {
          n.x += n.vx * speedMult;
          n.y += n.vy * speedMult;

          if (pointer.active) {
            const dx = pointer.x - n.x;
            const dy = pointer.y - n.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < 140 * 140 && d2 > 64) {
              const dist = Math.sqrt(d2);
              n.x += (dx / dist) * 0.55;
              n.y += (dy / dist) * 0.55;
            }
          }

          if (n.x < -10) n.x = width + 10;
          else if (n.x > width + 10) n.x = -10;
          if (n.y < 8) {
            n.y = 8;
            n.vy = Math.abs(n.vy);
          } else if (n.y > height - 8) {
            n.y = height - 8;
            n.vy = -Math.abs(n.vy);
          }
        }
      }

      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < linkDistSq) {
            const strength = 1 - Math.sqrt(d2) / linkDist;
            let boost = 0;
            if (pointer.active) {
              const mx = (a.x + b.x) * 0.5 - pointer.x;
              const my = (a.y + b.y) * 0.5 - pointer.y;
              boost = Math.max(0, 1 - Math.sqrt(mx * mx + my * my) / 145) * 0.35;
            }
            const alpha = strength * 0.32 + boost;
            ctx.strokeStyle = `rgba(79, 172, 254, ${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      if (shouldAnimate) {
        const maxPackets = testing ? 18 : 10;
        if (packets.length < maxPackets && Math.random() < (testing ? 0.35 : 0.14)) {
          spawnPacket();
        }

        for (let p = packets.length - 1; p >= 0; p--) {
          const pkt = packets[p];
          pkt.progress += pkt.speed;
          if (pkt.progress >= 1) {
            packets.splice(p, 1);
            continue;
          }
          const a = nodes[pkt.fromIdx];
          const b = nodes[pkt.toIdx];
          if (!a || !b) {
            packets.splice(p, 1);
            continue;
          }
          const px = a.x + (b.x - a.x) * pkt.progress;
          const py = a.y + (b.y - a.y) * pkt.progress;
          const tailProgress = Math.max(0, pkt.progress - 0.18);
          const tx = a.x + (b.x - a.x) * tailProgress;
          const ty = a.y + (b.y - a.y) * tailProgress;

          const tg = ctx.createLinearGradient(tx, ty, px, py);
          tg.addColorStop(0, 'rgba(24, 200, 255, 0)');
          tg.addColorStop(1, pkt.color);
          ctx.strokeStyle = tg;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(px, py);
          ctx.stroke();

          ctx.fillStyle = pkt.color;
          ctx.beginPath();
          ctx.arc(px, py, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      for (const n of nodes) {
        const pulse = 0.72 + 0.28 * Math.sin(time * 2.6 + n.phase);
        const rgb =
          n.hue === 'cyan'
            ? '24, 200, 255'
            : n.hue === 'violet'
              ? '168, 85, 247'
              : '99, 102, 241';

        ctx.fillStyle = `rgba(${rgb}, ${(0.22 * pulse).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius * 3.1, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(${rgb}, ${(0.92 * pulse).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawAurora = (testing: boolean) => {
      const speedMult = testing ? 1.8 : 1;

      for (const s of stars) {
        if (shouldAnimate) {
          s.x += s.vx * speedMult;
          if (s.x < 0) s.x = width;
          if (s.x > width) s.x = 0;
        }
        const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 2.1 + s.phase));
        ctx.fillStyle = `rgba(207, 211, 255, ${(tw * 0.55).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (pointer.active) {
        const pg = ctx.createRadialGradient(pointer.x, pointer.y, 4, pointer.x, pointer.y, 150);
        pg.addColorStop(0, 'rgba(34, 211, 238, 0.16)');
        pg.addColorStop(0.5, 'rgba(168, 85, 247, 0.08)');
        pg.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = pg;
        ctx.fillRect(0, 0, width, height);
      }

      const curtains = [
        { yRatio: 0.35, amp: 14, freq: 0.0055, speed: 0.8 * speedMult, cTop: 'rgba(34, 224, 107, 0.16)', crest: 'rgba(34, 224, 107, 0.42)' },
        { yRatio: 0.50, amp: 18, freq: 0.007, speed: -1.1 * speedMult, cTop: 'rgba(24, 200, 255, 0.22)', crest: 'rgba(24, 200, 255, 0.65)' },
        { yRatio: 0.64, amp: 15, freq: 0.009, speed: 1.35 * speedMult, cTop: 'rgba(168, 85, 247, 0.24)', crest: 'rgba(168, 85, 247, 0.62)' },
        { yRatio: 0.78, amp: 11, freq: 0.012, speed: -1.6 * speedMult, cTop: 'rgba(79, 70, 229, 0.22)', crest: 'rgba(99, 102, 241, 0.5)' },
      ];

      for (const cur of curtains) {
        const yBase = height * cur.yRatio;
        ctx.beginPath();
        for (let x = 0; x <= width; x += 6) {
          const y =
            yBase +
            Math.sin(x * cur.freq + time * cur.speed) * cur.amp +
            Math.sin(x * cur.freq * 2.1 - time * cur.speed * 0.65) * (cur.amp * 0.35);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = cur.crest;
        ctx.lineWidth = 1.6;
        ctx.stroke();

        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, yBase - cur.amp, 0, height);
        grad.addColorStop(0, cur.cTop);
        grad.addColorStop(1, 'rgba(6, 10, 35, 0)');
        ctx.fillStyle = grad;
        ctx.fill();
      }
    };

    const drawMatrix = (testing: boolean) => {
      const speedMult = testing ? 2.4 : 1;
      const lanes = 7;

      // Subtle fiber lanes
      ctx.lineWidth = 1;
      for (let l = 0; l < lanes; l++) {
        const y = ((l + 0.5) / lanes) * height;
        ctx.strokeStyle = 'rgba(38, 42, 107, 0.45)';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Vertical spectrum pulse ticks in center background
      const colStep = 28;
      for (let gx = 14; gx < width; gx += colStep) {
        const barH = (0.3 + 0.7 * Math.abs(Math.sin(time * 2.4 * speedMult + gx * 0.03))) * (height * 0.36);
        const boost =
          pointer.active ? Math.max(0, 1 - Math.abs(pointer.x - gx) / 110) * 0.35 : 0;
        ctx.fillStyle = `rgba(24, 200, 255, ${(0.07 + boost).toFixed(3)})`;
        ctx.fillRect(gx - 1, height - barH, 2, barH);
      }

      // High-speed fiber streaks
      for (const st of streaks) {
        if (shouldAnimate) {
          st.x += st.speed * speedMult;
          if (st.x - st.len > width) {
            st.x = -20;
            st.len = 36 + Math.random() * 82;
          }
        }
        const tailX = st.x - st.len;
        const grad = ctx.createLinearGradient(tailX, st.y, st.x, st.y);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(0.7, st.color);
        grad.addColorStop(1, '#ffffff');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tailX, st.y);
        ctx.lineTo(st.x, st.y);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(st.x, st.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawWarp = (testing: boolean) => {
      const warpSpeed = testing ? 0.028 : 0.011;
      const cx = pointer.active ? width * 0.5 + (pointer.x - width * 0.5) * 0.35 : width * 0.52;
      const cy = pointer.active ? height * 0.5 + (pointer.y - height * 0.5) * 0.35 : height * 0.5;

      // Center nebula core
      const neb = ctx.createRadialGradient(cx, cy, 4, cx, cy, Math.max(width, height) * 0.45);
      neb.addColorStop(0, testing ? 'rgba(24, 200, 255, 0.22)' : 'rgba(91, 61, 245, 0.18)');
      neb.addColorStop(0.5, 'rgba(168, 85, 247, 0.08)');
      neb.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, width, height);

      for (const s of warpStars) {
        if (shouldAnimate) {
          s.prevZ = s.z;
          s.z -= warpSpeed;
          if (s.z <= 0.02) {
            s.x = (Math.random() - 0.5) * width * 1.4;
            s.y = (Math.random() - 0.5) * height * 2.2;
            s.z = 1;
            s.prevZ = 1;
          }
        }
        const sx = cx + s.x / s.z;
        const sy = cy + s.y / s.z;
        const px = cx + s.x / Math.min(1, s.prevZ + 0.025);
        const py = cy + s.y / Math.min(1, s.prevZ + 0.025);

        if (sx < -20 || sx > width + 20 || sy < -20 || sy > height + 20) {
          continue;
        }

        const depthAlpha = Math.min(1, (1 - s.z) * 1.15);
        const rgb =
          s.hue === 'cyan' ? '34, 211, 238' : s.hue === 'violet' ? '168, 85, 247' : '147, 197, 253';

        ctx.strokeStyle = `rgba(${rgb}, ${(depthAlpha * 0.82).toFixed(3)})`;
        ctx.lineWidth = Math.max(0.9, (1 - s.z) * 2.3);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.stroke();

        ctx.fillStyle = `rgba(255, 255, 255, ${(depthAlpha * 0.9).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(0.8, (1 - s.z) * 1.6), 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawMinimal = (testing: boolean) => {
      const speedMult = testing ? 1.8 : 1;

      // Soft drifting dust motes (half count)
      for (let i = 0; i < stars.length; i += 2) {
        const s = stars[i];
        if (shouldAnimate) {
          s.x += s.vx * 0.6 * speedMult;
          if (s.x < 0) s.x = width;
          if (s.x > width) s.x = 0;
        }
        const tw = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(time * 1.4 + s.phase));
        ctx.fillStyle = `rgba(147, 197, 253, ${tw.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }

      // Single serene horizon wave
      const yBase = height * 0.68;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 8) {
        const env = Math.sin((x / width) * Math.PI);
        const y = yBase + Math.sin(x * 0.008 + time * 1.15 * speedMult) * 7 * env;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(24, 200, 255, 0.36)';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      const fg = ctx.createLinearGradient(0, yBase - 8, 0, height);
      fg.addColorStop(0, 'rgba(24, 200, 255, 0.09)');
      fg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = fg;
      ctx.fill();
    };

    const drawOff = () => {
      // Static clean minimal ambient glow
      const fg = ctx.createLinearGradient(0, height * 0.4, 0, height);
      fg.addColorStop(0, 'rgba(24, 200, 255, 0)');
      fg.addColorStop(1, 'rgba(79, 70, 229, 0.08)');
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, width, height);
    };

    const drawFrame = () => {
      if (width <= 0 || height <= 0) return;
      const testing = isTestingRef.current;
      ctx.clearRect(0, 0, width, height);

      if (activeStyle === 'cyber') drawCyber(testing);
      else if (activeStyle === 'aurora') drawAurora(testing);
      else if (activeStyle === 'matrix') drawMatrix(testing);
      else if (activeStyle === 'warp') drawWarp(testing);
      else if (activeStyle === 'minimal') drawMinimal(testing);
      else drawOff();
    };

    const tick = () => {
      time += 0.016;
      drawFrame();
      rafId = requestAnimationFrame(tick);
    };

    if (shouldAnimate) {
      rafId = requestAnimationFrame(tick);
    } else {
      time = 1.2;
      drawFrame();
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
      if (headerEl) {
        headerEl.removeEventListener('mousemove', onMouseMove);
        headerEl.removeEventListener('mouseleave', onMouseLeave);
      }
    };
  }, [activeStyle]);

  const pausedClass = activeStyle === 'off' ? 'nv-header-paused' : '';

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none absolute inset-0 overflow-hidden rounded-[14px] ${pausedClass}`}
    >
      {/* Atmospheric animated aurora glow */}
      <div
        className="nv-aurora-left absolute -top-12 left-[8%] h-40 w-[46%] rounded-full blur-2xl opacity-85"
        style={{
          background:
            'radial-gradient(closest-side, rgba(24, 200, 255, 0.26), rgba(79, 70, 229, 0.1), transparent)',
        }}
      />
      <div
        className="nv-aurora-right absolute -bottom-14 right-[6%] h-40 w-[44%] rounded-full blur-2xl opacity-90"
        style={{
          background:
            'radial-gradient(closest-side, rgba(168, 85, 247, 0.28), rgba(91, 61, 245, 0.12), transparent)',
        }}
      />

      {/* Interactive 60fps Backdrop Canvas */}
      <canvas ref={canvasRef} className="relative block h-full w-full" />

      {/* Targeted soft contrast feather strictly under left logo text & right controls/slogan */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(10, 12, 48, 0.56) 0%, rgba(10, 12, 48, 0.12) 22%, rgba(10, 12, 48, 0) 36%, rgba(10, 12, 48, 0) 68%, rgba(7, 9, 34, 0.14) 82%, rgba(7, 9, 34, 0.52) 100%)',
        }}
      />
    </div>
  );
};
