import { describe, expect, it } from 'vitest';

describe('Integration: Bento UI Mathematics & SVG Projection Contracts', () => {
  const svgWidth = 760;
  const svgHeight = 220;
  const pad = { top: 25, right: 25, bottom: 35, left: 55 };
  const plotW = svgWidth - pad.left - pad.right; // 680
  const plotH = svgHeight - pad.top - pad.bottom; // 160
  const baselineY = pad.top + plotH; // 185

  function projectPoints(cumulativeValues: number[]) {
    const maxVal = Math.max(...cumulativeValues, 1);
    const count = Math.max(1, cumulativeValues.length - 1);

    return cumulativeValues.map((val, idx) => {
      const x = pad.left + (idx / count) * plotW;
      const y = pad.top + plotH - (val / maxVal) * plotH;
      return {
        x: Number(x.toFixed(1)),
        y: Number(y.toFixed(1)),
        val,
      };
    });
  }

  function classifyWeekLevel(totalCommits: number): number {
    if (totalCommits >= 28) return 8;
    if (totalCommits >= 22) return 7;
    if (totalCommits >= 17) return 6;
    if (totalCommits >= 12) return 5;
    if (totalCommits >= 8) return 4;
    if (totalCommits >= 5) return 3;
    if (totalCommits >= 2) return 2;
    if (totalCommits >= 1) return 1;
    return 0;
  }

  it('projects coordinate points strictly within SVG plot boundary boxes', () => {
    const sampleCommits = [0, 50, 120, 300, 750, 1200, 1800, 2164];
    const coords = projectPoints(sampleCommits);

    expect(coords).toHaveLength(sampleCommits.length);

    for (const pt of coords) {
      expect(Number.isFinite(pt.x)).toBe(true);
      expect(Number.isFinite(pt.y)).toBe(true);
      expect(Number.isNaN(pt.x)).toBe(false);
      expect(Number.isNaN(pt.y)).toBe(false);

      expect(pt.x).toBeGreaterThanOrEqual(pad.left);
      expect(pt.x).toBeLessThanOrEqual(svgWidth - pad.right);
      expect(pt.y).toBeGreaterThanOrEqual(pad.top);
      expect(pt.y).toBeLessThanOrEqual(baselineY);
    }

    // First point should be at x = pad.left, last at svgWidth - pad.right
    expect(coords[0].x).toBe(pad.left);
    expect(coords[coords.length - 1].x).toBe(svgWidth - pad.right);
  });

  it('handles zero commits boundary without division by zero or NaN', () => {
    const coords = projectPoints([0, 0, 0]);
    for (const pt of coords) {
      expect(Number.isNaN(pt.y)).toBe(false);
      expect(pt.y).toBe(baselineY);
    }
  });

  it('handles single-point dataset boundary without division by zero', () => {
    const coords = projectPoints([100]);
    expect(coords).toHaveLength(1);
    expect(Number.isNaN(coords[0].x)).toBe(false);
    expect(Number.isNaN(coords[0].y)).toBe(false);
    expect(coords[0].x).toBe(pad.left);
  });

  it('generates valid SVG closed area path strings', () => {
    const coords = projectPoints([10, 30, 80, 150]);
    const areaPathD =
      `M ${coords[0].x},${baselineY} ` +
      coords.map((pt) => `L ${pt.x},${pt.y}`).join(' ') +
      ` L ${coords[coords.length - 1].x},${baselineY} Z`;

    expect(areaPathD.startsWith(`M ${pad.left},${baselineY}`)).toBe(true);
    expect(areaPathD.endsWith(`L ${coords[coords.length - 1].x},${baselineY} Z`)).toBe(true);
    expect(areaPathD).not.toContain('NaN');
    expect(areaPathD).not.toContain('undefined');
  });

  it('classifies weekly activity into bounded levels 0 through 8 across all thresholds', () => {
    const testCases: [number, number][] = [
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 2],
      [4, 2],
      [5, 3],
      [7, 3],
      [8, 4],
      [11, 4],
      [12, 5],
      [16, 5],
      [17, 6],
      [21, 6],
      [22, 7],
      [27, 7],
      [28, 8],
      [100, 8],
    ];

    for (const [commits, expectedLevel] of testCases) {
      expect(classifyWeekLevel(commits)).toBe(expectedLevel);
    }
  });

  it('verifies monthly LOC vertical bar chart heights have minimum 12% baseline and peak at 100%', () => {
    const additions = [5000, 12000, 24000, 8000, 32000];
    const maxVal = Math.max(...additions);

    const heights = additions.map((a) => Math.max(12, Math.round((a / maxVal) * 100)));

    expect(heights).toHaveLength(5);
    // Peak must reach 100%
    expect(Math.max(...heights)).toBe(100);
    // Minimum must respect 12% visibility clamp
    for (const h of heights) {
      expect(h).toBeGreaterThanOrEqual(12);
      expect(h).toBeLessThanOrEqual(100);
    }
  });
});
