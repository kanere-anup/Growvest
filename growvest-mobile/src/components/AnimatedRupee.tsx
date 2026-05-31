import React, {useEffect, useRef, useState, useCallback} from 'react';
import {View, PanResponder, Text} from 'react-native';
import Svg, {Circle, Line, Defs, RadialGradient, Stop, Rect, G} from 'react-native-svg';
import {useTheme} from '../context/ThemeContext';

// 3D point
interface P3 { x: number; y: number; z: number }

// Project 3D → 2D with perspective
function project(p: P3, rotX: number, rotY: number, cx: number, cy: number, fl: number): {x: number; y: number; depth: number} {
  // Rotate around Y axis
  let x1 = p.x * Math.cos(rotY) - p.z * Math.sin(rotY);
  let z1 = p.x * Math.sin(rotY) + p.z * Math.cos(rotY);
  let y1 = p.y;
  // Rotate around X axis
  let y2 = y1 * Math.cos(rotX) - z1 * Math.sin(rotX);
  let z2 = y1 * Math.sin(rotX) + z1 * Math.cos(rotX);
  // Perspective
  const scale = fl / (fl + z2);
  return {
    x: cx + x1 * scale,
    y: cy + y2 * scale,
    depth: z2,
  };
}

// GrowVest logo: upward trending chart arrow in 3D
function generate3DPoints(): {main: P3[]; grid: P3[][]; arrow: P3[]; particles: P3[]; ring: P3[]} {
  // Main chart line (trending upward with dips — like a stock chart)
  const main: P3[] = [];
  const chartY = [30, 25, 28, 15, 20, 10, 18, 5, -5, -15, -25, -35, -40];
  for (let i = 0; i < chartY.length; i++) {
    const t = i / (chartY.length - 1);
    main.push({x: -55 + t * 110, y: chartY[i], z: 0});
  }

  // Arrow head at the end of chart (pointing up-right)
  const lastPt = main[main.length - 1];
  const arrow: P3[] = [
    {x: lastPt.x - 12, y: lastPt.y + 2, z: 0},
    {x: lastPt.x, y: lastPt.y, z: 0},
    {x: lastPt.x - 2, y: lastPt.y + 12, z: 0},
  ];

  // 3D grid lines (floor plane) for depth effect
  const grid: P3[][] = [];
  for (let gz = -30; gz <= 30; gz += 15) {
    const row: P3[] = [];
    for (let gx = -60; gx <= 60; gx += 10) {
      row.push({x: gx, y: 40, z: gz});
    }
    grid.push(row);
  }
  for (let gx = -60; gx <= 60; gx += 20) {
    const col: P3[] = [];
    for (let gz = -30; gz <= 30; gz += 10) {
      col.push({x: gx, y: 40, z: gz});
    }
    grid.push(col);
  }

  // Floating particles in 3D space
  const particles: P3[] = [];
  for (let i = 0; i < 30; i++) {
    particles.push({
      x: (Math.random() - 0.5) * 140,
      y: (Math.random() - 0.5) * 100,
      z: (Math.random() - 0.5) * 60,
    });
  }

  // Orbital ring around the chart
  const ring: P3[] = [];
  for (let a = 0; a < Math.PI * 2; a += 0.15) {
    ring.push({
      x: Math.cos(a) * 70,
      y: Math.sin(a) * 45,
      z: Math.sin(a) * 25,
    });
  }

  return {main, grid, arrow, particles, ring};
}

interface Props {
  size?: number;
}

