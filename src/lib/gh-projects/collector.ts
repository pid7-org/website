import { runGraphQLAsync } from '../gh-activity/graphql.ts';
import type { ProjectData, ProjectsDataOutput } from './types.ts';

const GET_ORG_PROJECTS_QUERY = `
  query getOrgProjects($org: String!, $cursor: String) {
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
          isPrivate
          isArchived
          stargazerCount
          forkCount
          primaryLanguage {
            name
            color
          }
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            edges {
              size
              node {
                name
                color
              }
            }
          }
          defaultBranchRef {
            name
            target {
              ... on Commit {
                history {
                  totalCount
                }
              }
            }
          }
          releases(first: 1, orderBy: { field: CREATED_AT, direction: DESC }) {
            totalCount
            nodes {
              tagName
              publishedAt
              url
            }
          }
          pullRequests {
            totalCount
          }
          issues {
            totalCount
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

interface RawRepositoryNode {
  name: string;
  nameWithOwner: string;
  description: string | null;
  url: string;
  isPrivate: boolean;
  isArchived: boolean;
  stargazerCount: number;
  forkCount: number;
  primaryLanguage?: {
    name: string;
    color: string | null;
  } | null;
  languages?: {
    edges: Array<{
      size: number;
      node: {
        name: string;
        color: string | null;
      };
    }>;
  } | null;
  defaultBranchRef?: {
    name: string;
    target?: {
      history?: {
        totalCount: number;
      };
    } | null;
  } | null;
  releases?: {
    totalCount: number;
    nodes?: Array<{
      tagName: string;
      publishedAt: string | null;
      url: string;
    }>;
  } | null;
  pullRequests?: {
    totalCount: number;
  } | null;
  issues?: {
    totalCount: number;
  } | null;
}

export interface CollectProjectsOptions {
  limit?: number;
  excludeNames?: string[];
  includeArchived?: boolean;
}

export async function collectOrgProjects(
  org: string,
  options: CollectProjectsOptions = {}
): Promise<ProjectsDataOutput> {
  const limit = options.limit ?? 5;
  const excludeNames = new Set((options.excludeNames ?? ['website', '.github']).map((n) => n.toLowerCase()));
  const includeArchived = options.includeArchived ?? false;

  const rawRepos: RawRepositoryNode[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data = await runGraphQLAsync<{
      organization: {
        repositories: {
          nodes: RawRepositoryNode[];
          pageInfo: {
            hasNextPage: boolean;
            endCursor: string | null;
          };
        };
      } | null;
    }>(GET_ORG_PROJECTS_QUERY, { org, cursor });

    if (!data.organization) {
      throw new Error(`Organization '${org}' not found or access denied.`);
    }

    const connection = data.organization.repositories;
    rawRepos.push(...connection.nodes);

    hasNextPage = connection.pageInfo.hasNextPage;
    cursor = connection.pageInfo.endCursor;
  }

  const qualifyingProjects: ProjectData[] = [];

  for (const repo of rawRepos) {
    if (repo.isPrivate) continue;
    if (!includeArchived && repo.isArchived) continue;
    if (excludeNames.has(repo.name.toLowerCase())) continue;

    const commits = repo.defaultBranchRef?.target?.history?.totalCount || 0;
    const releases = repo.releases?.totalCount || 0;
    const latestReleaseNode = repo.releases?.nodes?.[0];
    const latestRelease = latestReleaseNode
      ? {
          tagName: latestReleaseNode.tagName,
          publishedAt: latestReleaseNode.publishedAt,
          url: latestReleaseNode.url,
        }
      : null;
    const pullRequests = repo.pullRequests?.totalCount || 0;
    const issues = repo.issues?.totalCount || 0;
    const contributions = commits + releases + pullRequests + issues;

    const languages = (repo.languages?.edges || []).map((e) => ({
      name: e.node.name,
      color: e.node.color,
      bytes: e.size,
    }));

    qualifyingProjects.push({
      name: repo.name,
      nameWithOwner: repo.nameWithOwner,
      desc: repo.description?.trim() || '',
      url: repo.url,
      stars: repo.stargazerCount || 0,
      forks: repo.forkCount || 0,
      language: repo.primaryLanguage?.name || (languages[0]?.name ?? 'Plain Text'),
      languageColor: repo.primaryLanguage?.color || languages[0]?.color || null,
      languages,
      commits,
      releases,
      latestRelease,
      pullRequests,
      issues,
      contributions,
    });
  }

  // Sort projects by total contributions descending, then commits, then stars
  qualifyingProjects.sort((a, b) => {
    if (b.contributions !== a.contributions) {
      return b.contributions - a.contributions;
    }
    if (b.commits !== a.commits) {
      return b.commits - a.commits;
    }
    return b.stars - a.stars;
  });

  const topProjects = qualifyingProjects.slice(0, limit);

  return {
    generated_at: new Date().toISOString(),
    total_repos_scanned: rawRepos.length,
    projects: topProjects,
  };
}

export function validateProjectsData(data: ProjectsDataOutput): void {
  if (!data.generated_at || isNaN(Date.parse(data.generated_at))) {
    throw new Error(`Invalid generated_at timestamp: ${data.generated_at}`);
  }
  if (typeof data.total_repos_scanned !== 'number' || data.total_repos_scanned < 0) {
    throw new Error(`Invalid total_repos_scanned count: ${data.total_repos_scanned}`);
  }
  if (!Array.isArray(data.projects)) {
    throw new Error('Missing or invalid projects array');
  }

  for (const project of data.projects) {
    if (!project.name || typeof project.name !== 'string') {
      throw new Error('Project missing valid name');
    }
    if (typeof project.desc !== 'string') {
      throw new Error(`Project ${project.name} missing description string`);
    }
    if (!project.url || typeof project.url !== 'string') {
      throw new Error(`Project ${project.name} missing valid url`);
    }
    if (typeof project.commits !== 'number' || project.commits < 0) {
      throw new Error(`Invalid commits count for ${project.name}: ${project.commits}`);
    }
    if (typeof project.releases !== 'number' || project.releases < 0) {
      throw new Error(`Invalid releases count for ${project.name}: ${project.releases}`);
    }
    if (typeof project.contributions !== 'number' || project.contributions < 0) {
      throw new Error(`Invalid contributions count for ${project.name}: ${project.contributions}`);
    }
    if (!project.language || typeof project.language !== 'string') {
      throw new Error(`Project ${project.name} missing language`);
    }
  }
}

export function summarizeProjects(
  org: string,
  outputPath: string,
  data: ProjectsDataOutput
): string {
  const lines = [
    'GitHub Top Projects',
    '-------------------',
    `Organization:        ${org}`,
    `Repositories scanned: ${data.total_repos_scanned}`,
    `Projects selected:   ${data.projects.length}`,
    '',
    'Ranked Projects:',
  ];

  data.projects.forEach((proj, idx) => {
    lines.push(
      `  ${idx + 1}. ${proj.name} [${proj.language}] — ${proj.contributions.toLocaleString()} total contributions (${proj.commits.toLocaleString()} commits, ${proj.releases.toLocaleString()} releases, ${proj.pullRequests} PRs, ${proj.issues} issues)`
    );
    if (proj.desc) {
      lines.push(`     Description: ${proj.desc}`);
    }
    lines.push(`     URL:         ${proj.url}`);
  });

  lines.push('');
  lines.push(`Generated: ${outputPath}`);
  return lines.join('\n');
}
