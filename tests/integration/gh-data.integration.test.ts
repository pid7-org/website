import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GHDataOutput } from '../../src/lib/gh-data/types.ts';

describe('Integration: GitHub Data Artifact Integrity', () => {
  const filePath = path.join(process.cwd(), 'src', 'assets', 'gh-data.json');
  const raw = readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw) as GHDataOutput;

  it('contains all required top-level schema fields and valid dates', () => {
    expect(data.start_date).toBe('2025-01-01');
    expect(typeof data.generated_at).toBe('string');
    expect(new Date(data.generated_at).getTime()).not.toBeNaN();
    expect(typeof data.end_date).toBe('string');
    expect(data.repos_count).toBeGreaterThanOrEqual(1);
    expect(typeof data.total_net_loc).toBe('number');
  });

  it('enforces total commit invariant: cadence total equals sum of daily activity', () => {
    let sumCommits = 0;
    for (const b of Object.values(data.activity)) {
      sumCommits += b.commits;
    }
    expect(data.cadence.total_commits).toBe(sumCommits);
    expect(data.cadence.total_commits).toBeGreaterThan(0);
  });

  it('enforces net LOC invariant: total net LOC equals sum of daily additions minus deletions', () => {
    let sumAdditions = 0;
    let sumDeletions = 0;
    for (const b of Object.values(data.activity)) {
      sumAdditions += b.additions;
      sumDeletions += b.deletions;
    }
    const expectedNet = sumAdditions - sumDeletions;
    expect(data.total_net_loc).toBe(expectedNet);
  });

  it('verifies top 5 repositories data contracts and net churn math', () => {
    expect(data.top_repos.length).toBeGreaterThanOrEqual(1);
    expect(data.top_repos.length).toBeLessThanOrEqual(5);

    for (const repo of data.top_repos) {
      expect(repo.name).toBeTruthy();
      expect(repo.url).toMatch(/^https:\/\/github\.com\//);
      expect(repo.commits).toBeGreaterThan(0);
      expect(repo.additions).toBeGreaterThanOrEqual(0);
      expect(repo.deletions).toBeGreaterThanOrEqual(0);
      expect(repo.net_loc).toBe(repo.additions - repo.deletions);
    }
  });

  it('verifies monthly LOC data contracts and chronological order', () => {
    expect(data.monthly_loc.length).toBeGreaterThan(0);
    expect(data.monthly_loc.length).toBeLessThanOrEqual(6);

    for (let i = 0; i < data.monthly_loc.length; i++) {
      const m = data.monthly_loc[i];
      expect(m.month).toMatch(/^\d{4}-\d{2}$/);
      expect(m.label).toBeTruthy();
      expect(m.additions).toBeGreaterThanOrEqual(0);
      expect(m.deletions).toBeGreaterThanOrEqual(0);
      expect(m.net).toBe(m.additions - m.deletions);

      if (i > 0) {
        expect(m.month > data.monthly_loc[i - 1].month).toBe(true);
      }
    }
  });

  it('verifies cumulative commits trajectory monotonicity and milestone consistency', () => {
    expect(data.cumulative_commits.length).toBeGreaterThan(0);

    for (let i = 0; i < data.cumulative_commits.length; i++) {
      const pt = data.cumulative_commits[i];
      expect(pt.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(pt.cumulative).toBeGreaterThanOrEqual(0);
      expect(pt.interval_delta).toBeGreaterThanOrEqual(0);

      if (i > 0) {
        // Monotonic non-decreasing
        expect(pt.cumulative).toBeGreaterThanOrEqual(data.cumulative_commits[i - 1].cumulative);
      }
    }

    const last = data.cumulative_commits[data.cumulative_commits.length - 1];
    expect(last.cumulative).toBe(data.cadence.total_commits);
  });
});
