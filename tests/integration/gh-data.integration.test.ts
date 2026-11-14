import { describe, expect, it } from 'vitest';
import { createMockGHData } from '../fixtures/gh-data.fixture.ts';

describe('Integration: GitHub Data Invariant & Integrity Contracts', () => {
  it('enforces total commit invariant: cadence total equals sum of daily activity', () => {
    const data = createMockGHData();
    let sumCommits = 0;
    for (const b of Object.values(data.activity)) {
      sumCommits += b.commits;
    }
    expect(data.cadence.total_commits).toBe(sumCommits);
    expect(data.cadence.total_commits).toBeGreaterThan(0);
  });

  it('enforces net LOC invariant: total net LOC equals sum of daily additions minus deletions', () => {
    const data = createMockGHData();
    let sumAdditions = 0;
    let sumDeletions = 0;
    for (const b of Object.values(data.activity)) {
      sumAdditions += b.additions;
      sumDeletions += b.deletions;
    }
    const expectedNet = sumAdditions - sumDeletions;
    expect(data.total_net_loc).toBe(expectedNet);
  });

  it('verifies repository net churn invariant across top repositories', () => {
    const data = createMockGHData({
      top_repos: [
        {
          name: 'kernel',
          url: 'https://github.com/mock/kernel',
          commits: 15,
          additions: 1200,
          deletions: 400,
          net_loc: 800,
        },
      ],
    });

    for (const repo of data.top_repos) {
      expect(repo.name).toBeTruthy();
      expect(repo.url).toMatch(/^https:\/\/github\.com\//);
      expect(repo.net_loc).toBe(repo.additions - repo.deletions);
    }
  });

  it('handles negative churn boundaries without invariant degradation', () => {
    const data = createMockGHData({
      total_net_loc: -250,
      activity: {
        '2025-01-01': { commits: 2, additions: 50, deletions: 300, prs: 0, releases: 0, issues: 0 },
      },
    });

    const netActivity = Object.values(data.activity).reduce(
      (acc, curr) => acc + (curr.additions - curr.deletions),
      0
    );
    expect(data.total_net_loc).toBe(netActivity);
  });

  it('verifies cumulative commit progression is strictly non-decreasing', () => {
    const data = createMockGHData();
    let prev = 0;
    for (const point of data.cumulative_commits) {
      expect(point.cumulative).toBeGreaterThanOrEqual(prev);
      prev = point.cumulative;
    }
  });

  it('validates monthly LOC chronologically and preserves net additions invariant', () => {
    const data = createMockGHData({
      monthly_loc: [
        { month: '2024-11', additions: 100, deletions: 40, net: 60 },
        { month: '2024-12', additions: 300, deletions: 120, net: 180 },
        { month: '2025-01', additions: 250, deletions: 50, net: 200 },
      ],
    });

    for (let i = 0; i < data.monthly_loc.length; i++) {
      const m = data.monthly_loc[i];
      expect(m.month).toMatch(/^\d{4}-\d{2}$/);
      expect(m.net).toBe(m.additions - m.deletions);
      if (i > 0) {
        expect(m.month > data.monthly_loc[i - 1].month).toBe(true);
      }
    }
  });
});
