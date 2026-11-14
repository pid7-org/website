import type {
  CadenceStats,
  CumulativeCommitPoint,
  DailyActivity,
  GHDataOutput,
  GHProjectItem,
  MonthlyLocStat,
  RepoChurnStat,
} from './types.ts';

export interface RawCommit {
  oid: string;
  date: string; // YYYY-MM-DD
  repo: string;
  additions: number;
  deletions: number;
}

export interface RawPR {
  id: string;
  date: string;
  repo: string;
  merged: boolean;
}

export interface RawRelease {
  id: string;
  date: string;
  repo: string;
}

export interface RawIssue {
  id: string;
  date: string;
  repo: string;
}

export interface RawRepoMeta {
  name: string;
  nameWithOwner: string;
  desc: string;
  url: string;
  stars: number;
  forks: number;
  language: string;
  languageColor: string;
  latestRelease?: {
    tagName: string;
    publishedAt: string | null;
    url: string;
  } | null;
  bannerUrl?: string | null;
}

export function generateDateRange(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  let current = new Date(`${startDateStr}T00:00:00Z`);
  const end = new Date(`${endDateStr}T00:00:00Z`);

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export function createZeroBucket(): DailyActivity {
  return {
    commits: 0,
    pull_requests: 0,
    issues: 0,
    discussions: 0,
    releases: 0,
    additions: 0,
    deletions: 0,
    total: 0,
  };
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatMonthLabel(yearMonth: string): string {
  const [yearStr, monthStr] = yearMonth.split('-');
  const monthIdx = parseInt(monthStr, 10) - 1;
  const shortYear = yearStr.slice(2);
  return `${MONTH_NAMES[monthIdx]} '${shortYear}`;
}

export function buildMonthlyLoc(activity: Record<string, DailyActivity>, limit = 6): MonthlyLocStat[] {
  const map = new Map<string, { additions: number; deletions: number }>();

  for (const [dateStr, bucket] of Object.entries(activity)) {
    const ym = dateStr.slice(0, 7);
    const existing = map.get(ym) || { additions: 0, deletions: 0 };
    existing.additions += bucket.additions;
    existing.deletions += bucket.deletions;
    map.set(ym, existing);
  }

  const sortedMonths = Array.from(map.keys()).sort();
  const recentMonths = sortedMonths.slice(-limit);

  return recentMonths.map((ym) => {
    const data = map.get(ym)!;
    const [yStr, mStr] = ym.split('-');
    const mIdx = parseInt(mStr, 10) - 1;
    return {
      month: ym,
      label: MONTH_NAMES[mIdx] || ym,
      year: parseInt(yStr, 10),
      additions: data.additions,
      deletions: data.deletions,
      net: data.additions - data.deletions,
    };
  });
}

export function buildCumulativeCommits(
  activity: Record<string, DailyActivity>,
  intervalDays = 14
): CumulativeCommitPoint[] {
  const sortedDates = Object.keys(activity).sort();
  if (sortedDates.length === 0) return [];

  const points: CumulativeCommitPoint[] = [];
  let runningCommits = 0;
  let intervalDelta = 0;
  let lastMarkDate = new Date(`${sortedDates[0]}T00:00:00Z`);

  for (let i = 0; i < sortedDates.length; i++) {
    const d = sortedDates[i];
    const bucket = activity[d];
    runningCommits += bucket.commits;
    intervalDelta += bucket.commits;

    const curDate = new Date(`${d}T00:00:00Z`);
    const daySpan = Math.round((curDate.getTime() - lastMarkDate.getTime()) / (24 * 60 * 60 * 1000));
    const isLast = i === sortedDates.length - 1;
    const isIntervalMark = daySpan >= intervalDays;

    if (isIntervalMark || isLast) {
      const mIdx = curDate.getUTCMonth();
      const shortYear = curDate.getUTCFullYear().toString().slice(2);
      const label = `${MONTH_NAMES[mIdx]} '${shortYear}`;

      points.push({
        date: d,
        label,
        cumulative: runningCommits,
        interval_delta: intervalDelta,
      });

      lastMarkDate = curDate;
      intervalDelta = 0;
    }
  }

  return points;
}

export function aggregateGHData(params: {
  commits: RawCommit[];
  prs: RawPR[];
  releases: RawRelease[];
  issues: RawIssue[];
  reposMeta: RawRepoMeta[];
  startDateStr: string;
  endDateStr: string;
  generatedAtISO?: string;
  languages?: import('./types.ts').GHDataLanguageStat[];
}): GHDataOutput {
  const {
    commits,
    prs,
    releases,
    issues,
    reposMeta,
    startDateStr,
    endDateStr,
    generatedAtISO,
    languages = [],
  } = params;

  const activity: Record<string, DailyActivity> = {};
  const dateList = generateDateRange(startDateStr, endDateStr);
  for (const d of dateList) {
    activity[d] = createZeroBucket();
  }

  // De-duplicate commits by OID
  const uniqueCommits = new Map<string, RawCommit>();
  for (const c of commits) {
    if (!uniqueCommits.has(c.oid)) {
      uniqueCommits.set(c.oid, c);
    }
  }

  // Repo churn tracking
  const repoStats = new Map<string, { commits: number; additions: number; deletions: number }>();
  for (const r of reposMeta) {
    repoStats.set(r.name, { commits: 0, additions: 0, deletions: 0 });
  }

  let totalAdditions = 0;
  let totalDeletions = 0;

  for (const c of uniqueCommits.values()) {
    if (activity[c.date]) {
      activity[c.date].commits++;
      activity[c.date].additions += c.additions;
      activity[c.date].deletions += c.deletions;
      activity[c.date].total++;
    }
    totalAdditions += c.additions;
    totalDeletions += c.deletions;

    const rStat = repoStats.get(c.repo) || { commits: 0, additions: 0, deletions: 0 };
    rStat.commits++;
    rStat.additions += c.additions;
    rStat.deletions += c.deletions;
    repoStats.set(c.repo, rStat);
  }

  // PRs de-duplication
  const uniquePRs = new Map<string, RawPR>();
  let mergedPRCount = 0;
  for (const p of prs) {
    if (!uniquePRs.has(p.id)) {
      uniquePRs.set(p.id, p);
      if (p.merged) mergedPRCount++;
    }
  }
  for (const p of uniquePRs.values()) {
    if (activity[p.date]) {
      activity[p.date].pull_requests++;
      activity[p.date].total++;
    }
  }

  // Releases
  const uniqueReleases = new Map<string, RawRelease>();
  for (const rel of releases) {
    if (!uniqueReleases.has(rel.id)) {
      uniqueReleases.set(rel.id, rel);
    }
  }
  for (const rel of uniqueReleases.values()) {
    if (activity[rel.date]) {
      activity[rel.date].releases++;
      activity[rel.date].total++;
    }
  }

  // Issues
  const uniqueIssues = new Map<string, RawIssue>();
  for (const iss of issues) {
    if (!uniqueIssues.has(iss.id)) {
      uniqueIssues.set(iss.id, iss);
    }
  }
  for (const iss of uniqueIssues.values()) {
    if (activity[iss.date]) {
      activity[iss.date].issues++;
      activity[iss.date].total++;
    }
  }

  // Top 5 Repositories by Churn/Commits
  const metaMap = new Map<string, RawRepoMeta>(reposMeta.map((m) => [m.name, m]));
  const topRepos: RepoChurnStat[] = Array.from(repoStats.entries())
    .map(([name, stat]) => {
      const meta = metaMap.get(name);
      return {
        name,
        nameWithOwner: meta?.nameWithOwner || `pid7-org/${name}`,
        url: meta?.url || `https://github.com/pid7-org/${name}`,
        commits: stat.commits,
        additions: stat.additions,
        deletions: stat.deletions,
        net_loc: stat.additions - stat.deletions,
        primaryLanguage: meta?.language || 'Rust',
        primaryColor: meta?.languageColor || '#dea584',
      };
    })
    .sort((a, b) => b.commits - a.commits || b.additions - a.additions)
    .slice(0, 5);

  // Projects list
  const projects: GHProjectItem[] = reposMeta.map((m) => {
    const s = repoStats.get(m.name) || { commits: 0, additions: 0, deletions: 0 };
    return {
      name: m.name,
      nameWithOwner: m.nameWithOwner,
      desc: m.desc,
      url: m.url,
      stars: m.stars,
      forks: m.forks,
      language: m.language,
      languageColor: m.languageColor,
      commits: s.commits,
      releases: 0,
      latestRelease: m.latestRelease || null,
      bannerUrl: m.bannerUrl || null,
      pullRequests: 0,
      issues: 0,
      contributions: s.commits,
    };
  });

  // Calculate elapsed months from startDate to endDate
  const sDate = new Date(`${startDateStr}T00:00:00Z`);
  const eDate = new Date(`${endDateStr}T00:00:00Z`);
  const elapsedMonths = Math.max(
    1,
    (eDate.getUTCFullYear() - sDate.getUTCFullYear()) * 12 +
      (eDate.getUTCMonth() - sDate.getUTCMonth()) +
      1
  );

  const totalCommitsCount = uniqueCommits.size;
  const totalPRsCount = uniquePRs.size;
  const totalReleasesCount = uniqueReleases.size;

  const cadence: CadenceStats = {
    total_commits: totalCommitsCount,
    total_prs: totalPRsCount,
    total_releases: totalReleasesCount,
    monthly_avg_commits: Math.round(totalCommitsCount / elapsedMonths),
    merge_rate_pct: totalPRsCount > 0 ? Math.round((mergedPRCount / totalPRsCount) * 100) : 100,
  };

  const monthly_loc = buildMonthlyLoc(activity, 6);
  const cumulative_commits = buildCumulativeCommits(activity, 14);

  return {
    generated_at: generatedAtISO || new Date().toISOString(),
    start_date: startDateStr,
    end_date: endDateStr,
    repos_count: reposMeta.length,
    total_net_loc: totalAdditions - totalDeletions,
    cadence,
    top_repos: topRepos,
    monthly_loc,
    cumulative_commits,
    activity,
    projects,
    languages,
  };
}

export function mergeGHData(
  existing: GHDataOutput,
  recentCommits: RawCommit[],
  recentPRs: RawPR[],
  recentReleases: RawRelease[],
  recentIssues: RawIssue[],
  windowStart: string,
  windowEnd: string,
  reposMeta?: RawRepoMeta[]
): GHDataOutput {
  // Deduplicate incoming window items
  const uniqueCommits = new Map<string, RawCommit>();
  for (const c of recentCommits) {
    if (!uniqueCommits.has(c.oid)) {
      uniqueCommits.set(c.oid, c);
    }
  }

  const uniquePRs = new Map<string, RawPR>();
  for (const p of recentPRs) {
    if (!uniquePRs.has(p.id)) {
      uniquePRs.set(p.id, p);
    }
  }

  const uniqueReleases = new Map<string, RawRelease>();
  for (const r of recentReleases) {
    if (!uniqueReleases.has(r.id)) {
      uniqueReleases.set(r.id, r);
    }
  }

  const uniqueIssues = new Map<string, RawIssue>();
  for (const iss of recentIssues) {
    if (!uniqueIssues.has(iss.id)) {
      uniqueIssues.set(iss.id, iss);
    }
  }

  const activity = { ...existing.activity };
  const dateList = generateDateRange(windowStart, windowEnd);

  let oldWinCommits = 0;
  let oldWinAdditions = 0;
  let oldWinDeletions = 0;
  let oldWinPRs = 0;

  // Clear existing data within the refresh window to prevent duplicates
  for (const d of dateList) {
    if (activity[d]) {
      oldWinCommits += activity[d].commits;
      oldWinAdditions += activity[d].additions;
      oldWinDeletions += activity[d].deletions;
      oldWinPRs += activity[d].pull_requests;
    }
    activity[d] = createZeroBucket();
  }

  // Overlay recent deduplicated commits
  for (const c of uniqueCommits.values()) {
    if (activity[c.date]) {
      activity[c.date].commits++;
      activity[c.date].additions += c.additions;
      activity[c.date].deletions += c.deletions;
      activity[c.date].total++;
    }
  }

  // Overlay unique PRs
  for (const p of uniquePRs.values()) {
    if (activity[p.date]) {
      activity[p.date].pull_requests++;
      activity[p.date].total++;
    }
  }

  // Overlay unique Releases
  for (const r of uniqueReleases.values()) {
    if (activity[r.date]) {
      activity[r.date].releases++;
      activity[r.date].total++;
    }
  }

  // Overlay unique Issues
  for (const iss of uniqueIssues.values()) {
    if (activity[iss.date]) {
      activity[iss.date].issues++;
      activity[iss.date].total++;
    }
  }

  // Recalculate totals across the full timeline
  let totalCommits = 0;
  let totalPRs = 0;
  let totalReleases = 0;
  let totalAdditions = 0;
  let totalDeletions = 0;

  for (const b of Object.values(activity)) {
    totalCommits += b.commits;
    totalPRs += b.pull_requests;
    totalReleases += b.releases;
    totalAdditions += b.additions;
    totalDeletions += b.deletions;
  }

  // Dynamic merge rate recalculation
  let windowMergedPRs = 0;
  for (const p of uniquePRs.values()) {
    if (p.merged) windowMergedPRs++;
  }
  const prevTotalPRs = existing.cadence?.total_prs || 0;
  const prevMergeRate = existing.cadence?.merge_rate_pct ?? 100;
  const prevMergedPRs = Math.round((prevMergeRate / 100) * prevTotalPRs);
  const oldWinMergedEstimated = Math.round((prevMergeRate / 100) * oldWinPRs);
  const totalMergedPRs = Math.max(
    0,
    Math.min(totalPRs, prevMergedPRs - oldWinMergedEstimated + windowMergedPRs)
  );
  const mergeRatePct = totalPRs > 0 ? Math.round((totalMergedPRs / totalPRs) * 100) : 100;

  // Window stats per repository
  const repoWinStats = new Map<
    string,
    { commits: number; additions: number; deletions: number; prs: number; releases: number; issues: number }
  >();
  for (const c of uniqueCommits.values()) {
    const s = repoWinStats.get(c.repo) || {
      commits: 0,
      additions: 0,
      deletions: 0,
      prs: 0,
      releases: 0,
      issues: 0,
    };
    s.commits++;
    s.additions += c.additions;
    s.deletions += c.deletions;
    repoWinStats.set(c.repo, s);
  }
  for (const p of uniquePRs.values()) {
    const s = repoWinStats.get(p.repo) || {
      commits: 0,
      additions: 0,
      deletions: 0,
      prs: 0,
      releases: 0,
      issues: 0,
    };
    s.prs++;
    repoWinStats.set(p.repo, s);
  }
  for (const r of uniqueReleases.values()) {
    const s = repoWinStats.get(r.repo) || {
      commits: 0,
      additions: 0,
      deletions: 0,
      prs: 0,
      releases: 0,
      issues: 0,
    };
    s.releases++;
    repoWinStats.set(r.repo, s);
  }
  for (const iss of uniqueIssues.values()) {
    const s = repoWinStats.get(iss.repo) || {
      commits: 0,
      additions: 0,
      deletions: 0,
      prs: 0,
      releases: 0,
      issues: 0,
    };
    s.issues++;
    repoWinStats.set(iss.repo, s);
  }

  let newWinCommits = 0;
  let newWinAdditions = 0;
  let newWinDeletions = 0;
  for (const s of repoWinStats.values()) {
    newWinCommits += s.commits;
    newWinAdditions += s.additions;
    newWinDeletions += s.deletions;
  }

  const deltaCommits = newWinCommits - oldWinCommits;
  const deltaAdditions = newWinAdditions - oldWinAdditions;
  const deltaDeletions = newWinDeletions - oldWinDeletions;

  const repoStats = new Map<string, { commits: number; additions: number; deletions: number }>();
  for (const p of existing.projects || []) {
    repoStats.set(p.name, { commits: p.commits, additions: 0, deletions: 0 });
  }
  for (const t of existing.top_repos || []) {
    const curr = repoStats.get(t.name) || { commits: t.commits, additions: 0, deletions: 0 };
    curr.additions = Math.max(curr.additions, t.additions);
    curr.deletions = Math.max(curr.deletions, t.deletions);
    repoStats.set(t.name, curr);
  }

  for (const [repoName, win] of repoWinStats.entries()) {
    const curr = repoStats.get(repoName) || { commits: 0, additions: 0, deletions: 0 };
    const repoDeltaCommits =
      newWinCommits > 0 ? Math.round(deltaCommits * (win.commits / newWinCommits)) : 0;
    const repoDeltaAdditions =
      newWinAdditions > 0 ? Math.round(deltaAdditions * (win.additions / newWinAdditions)) : 0;
    const repoDeltaDeletions =
      newWinDeletions > 0 ? Math.round(deltaDeletions * (win.deletions / newWinDeletions)) : 0;

    curr.commits = Math.max(0, curr.commits + repoDeltaCommits);
    curr.additions = Math.max(0, curr.additions + repoDeltaAdditions);
    curr.deletions = Math.max(0, curr.deletions + repoDeltaDeletions);
    repoStats.set(repoName, curr);
  }

  const metaSource: RawRepoMeta[] =
    reposMeta && reposMeta.length > 0
      ? reposMeta
      : (existing.projects || []).map((p) => ({
          name: p.name,
          nameWithOwner: p.nameWithOwner,
          desc: p.desc,
          url: p.url,
          stars: p.stars,
          forks: p.forks,
          language: p.language,
          languageColor: p.languageColor,
        }));

  const metaMap = new Map<string, RawRepoMeta>(metaSource.map((m) => [m.name, m]));

  for (const m of metaSource) {
    if (!repoStats.has(m.name)) {
      repoStats.set(m.name, { commits: 0, additions: 0, deletions: 0 });
    }
  }

  const topRepos: RepoChurnStat[] = Array.from(repoStats.entries())
    .map(([name, stat]) => {
      const meta = metaMap.get(name);
      return {
        name,
        nameWithOwner: meta?.nameWithOwner || `pid7-org/${name}`,
        url: meta?.url || `https://github.com/pid7-org/${name}`,
        commits: stat.commits,
        additions: stat.additions,
        deletions: stat.deletions,
        net_loc: stat.additions - stat.deletions,
        primaryLanguage: meta?.language || 'Rust',
        primaryColor: meta?.languageColor || '#dea584',
      };
    })
    .sort((a, b) => b.commits - a.commits || b.additions - a.additions)
    .slice(0, 5);

  const existingProjMap = new Map((existing.projects || []).map((p) => [p.name, p]));
  const projects: GHProjectItem[] = metaSource.map((m) => {
    const s = repoStats.get(m.name) || { commits: 0, additions: 0, deletions: 0 };
    const ex = existingProjMap.get(m.name);
    const win = repoWinStats.get(m.name);
    return {
      name: m.name,
      nameWithOwner: m.nameWithOwner,
      desc: m.desc,
      url: m.url,
      stars: m.stars,
      forks: m.forks,
      language: m.language,
      languageColor: m.languageColor,
      commits: s.commits,
      releases: Math.max(ex?.releases || 0, (ex?.releases || 0) + (win?.releases || 0)),
      latestRelease: m.latestRelease !== undefined ? m.latestRelease : (ex?.latestRelease || null),
      bannerUrl: m.bannerUrl !== undefined ? m.bannerUrl : (ex?.bannerUrl || null),
      pullRequests: Math.max(ex?.pullRequests || 0, (ex?.pullRequests || 0) + (win?.prs || 0)),
      issues: Math.max(ex?.issues || 0, (ex?.issues || 0) + (win?.issues || 0)),
      contributions: s.commits,
    };
  });

  const sDate = new Date(`${existing.start_date}T00:00:00Z`);
  const eDate = new Date(`${windowEnd}T00:00:00Z`);
  const elapsedMonths = Math.max(
    1,
    (eDate.getUTCFullYear() - sDate.getUTCFullYear()) * 12 +
      (eDate.getUTCMonth() - sDate.getUTCMonth()) +
      1
  );

  const cadence: CadenceStats = {
    total_commits: totalCommits,
    total_prs: totalPRs,
    total_releases: totalReleases,
    monthly_avg_commits: Math.round(totalCommits / elapsedMonths),
    merge_rate_pct: mergeRatePct,
  };

  const monthly_loc = buildMonthlyLoc(activity, 6);
  const cumulative_commits = buildCumulativeCommits(activity, 14);

  return {
    ...existing,
    generated_at: new Date().toISOString(),
    end_date: windowEnd,
    repos_count: metaSource.length,
    total_net_loc: totalAdditions - totalDeletions,
    cadence,
    top_repos: topRepos,
    monthly_loc,
    cumulative_commits,
    activity,
    projects,
  };
}
