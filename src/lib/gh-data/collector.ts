import { runGraphQLAsync } from '../gh-activity/graphql.ts';
import type { RawCommit, RawIssue, RawPR, RawRelease, RawRepoMeta } from './aggregator.ts';

const GET_ORG_REPOS_QUERY = `
  query getOrgRepos($org: String!, $cursor: String) {
    organization(login: $org) {
      repositories(
        first: 100
        after: $cursor
        ownerAffiliations: OWNER
        isFork: false
      ) {
        nodes {
          name
          nameWithOwner
          description
          url
          isArchived
          isPrivate
          stargazerCount
          forkCount
          primaryLanguage {
            name
            color
          }
          defaultBranchRef {
            name
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

const GET_BRANCH_COMMITS_QUERY = `
  query getBranchCommits($owner: String!, $name: String!, $refName: String!, $since: GitTimestamp!, $until: GitTimestamp!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      ref(qualifiedName: $refName) {
        target {
          ... on Commit {
            history(since: $since, until: $until, first: 100, after: $cursor) {
              nodes {
                oid
                committedDate
                additions
                deletions
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      }
    }
  }
`;

const GET_REPO_PRS_QUERY = `
  query getRepoPRs($owner: String!, $name: String!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      pullRequests(
        first: 100
        after: $cursor
        orderBy: { field: CREATED_AT, direction: DESC }
      ) {
        nodes {
          id
          createdAt
          merged
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

const GET_REPO_RELEASES_QUERY = `
  query getRepoReleases($owner: String!, $name: String!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      releases(
        first: 100
        after: $cursor
        orderBy: { field: CREATED_AT, direction: DESC }
      ) {
        nodes {
          id
          createdAt
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

const GET_REPO_ISSUES_QUERY = `
  query getRepoIssues($owner: String!, $name: String!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      issues(
        first: 100
        after: $cursor
        orderBy: { field: CREATED_AT, direction: DESC }
      ) {
        nodes {
          id
          createdAt
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

export interface RepoInfo {
  name: string;
  nameWithOwner: string;
  description: string;
  url: string;
  defaultBranch?: string;
  stars: number;
  forks: number;
  language: string;
  languageColor: string;
}

export async function getRepositories(org: string): Promise<RepoInfo[]> {
  const repos: RepoInfo[] = [];
  let cursor: string | null = null;
  let hasNext = true;

  while (hasNext) {
    const data = await runGraphQLAsync<{
      organization: {
        repositories: {
          nodes: Array<{
            name: string;
            nameWithOwner: string;
            description: string | null;
            url: string;
            isArchived: boolean;
            isPrivate: boolean;
            stargazerCount: number;
            forkCount: number;
            primaryLanguage?: { name: string; color: string } | null;
            defaultBranchRef?: { name: string } | null;
          }>;
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        };
      };
    }>(GET_ORG_REPOS_QUERY, { org, cursor });

    const nodes = data?.organization?.repositories?.nodes || [];
    for (const node of nodes) {
      if (!node.isArchived) {
        repos.push({
          name: node.name,
          nameWithOwner: node.nameWithOwner,
          description: node.description || '',
          url: node.url,
          defaultBranch: node.defaultBranchRef?.name,
          stars: node.stargazerCount || 0,
          forks: node.forkCount || 0,
          language: node.primaryLanguage?.name || 'Rust',
          languageColor: node.primaryLanguage?.color || '#dea584',
        });
      }
    }

    hasNext = data?.organization?.repositories?.pageInfo?.hasNextPage || false;
    cursor = data?.organization?.repositories?.pageInfo?.endCursor || null;
  }

  return repos;
}

export async function collectRepoCommits(
  owner: string,
  repo: RepoInfo,
  sinceISO: string,
  untilISO: string
): Promise<RawCommit[]> {
  if (!repo.defaultBranch) return [];

  const commits: RawCommit[] = [];
  let cursor: string | null = null;
  let hasNext = true;

  while (hasNext) {
    try {
      const data = await runGraphQLAsync<{
        repository: {
          ref?: {
            target?: {
              history?: {
                nodes: Array<{
                  oid: string;
                  committedDate: string;
                  additions: number;
                  deletions: number;
                }>;
                pageInfo: { hasNextPage: boolean; endCursor: string | null };
              };
            };
          } | null;
        } | null;
      }>(GET_BRANCH_COMMITS_QUERY, {
        owner,
        name: repo.name,
        refName: `refs/heads/${repo.defaultBranch}`,
        since: sinceISO,
        until: untilISO,
        cursor,
      });

      const history = data?.repository?.ref?.target?.history;
      const nodes = history?.nodes || [];

      for (const node of nodes) {
        commits.push({
          oid: node.oid,
          date: node.committedDate.slice(0, 10),
          repo: repo.name,
          additions: node.additions || 0,
          deletions: node.deletions || 0,
        });
      }

      hasNext = history?.pageInfo?.hasNextPage || false;
      cursor = history?.pageInfo?.endCursor || null;
    } catch (err) {
      console.warn(`[Commits Warning] Failed fetching commits for ${repo.name}:`, err);
      break;
    }
  }

  return commits;
}

export async function collectRepoPRs(
  owner: string,
  repoName: string,
  sinceISO: string,
  untilISO: string
): Promise<RawPR[]> {
  const prs: RawPR[] = [];
  let cursor: string | null = null;
  let hasNext = true;

  while (hasNext) {
    try {
      const data = await runGraphQLAsync<{
        repository: {
          pullRequests: {
            nodes: Array<{ id: string; createdAt: string; merged: boolean }>;
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
          };
        };
      }>(GET_REPO_PRS_QUERY, { owner, name: repoName, cursor });

      const nodes = data?.repository?.pullRequests?.nodes || [];
      for (const node of nodes) {
        if (node.createdAt >= sinceISO && node.createdAt <= untilISO) {
          prs.push({
            id: node.id,
            date: node.createdAt.slice(0, 10),
            repo: repoName,
            merged: Boolean(node.merged),
          });
        }
      }

      const lastNode = nodes[nodes.length - 1];
      if (lastNode && lastNode.createdAt < sinceISO) {
        break;
      }

      hasNext = data?.repository?.pullRequests?.pageInfo?.hasNextPage || false;
      cursor = data?.repository?.pullRequests?.pageInfo?.endCursor || null;
    } catch (err) {
      console.warn(`[PR Warning] Failed fetching PRs for ${repoName}:`, err);
      break;
    }
  }

  return prs;
}

export async function collectRepoReleases(
  owner: string,
  repoName: string,
  sinceISO: string,
  untilISO: string
): Promise<RawRelease[]> {
  const releases: RawRelease[] = [];
  let cursor: string | null = null;
  let hasNext = true;

  while (hasNext) {
    try {
      const data = await runGraphQLAsync<{
        repository: {
          releases: {
            nodes: Array<{ id: string; createdAt: string }>;
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
          };
        };
      }>(GET_REPO_RELEASES_QUERY, { owner, name: repoName, cursor });

      const nodes = data?.repository?.releases?.nodes || [];
      for (const node of nodes) {
        if (node.createdAt >= sinceISO && node.createdAt <= untilISO) {
          releases.push({
            id: node.id,
            date: node.createdAt.slice(0, 10),
            repo: repoName,
          });
        }
      }

      const lastNode = nodes[nodes.length - 1];
      if (lastNode && lastNode.createdAt < sinceISO) {
        break;
      }

      hasNext = data?.repository?.releases?.pageInfo?.hasNextPage || false;
      cursor = data?.repository?.releases?.pageInfo?.endCursor || null;
    } catch (err) {
      console.warn(`[Releases Warning] Failed fetching releases for ${repoName}:`, err);
      break;
    }
  }

  return releases;
}

export async function collectRepoIssues(
  owner: string,
  repoName: string,
  sinceISO: string,
  untilISO: string
): Promise<RawIssue[]> {
  const issues: RawIssue[] = [];
  let cursor: string | null = null;
  let hasNext = true;

  while (hasNext) {
    try {
      const data = await runGraphQLAsync<{
        repository: {
          issues: {
            nodes: Array<{ id: string; createdAt: string }>;
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
          };
        };
      }>(GET_REPO_ISSUES_QUERY, { owner, name: repoName, cursor });

      const nodes = data?.repository?.issues?.nodes || [];
      for (const node of nodes) {
        if (node.createdAt >= sinceISO && node.createdAt <= untilISO) {
          issues.push({
            id: node.id,
            date: node.createdAt.slice(0, 10),
            repo: repoName,
          });
        }
      }

      const lastNode = nodes[nodes.length - 1];
      if (lastNode && lastNode.createdAt < sinceISO) {
        break;
      }

      hasNext = data?.repository?.issues?.pageInfo?.hasNextPage || false;
      cursor = data?.repository?.issues?.pageInfo?.endCursor || null;
    } catch (err) {
      console.warn(`[Issues Warning] Failed fetching issues for ${repoName}:`, err);
      break;
    }
  }

  return issues;
}