export default function AnimatedRupee({size = 260}: Props) {
  const {colors} = useTheme();
  const data = useRef(generate3DPoints()).current;
  const [rotX, setRotX] = useState(0.15);
  const [rotY, setRotY] = useState(-0.2);
  const [tick, setTick] = useState(0);
  const autoRotRef = useRef(true);
  const touchTimeout = useRef<any>(null);
  const containerRef = useRef<View>(null);
  const layoutRef = useRef({x: 0, y: 0, w: size, h: size * 0.7});

  const cx = 130;
  const cy = 90;
  const fl = 250;
  const vw = 260;
  const vh = 180;

  // Animation loop (~30fps)
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Auto-rotate when not touching
  useEffect(() => {
    if (autoRotRef.current) {
      setRotY(ry => ry + 0.008);
    }
  }, [tick]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        autoRotRef.current = false;
        if (touchTimeout.current) clearTimeout(touchTimeout.current);
      },
      onPanResponderMove: (_, g) => {
        setRotY(ry => ry + g.dx * 0.002);
        setRotX(rx => {
          const next = rx + g.dy * 0.002;
          return Math.max(-0.6, Math.min(0.6, next));
        });
      },
      onPanResponderRelease: () => {
        touchTimeout.current = setTimeout(() => {
          autoRotRef.current = true;
        }, 2000);
      },
    })
  ).current;

  const time = tick * 0.05;

  // Project all points
  const projMain = data.main.map(p => project(p, rotX, rotY, cx, cy, fl));
  const projArrow = data.arrow.map(p => project(p, rotX, rotY, cx, cy, fl));

  return (
    <View
      ref={containerRef}
      {...panResponder.panHandlers}
      style={{width: size, height: size * 0.7, alignSelf: 'center'}}>
      <Svg width={size} height={size * 0.7} viewBox={`0 0 ${vw} ${vh}`}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.primary} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={colors.primary} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Background glow */}
        <Circle cx={cx} cy={cy} r={75} fill="url(#glow)" />

        {/* 3D Grid floor */}
        {data.grid.map((line, li) => {
          const projected = line.map(p => project(p, rotX, rotY, cx, cy, fl));
          return projected.slice(0, -1).map((p1, i) => {
            const p2 = projected[i + 1];
            return (
              <Line
                key={`g${li}-${i}`}
                x1={p1.x} y1={p1.y}
                x2={p2.x} y2={p2.y}
                stroke={colors.primary}
                strokeWidth={0.5}
                opacity={0.12}
              />
            );
          });
        })}

        {/* Orbital ring */}
        {data.ring.map((p, i) => {
          const proj = project(p, rotX, rotY, cx, cy, fl);
          const pulse = Math.sin(time * 2 + i * 0.3);
          const opacity = 0.08 + pulse * 0.06;
          return (
            <Circle
              key={`r${i}`}
              cx={proj.x} cy={proj.y}
              r={1.5 + pulse * 0.5}
              fill={colors.primary}
              opacity={Math.max(0, opacity)}
            />
          );
        })}

        {/* Floating particles */}
        {data.particles.map((p, i) => {
          const animated: P3 = {
            x: p.x + Math.sin(time + i) * 5,
            y: p.y + Math.cos(time * 0.7 + i * 0.5) * 4,
            z: p.z + Math.sin(time * 0.5 + i * 0.8) * 5,
          };
          const proj = project(animated, rotX, rotY, cx, cy, fl);
          const pulse = Math.sin(time * 1.5 + i * 1.2);
          return (
            <Circle
              key={`p${i}`}
              cx={proj.x} cy={proj.y}
              r={1 + pulse * 0.8}
              fill={colors.primary}
              opacity={0.1 + pulse * 0.15}
            />
          );
        })}

        {/* Chart line segments with glow */}
        {projMain.slice(0, -1).map((p1, i) => {
          const p2 = projMain[i + 1];
          const progress = i / (projMain.length - 2);
          const glow = Math.sin(time * 3 - progress * 4);
          const opacity = 0.5 + glow * 0.3;
          const width = 2 + glow * 1;
          return (
            <React.Fragment key={`cl${i}`}>
              {/* Glow line */}
              <Line
                x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke={colors.primary}
                strokeWidth={width + 4}
                opacity={opacity * 0.15}
                strokeLinecap="round"
              />
              {/* Main line */}
              <Line
                x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke={colors.primary}
                strokeWidth={width}
                opacity={opacity + 0.2}
                strokeLinecap="round"
              />
            </React.Fragment>
          );
        })}

        {/* Chart dots */}
        {projMain.map((p, i) => {
          const wave = Math.sin(time * 3 - (i / projMain.length) * 5);
          const r = 3 + wave * 1.2;
          const opacity = 0.6 + wave * 0.35;
          return (
            <React.Fragment key={`cd${i}`}>
              <Circle cx={p.x} cy={p.y} r={r + 3} fill={colors.primary} opacity={opacity * 0.15} />
              <Circle cx={p.x} cy={p.y} r={r} fill={colors.primary} opacity={opacity} />
            </React.Fragment>
          );
        })}

        {/* Arrow head */}
        {projArrow.map((p, i) => (
          <React.Fragment key={`ar${i}`}>
            <Line
              x1={projMain[projMain.length - 1].x}
              y1={projMain[projMain.length - 1].y}
              x2={p.x} y2={p.y}
              stroke={colors.primary}
              strokeWidth={2.5}
              opacity={0.9}
              strokeLinecap="round"
            />
            <Circle cx={p.x} cy={p.y} r={2.5} fill={colors.primary} opacity={0.9} />
          </React.Fragment>
        ))}

        {/* Traveling pulse along chart */}
        {(() => {
          const pulsePos = (time * 0.6) % 1;
          const idx = Math.floor(pulsePos * (projMain.length - 1));
          const nextIdx = Math.min(idx + 1, projMain.length - 1);
          const frac = (pulsePos * (projMain.length - 1)) - idx;
          const px = projMain[idx].x + (projMain[nextIdx].x - projMain[idx].x) * frac;
          const py = projMain[idx].y + (projMain[nextIdx].y - projMain[idx].y) * frac;
          return (
            <>
              <Circle cx={px} cy={py} r={10} fill={colors.primary} opacity={0.1} />
              <Circle cx={px} cy={py} r={6} fill={colors.primary} opacity={0.2} />
              <Circle cx={px} cy={py} r={3} fill="#fff" opacity={0.8} />
            </>
          );
        })()}

      </Svg>

      {/* GrowVest text overlay */}
      <View style={{position: 'absolute', bottom: 4, left: 0, right: 0, alignItems: 'center'}}>
        <Text style={{
          fontSize: 10, fontWeight: '600', color: colors.primary,
          letterSpacing: 3, opacity: 0.5,
        }}>
          GROWVEST
        </Text>
      </View>
    </View>
  );
}
