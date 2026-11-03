export interface DailyActivity {
  commits: number;
  pull_requests: number;
  issues: number;
  discussions: number;
  releases: number;
  additions: number;
  deletions: number;
  total: number;
}

export interface CadenceStats {
  total_commits: number;
  total_prs: number;
  total_releases: number;
  monthly_avg_commits: number;
  merge_rate_pct: number;
}

export interface RepoChurnStat {
  name: string;
  nameWithOwner: string;
  url: string;
  commits: number;
  additions: number;
  deletions: number;
  net_loc: number;
  primaryLanguage?: string;
  primaryColor?: string;
}

export interface MonthlyLocStat {
  month: string; // YYYY-MM
  label: string; // e.g. "Jun '26" or "Jun"
  year: number;
  additions: number;
  deletions: number;
  net: number;
}

export interface CumulativeCommitPoint {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "Jan '25"
  cumulative: number;
  interval_delta: number;
}

export interface GHProjectItem {
  name: string;
  nameWithOwner: string;
  desc: string;
  url: string;
  stars: number;
  forks: number;
  language: string;
  languageColor: string;
  commits: number;
  releases: number;
  pullRequests: number;
  issues: number;
  contributions: number;
}

export interface GHDataOutput {
  generated_at: string;
  start_date: string; // e.g. "2025-01-01"
  end_date: string;
  repos_count: number;
  total_net_loc: number;
  cadence: CadenceStats;
  top_repos: RepoChurnStat[];
  monthly_loc: MonthlyLocStat[];
  cumulative_commits: CumulativeCommitPoint[];
  activity: Record<string, DailyActivity>;
  projects: GHProjectItem[];
}
