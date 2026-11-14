import type { GHDataOutput } from '../../src/lib/gh-data/types.ts';

export function createMockGHData(overrides: Partial<GHDataOutput> = {}): GHDataOutput {
  const defaultActivity = {
    '2025-01-01': { commits: 5, additions: 150, deletions: 50, prs: 1, releases: 0, issues: 0 },
    '2025-01-02': { commits: 10, additions: 300, deletions: 100, prs: 0, releases: 1, issues: 0 },
    '2025-01-03': { commits: 15, additions: 500, deletions: 200, prs: 2, releases: 0, issues: 1 },
  };

  return {
    start_date: '2025-01-01',
    end_date: '2025-01-03',
    generated_at: new Date('2025-01-04T00:00:00Z').toISOString(),
    repos_count: 2,
    total_net_loc: 600, // (150-50) + (300-100) + (500-200) = 100 + 200 + 300 = 600
    top_repos: [
      {
        name: 'repo-alpha',
        url: 'https://github.com/mock/repo-alpha',
        commits: 20,
        additions: 650,
        deletions: 250,
        net_loc: 400,
      },
      {
        name: 'repo-beta',
        url: 'https://github.com/mock/repo-beta',
        commits: 10,
        additions: 300,
        deletions: 100,
        net_loc: 200,
      },
    ],
    cadence: {
      total_commits: 30,
      total_prs: 3,
      total_releases: 1,
      total_issues: 1,
      active_days: 3,
      avg_commits_per_day: 10,
      monthly_avg_commits: 30,
      merge_rate_pct: 100,
    },
    cumulative_commits: [
      { date: '2025-01-01', cumulative: 5 },
      { date: '2025-01-02', cumulative: 15 },
      { date: '2025-01-03', cumulative: 30 },
    ],
    monthly_loc: [
      { month: '2025-01', additions: 950, deletions: 350, net: 600 },
    ],
    activity: defaultActivity,
    ...overrides,
  };
}
