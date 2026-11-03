import { describe, expect, it } from 'vitest';
import {
  aggregateGHData,
  buildCumulativeCommits,
  buildMonthlyLoc,
  createZeroBucket,
  formatMonthLabel,
  generateDateRange,
  mergeGHData,
} from '../aggregator.ts';

describe('GH Data Aggregator', () => {
  it('generates inclusive date range across month and year boundaries', () => {
    const range = generateDateRange('2024-12-30', '2025-01-02');
    expect(range).toEqual(['2024-12-30', '2024-12-31', '2025-01-01', '2025-01-02']);
  });

  it('handles leap day correctly in date range generation', () => {
    const leapRange = generateDateRange('2024-02-28', '2024-03-01');
    expect(leapRange).toEqual(['2024-02-28', '2024-02-29', '2024-03-01']);
  });

  it('creates clean zero bucket with zeroed totals and LOC', () => {
    const bucket = createZeroBucket();
    expect(bucket.commits).toBe(0);
    expect(bucket.additions).toBe(0);
    expect(bucket.deletions).toBe(0);
    expect(bucket.total).toBe(0);
  });

  it('formats month labels correctly', () => {
    expect(formatMonthLabel('2025-01')).toBe("Jan '25");
    expect(formatMonthLabel('2026-11')).toBe("Nov '26");
  });

  it('aggregates commits, LOC, prs, releases and churn with strict deduplication', () => {
    const result = aggregateGHData({
      commits: [
        { oid: 'c1', date: '2025-01-01', repo: 'turbofox', additions: 100, deletions: 20 },
        { oid: 'c2', date: '2025-01-02', repo: 'turbofox', additions: 50, deletions: 10 },
        { oid: 'c1', date: '2025-01-01', repo: 'turbofox', additions: 100, deletions: 20 }, // Duplicate commit OID
      ],
      prs: [
        { id: 'pr1', date: '2025-01-01', repo: 'turbofox', merged: true },
        { id: 'pr2', date: '2025-01-02', repo: 'turbofox', merged: false },
      ],
      releases: [
        { id: 'rel1', date: '2025-01-02', repo: 'turbofox' },
      ],
      issues: [
        { id: 'iss1', date: '2025-01-01', repo: 'turbofox' },
      ],
      reposMeta: [
        {
          name: 'turbofox',
          nameWithOwner: 'pid7-org/turbofox',
          desc: 'Embedded KV',
          url: 'https://github.com/pid7-org/turbofox',
          stars: 1,
          forks: 0,
          language: 'Rust',
          languageColor: '#dea584',
        },
      ],
      startDateStr: '2025-01-01',
      endDateStr: '2025-01-03',
    });

    expect(result.cadence.total_commits).toBe(2);
    expect(result.cadence.total_prs).toBe(2);
    expect(result.cadence.total_releases).toBe(1);
    expect(result.cadence.merge_rate_pct).toBe(50);
    expect(result.total_net_loc).toBe(120); // (100 + 50) - (20 + 10)
    expect(result.top_repos[0].name).toBe('turbofox');
    expect(result.top_repos[0].net_loc).toBe(120);
    expect(result.activity['2025-01-01'].commits).toBe(1);
    expect(result.activity['2025-01-01'].additions).toBe(100);
  });

  it('handles negative net LOC during massive codebase refactors and deletions', () => {
    const result = aggregateGHData({
      commits: [
        { oid: 'del1', date: '2025-01-01', repo: 'frozen-core', additions: 10, deletions: 500 },
      ],
      prs: [],
      releases: [],
      issues: [],
      reposMeta: [{
        name: 'frozen-core',
        nameWithOwner: 'pid7-org/frozen-core',
        desc: 'Core utilities',
        url: 'https://github.com/pid7-org/frozen-core',
        stars: 0,
        forks: 0,
        language: 'Rust',
        languageColor: '#dea584',
      }],
      startDateStr: '2025-01-01',
      endDateStr: '2025-01-02',
    });

    expect(result.total_net_loc).toBe(-490);
    expect(result.top_repos[0].net_loc).toBe(-490);
    expect(result.top_repos[0].additions).toBe(10);
    expect(result.top_repos[0].deletions).toBe(500);
  });

  it('handles zero PRs gracefully without NaN in merge_rate_pct', () => {
    const result = aggregateGHData({
      commits: [{ oid: 'c1', date: '2025-01-01', repo: 'turbofox', additions: 10, deletions: 2 }],
      prs: [],
      releases: [],
      issues: [],
      reposMeta: [],
      startDateStr: '2025-01-01',
      endDateStr: '2025-01-01',
    });

    expect(result.cadence.merge_rate_pct).toBe(100);
    expect(Number.isNaN(result.cadence.merge_rate_pct)).toBe(false);
  });

  it('ranks top 5 repos by commit volume and churn accurately', () => {
    const reposMeta = [
      { name: 'r1', nameWithOwner: 'o/r1', desc: '', url: '', stars: 0, forks: 0, language: 'Rust', languageColor: '' },
      { name: 'r2', nameWithOwner: 'o/r2', desc: '', url: '', stars: 0, forks: 0, language: 'Rust', languageColor: '' },
      { name: 'r3', nameWithOwner: 'o/r3', desc: '', url: '', stars: 0, forks: 0, language: 'Rust', languageColor: '' },
      { name: 'r4', nameWithOwner: 'o/r4', desc: '', url: '', stars: 0, forks: 0, language: 'Rust', languageColor: '' },
      { name: 'r5', nameWithOwner: 'o/r5', desc: '', url: '', stars: 0, forks: 0, language: 'Rust', languageColor: '' },
      { name: 'r6', nameWithOwner: 'o/r6', desc: '', url: '', stars: 0, forks: 0, language: 'Rust', languageColor: '' },
    ];

    const commits = [
      { oid: '1', date: '2025-01-01', repo: 'r1', additions: 10, deletions: 2 },
      { oid: '2', date: '2025-01-01', repo: 'r1', additions: 10, deletions: 2 },
      { oid: '3', date: '2025-01-01', repo: 'r1', additions: 10, deletions: 2 },
      { oid: '4', date: '2025-01-01', repo: 'r2', additions: 50, deletions: 10 },
      { oid: '5', date: '2025-01-01', repo: 'r2', additions: 50, deletions: 10 },
      { oid: '6', date: '2025-01-01', repo: 'r3', additions: 5, deletions: 1 },
      { oid: '7', date: '2025-01-01', repo: 'r4', additions: 2, deletions: 1 },
      { oid: '8', date: '2025-01-01', repo: 'r5', additions: 1, deletions: 0 },
      { oid: '9', date: '2025-01-01', repo: 'r6', additions: 0, deletions: 0 },
    ];

    const result = aggregateGHData({
      commits,
      prs: [],
      releases: [],
      issues: [],
      reposMeta,
      startDateStr: '2025-01-01',
      endDateStr: '2025-01-02',
    });

    expect(result.top_repos).toHaveLength(5);
    expect(result.top_repos[0].name).toBe('r1');
    expect(result.top_repos[1].name).toBe('r2');
    expect(result.top_repos.some((r) => r.name === 'r6')).toBe(false);
  });

  it('slices monthly LOC to specified limit and preserves chronological order', () => {
    const activity: Record<string, ReturnType<typeof createZeroBucket>> = {};
    const months = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06', '2025-07'];
    months.forEach((m, i) => {
      activity[`${m}-10`] = { ...createZeroBucket(), additions: (i + 1) * 100, deletions: (i + 1) * 20 };
    });

    const monthly = buildMonthlyLoc(activity, 4);
    expect(monthly).toHaveLength(4);
    expect(monthly[0].month).toBe('2025-04');
    expect(monthly[3].month).toBe('2025-07');
    expect(monthly[3].additions).toBe(700);
    expect(monthly[3].net).toBe(560);
  });

  it('guarantees cumulative commits points are monotonic non-decreasing and sum equals total', () => {
    const activity = {
      '2025-01-01': { ...createZeroBucket(), commits: 4 },
      '2025-01-10': { ...createZeroBucket(), commits: 6 },
      '2025-01-20': { ...createZeroBucket(), commits: 2 },
      '2025-02-05': { ...createZeroBucket(), commits: 8 },
      '2025-02-25': { ...createZeroBucket(), commits: 10 },
    };

    const points = buildCumulativeCommits(activity, 14);
    expect(points.length).toBeGreaterThan(1);

    for (let i = 1; i < points.length; i++) {
      expect(points[i].cumulative).toBeGreaterThanOrEqual(points[i - 1].cumulative);
    }

    const totalFromDeltas = points.reduce((acc, p) => acc + p.interval_delta, 0);
    const lastPoint = points[points.length - 1];
    expect(totalFromDeltas).toBe(30);
    expect(lastPoint.cumulative).toBe(30);
  });

  it('merges incremental updates without duplicating past or overwriting uninspected days', () => {
    const initial = aggregateGHData({
      commits: [
        { oid: 'c1', date: '2025-01-01', repo: 'turbofox', additions: 100, deletions: 20 },
        { oid: 'c2', date: '2025-01-05', repo: 'turbofox', additions: 40, deletions: 10 },
      ],
      prs: [],
      releases: [],
      issues: [],
      reposMeta: [{
        name: 'turbofox',
        nameWithOwner: 'pid7-org/turbofox',
        desc: 'Embedded KV',
        url: 'https://github.com/pid7-org/turbofox',
        stars: 1,
        forks: 0,
        language: 'Rust',
        languageColor: '#dea584',
      }],
      startDateStr: '2025-01-01',
      endDateStr: '2025-01-07',
    });

    // Run incremental refresh on days 2025-01-05 to 2025-01-07
    const merged = mergeGHData(
      initial,
      [
        { oid: 'c2', date: '2025-01-05', repo: 'turbofox', additions: 40, deletions: 10 },
        { oid: 'c3', date: '2025-01-06', repo: 'turbofox', additions: 80, deletions: 15 },
      ],
      [],
      [],
      [],
      '2025-01-05',
      '2025-01-07'
    );

    expect(merged.cadence.total_commits).toBe(3);
    expect(merged.activity['2025-01-01'].commits).toBe(1);
    expect(merged.activity['2025-01-05'].commits).toBe(1);
    expect(merged.activity['2025-01-06'].commits).toBe(1);
    expect(merged.total_net_loc).toBe((100 - 20) + (40 - 10) + (80 - 15));
  });
});
