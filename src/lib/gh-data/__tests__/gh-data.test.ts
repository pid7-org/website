import { describe, expect, it } from 'vitest';
import {
  aggregateGHData,
  buildCumulativeCommits,
  buildMonthlyLoc,
  createZeroBucket,
  generateDateRange,
  mergeGHData,
} from '../aggregator.ts';

describe('GH Data Aggregator', () => {
  it('generates inclusive date range', () => {
    const range = generateDateRange('2025-01-01', '2025-01-03');
    expect(range).toEqual(['2025-01-01', '2025-01-02', '2025-01-03']);
  });

  it('aggregates commits, LOC, prs, releases and churn', () => {
    const result = aggregateGHData({
      commits: [
        { oid: 'c1', date: '2025-01-01', repo: 'turbofox', additions: 100, deletions: 20 },
        { oid: 'c2', date: '2025-01-02', repo: 'turbofox', additions: 50, deletions: 10 },
        { oid: 'c1', date: '2025-01-01', repo: 'turbofox', additions: 100, deletions: 20 }, // duplicate OID
      ],
      prs: [
        { id: 'pr1', date: '2025-01-01', repo: 'turbofox', merged: true },
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
    expect(result.cadence.total_prs).toBe(1);
    expect(result.cadence.total_releases).toBe(1);
    expect(result.total_net_loc).toBe(120); // (100 + 50) - (20 + 10)
    expect(result.top_repos[0].name).toBe('turbofox');
    expect(result.top_repos[0].net_loc).toBe(120);
    expect(result.activity['2025-01-01'].commits).toBe(1);
    expect(result.activity['2025-01-01'].additions).toBe(100);
  });

  it('builds monthly LOC stats properly', () => {
    const activity = {
      '2026-06-01': { ...createZeroBucket(), additions: 500, deletions: 100 },
      '2026-06-15': { ...createZeroBucket(), additions: 300, deletions: 50 },
      '2026-07-04': { ...createZeroBucket(), additions: 1000, deletions: 200 },
    };

    const monthly = buildMonthlyLoc(activity, 6);
    expect(monthly).toHaveLength(2);
    expect(monthly[0].month).toBe('2026-06');
    expect(monthly[0].additions).toBe(800);
    expect(monthly[0].deletions).toBe(150);
    expect(monthly[0].net).toBe(650);
    expect(monthly[1].month).toBe('2026-07');
    expect(monthly[1].additions).toBe(1000);
  });

  it('builds cumulative commit points along intervals', () => {
    const activity = {
      '2025-01-01': { ...createZeroBucket(), commits: 5 },
      '2025-01-05': { ...createZeroBucket(), commits: 3 },
      '2025-01-20': { ...createZeroBucket(), commits: 4 },
    };

    const points = buildCumulativeCommits(activity, 14);
    expect(points.length).toBeGreaterThan(0);
    const last = points[points.length - 1];
    expect(last.cumulative).toBe(12);
  });

  it('merges incremental updates without duplicating', () => {
    const initial = aggregateGHData({
      commits: [{ oid: 'c1', date: '2025-01-01', repo: 'turbofox', additions: 100, deletions: 20 }],
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
      endDateStr: '2025-01-05',
    });

    const merged = mergeGHData(
      initial,
      [{ oid: 'c2', date: '2025-01-05', repo: 'turbofox', additions: 50, deletions: 10 }],
      [],
      [],
      [],
      '2025-01-04',
      '2025-01-06'
    );

    expect(merged.cadence.total_commits).toBe(2);
    expect(merged.activity['2025-01-05'].commits).toBe(1);
    expect(merged.activity['2025-01-01'].commits).toBe(1);
  });
});
