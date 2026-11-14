import { describe, expect, it } from 'vitest';
import {
  generateAsciiBar,
  generateSvgAreaPath,
  projectCumulativeCurve,
} from '../../src/lib/chart/projection.ts';

describe('Chart & SVG Projection Engine Contracts', () => {
  const dimensions = { width: 760, height: 150 };
  const pad = { top: 15, right: 15, bottom: 25, left: 45 };
  const plotW = dimensions.width - pad.left - pad.right;
  const plotH = dimensions.height - pad.top - pad.bottom;
  const baselineY = pad.top + plotH;

  it('projects coordinate points strictly within boundary boxes', () => {
    const raw = [0, 50, 120, 300, 750, 1200, 1800, 2164];
    const points = raw.map((cumulative, i) => ({
      date: `2025-01-0${i + 1}`,
      cumulative,
    }));

    const coords = projectCumulativeCurve(points, dimensions, pad);
    expect(coords).toHaveLength(points.length);

    for (const pt of coords) {
      expect(Number.isFinite(pt.x)).toBe(true);
      expect(Number.isFinite(pt.y)).toBe(true);
      expect(pt.x).toBeGreaterThanOrEqual(pad.left);
      expect(pt.x).toBeLessThanOrEqual(dimensions.width - pad.right);
      expect(pt.y).toBeGreaterThanOrEqual(pad.top);
      expect(pt.y).toBeLessThanOrEqual(baselineY);
    }

    expect(coords[0].x).toBe(pad.left);
    expect(coords[coords.length - 1].x).toBe(dimensions.width - pad.right);
  });

  it('handles empty points array gracefully without errors', () => {
    const coords = projectCumulativeCurve([], dimensions, pad);
    expect(coords).toEqual([]);
    expect(generateSvgAreaPath(coords, baselineY)).toBe('');
  });

  it('handles all-zero commits boundary without NaN or division by zero', () => {
    const points = [
      { date: '2025-01-01', cumulative: 0 },
      { date: '2025-01-02', cumulative: 0 },
    ];
    const coords = projectCumulativeCurve(points, dimensions, pad);

    for (const pt of coords) {
      expect(Number.isNaN(pt.y)).toBe(false);
      expect(pt.y).toBe(baselineY);
    }
  });

  it('handles single-point dataset boundary without division by zero', () => {
    const coords = projectCumulativeCurve(
      [{ date: '2025-01-01', cumulative: 100 }],
      dimensions,
      pad
    );
    expect(coords).toHaveLength(1);
    expect(Number.isNaN(coords[0].x)).toBe(false);
    expect(Number.isNaN(coords[0].y)).toBe(false);
    expect(coords[0].x).toBe(pad.left);
    expect(coords[0].y).toBe(pad.top);
  });

  it('generates valid SVG closed area path strings with correct boundary anchors', () => {
    const points = [
      { date: '2025-01-01', cumulative: 10 },
      { date: '2025-01-02', cumulative: 30 },
      { date: '2025-01-03', cumulative: 80 },
    ];
    const coords = projectCumulativeCurve(points, dimensions, pad);
    const areaPathD = generateSvgAreaPath(coords, baselineY);

    expect(areaPathD.startsWith(`M ${coords[0].x},${baselineY}`)).toBe(true);
    expect(areaPathD.endsWith(`L ${coords[coords.length - 1].x},${baselineY} Z`)).toBe(true);
    expect(areaPathD).not.toContain('NaN');
    expect(areaPathD).not.toContain('undefined');
  });

  it('generates ASCII bar with filled and empty slots bounded by requested total slots', () => {
    const slots = 14;
    const bar = generateAsciiBar(50, 100, slots);

    expect(bar.filled.length + bar.empty.length).toBe(slots);
    expect(bar.filled).toBe('█'.repeat(7));
    expect(bar.empty).toBe('░'.repeat(7));

    const zeroBar = generateAsciiBar(0, 100, slots);
    expect(zeroBar.filled.length).toBeGreaterThanOrEqual(1); // Baseline visibility
    expect(zeroBar.filled.length + zeroBar.empty.length).toBe(slots);

    const fullBar = generateAsciiBar(150, 100, slots);
    expect(fullBar.filled.length).toBe(slots);
    expect(fullBar.empty.length).toBe(0);
  });
});
