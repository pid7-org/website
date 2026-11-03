import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { validateEnv } from '../src/lib/gh-activity/graphql.ts';
import {
  aggregateGHData,
  mergeGHData,
  type RawCommit,
  type RawIssue,
  type RawPR,
  type RawRelease,
} from '../src/lib/gh-data/aggregator.ts';
import {
  collectRepoCommits,
  collectRepoIssues,
  collectRepoPRs,
  collectRepoReleases,
  getRepositories,
} from '../src/lib/gh-data/collector.ts';
import type { GHDataOutput } from '../src/lib/gh-data/types.ts';

const BASE_START_DATE = '2025-01-01';

async function main() {
  const { org } = validateEnv();

  const args = process.argv.slice(2);
  const isIncrementalRequested = args.includes('--incremental');
  const isFullRequested = args.includes('--full');

  let daysWindow = 7;
  const daysIndex = args.indexOf('--days');
  if (daysIndex !== -1 && args[daysIndex + 1]) {
    const parsed = parseInt(args[daysIndex + 1], 10);
    if (!isNaN(parsed) && parsed > 0) {
      daysWindow = parsed;
    }
  }

  const outputPath = path.join(process.cwd(), 'src', 'assets', 'gh-data.json');
  const fileExists = existsSync(outputPath);
  const isIncremental = isIncrementalRequested && !isFullRequested && fileExists;

  const now = new Date();
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const endDateStr = yesterday.toISOString().slice(0, 10);

  console.log(`[GitHub Sync] Starting unified GitHub sync for organization '${org}'...`);
  console.log(`[GitHub Sync] Mode: ${isIncremental ? `Incremental (past ${daysWindow} days)` : `Full backfill (${BASE_START_DATE} → ${endDateStr})`}`);

  const repos = await getRepositories(org);
  console.log(`[GitHub Sync] Discovered ${repos.length} public repositories.`);

  let finalData: GHDataOutput;

  if (isIncremental) {
    const rawExisting = readFileSync(outputPath, 'utf-8');
    const existingData = JSON.parse(rawExisting) as GHDataOutput;

    const windowStartDate = new Date(yesterday.getTime() - daysWindow * 24 * 60 * 60 * 1000);
    let windowStartDateStr = windowStartDate.toISOString().slice(0, 10);
    if (windowStartDateStr < BASE_START_DATE) {
      windowStartDateStr = BASE_START_DATE;
    }

    const sinceISO = `${windowStartDateStr}T00:00:00Z`;
    const untilISO = `${endDateStr}T23:59:59Z`;

    console.log(`[GitHub Sync] Fetching window: ${windowStartDateStr} → ${endDateStr}...`);

    const allCommits: RawCommit[] = [];
    const allPRs: RawPR[] = [];
    const allReleases: RawRelease[] = [];
    const allIssues: RawIssue[] = [];

    for (const r of repos) {
      const c = await collectRepoCommits(org, r, sinceISO, untilISO);
      allCommits.push(...c);

      const p = await collectRepoPRs(org, r.name, sinceISO, untilISO);
      allPRs.push(...p);

      const rel = await collectRepoReleases(org, r.name, sinceISO, untilISO);
      allReleases.push(...rel);

      const iss = await collectRepoIssues(org, r.name, sinceISO, untilISO);
      allIssues.push(...iss);
    }

    finalData = mergeGHData(
      existingData,
      allCommits,
      allPRs,
      allReleases,
      allIssues,
      windowStartDateStr,
      endDateStr
    );
  } else {
    const sinceISO = `${BASE_START_DATE}T00:00:00Z`;
    const untilISO = `${endDateStr}T23:59:59Z`;

    console.log(`[GitHub Sync] Fetching full history: ${BASE_START_DATE} → ${endDateStr}...`);

    const allCommits: RawCommit[] = [];
    const allPRs: RawPR[] = [];
    const allReleases: RawRelease[] = [];
    const allIssues: RawIssue[] = [];

    for (const r of repos) {
      console.log(`  -> Collecting ${r.name}...`);
      const c = await collectRepoCommits(org, r, sinceISO, untilISO);
      allCommits.push(...c);

      const p = await collectRepoPRs(org, r.name, sinceISO, untilISO);
      allPRs.push(...p);

      const rel = await collectRepoReleases(org, r.name, sinceISO, untilISO);
      allReleases.push(...rel);

      const iss = await collectRepoIssues(org, r.name, sinceISO, untilISO);
      allIssues.push(...iss);
    }

    finalData = aggregateGHData({
      commits: allCommits,
      prs: allPRs,
      releases: allReleases,
      issues: allIssues,
      reposMeta: repos,
      startDateStr: BASE_START_DATE,
      endDateStr,
    });
  }

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(finalData, null, 2), 'utf-8');

  console.log(`[GitHub Sync] Successfully synchronized dataset to ${outputPath}`);
  console.log(`[GitHub Sync] Summary:`);
  console.log(`  - Total Repos: ${finalData.repos_count}`);
  console.log(`  - Total Commits: ${finalData.cadence.total_commits}`);
  console.log(`  - Total PRs: ${finalData.cadence.total_prs}`);
  console.log(`  - Total Releases: ${finalData.cadence.total_releases}`);
  console.log(`  - Net LOC: ${finalData.total_net_loc.toLocaleString()}`);
  console.log(`  - Top 5 Repos: ${finalData.top_repos.map((t) => t.name).join(', ')}`);
}

main().catch((err) => {
  console.error('\n[FATAL ERROR]', err instanceof Error ? err.message : err);
  process.exit(1);
});
