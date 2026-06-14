import { useId, useMemo } from "react";

type PerformanceChartProps = {
  data: number[];
  width?: number;
  height?: number;
  max?: number;
};

// Build a smooth (Catmull-Rom -> cubic bezier) path through the points.
function smoothLine(points: Array<[number, number]>): string {
  if (points.length < 2) return "";
  const d: string[] = [`M ${points[0][0]},${points[0][1]}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`);
  }
  return d.join(" ");
}

export function PerformanceChart({
  data,
  width = 720,
  height = 300,
  max = 10,
}: PerformanceChartProps) {
  const uid = useId().replace(/:/g, "");
  const padX = 8;
  const padTop = 16;
  const padBottom = 8;

  const { line, area, last } = useMemo(() => {
    const innerW = width - padX * 2;
    const innerH = height - padTop - padBottom;
    const step = innerW / (data.length - 1);
    const pts: Array<[number, number]> = data.map((v, i) => [
      padX + i * step,
      padTop + innerH - (Math.min(v, max) / max) * innerH,
    ]);
    const linePath = smoothLine(pts);
    const areaPath = `${linePath} L ${pts[pts.length - 1][0]},${height - padBottom} L ${pts[0][0]},${
      height - padBottom
    } Z`;
    return { line: linePath, area: areaPath, last: pts[pts.length - 1] };
  }, [data, width, height, max]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-full w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label="Throughput over time"
    >
      <defs>
        <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a78bff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#a78bff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`line-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7c5cff" />
          <stop offset="100%" stopColor="#cfbcff" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#area-${uid})`} />
      <path
        d={line}
        fill="none"
        stroke={`url(#line-${uid})`}
        strokeWidth={2.5}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0]} cy={last[1]} r={9} fill="#cfbcff" opacity={0.25} />
      <circle cx={last[0]} cy={last[1]} r={4} fill="#ffffff" />
    </svg>
  );
}
