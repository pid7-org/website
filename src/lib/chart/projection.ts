export interface ChartDimensions {
  width: number;
  height: number;
}

export interface ChartPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface CumulativePoint {
  date: string;
  cumulative: number;
  [key: string]: unknown;
}

export interface ProjectedPoint extends CumulativePoint {
  x: number;
  y: number;
}

export interface AsciiBar {
  filled: string;
  empty: string;
}

export function generateAsciiBar(
  commits: number,
  maxRepoCommits: number,
  barSlots: number = 14
): AsciiBar {
  const safeMax = Math.max(1, maxRepoCommits);
  const safeSlots = Math.max(1, barSlots);
  const safeCommits = Math.max(0, commits);

  const filledCount = Math.min(
    safeSlots,
    Math.max(1, Math.round((safeCommits / safeMax) * safeSlots))
  );
  const emptyCount = Math.max(0, safeSlots - filledCount);

  return {
    filled: '█'.repeat(filledCount),
    empty: '░'.repeat(emptyCount),
  };
}

export function projectCumulativeCurve(
  points: CumulativePoint[],
  dimensions: ChartDimensions,
  padding: ChartPadding
): ProjectedPoint[] {
  if (!points || points.length === 0) {
    return [];
  }

  const plotW = Math.max(0, dimensions.width - padding.left - padding.right);
  const plotH = Math.max(0, dimensions.height - padding.top - padding.bottom);
  const maxCommits = Math.max(...points.map((p) => p.cumulative), 1);
  const stepCount = Math.max(1, points.length - 1);

  return points.map((p, idx) => {
    const x = padding.left + (idx / stepCount) * plotW;
    const y = padding.top + plotH - (Math.max(0, p.cumulative) / maxCommits) * plotH;
    return {
      ...p,
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
    };
  });
}

export function generateSvgAreaPath(
  plotPoints: Array<{ x: number; y: number }>,
  baselineY: number
): string {
  if (!plotPoints || plotPoints.length === 0) {
    return '';
  }

  const start = `M ${plotPoints[0].x},${baselineY}`;
  const lines = plotPoints.map((pt) => `L ${pt.x},${pt.y}`).join(' ');
  const close = `L ${plotPoints[plotPoints.length - 1].x},${baselineY} Z`;

  return `${start} ${lines} ${close}`;
}
