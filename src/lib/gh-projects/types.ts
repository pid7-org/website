export interface ProjectLanguageStat {
  name: string;
  color: string | null;
  bytes: number;
}

export interface ProjectRelease {
  tagName: string;
  publishedAt: string | null;
  url: string;
}

export interface ProjectData {
  name: string;
  nameWithOwner: string;
  desc: string;
  url: string;
  stars: number;
  forks: number;
  language: string;
  languageColor: string | null;
  languages: ProjectLanguageStat[];
  commits: number;
  releases: number;
  latestRelease?: ProjectRelease | null;
  bannerUrl?: string | null;
  pullRequests: number;
  issues: number;
  contributions: number;
}

export interface ProjectsDataOutput {
  generated_at: string;
  total_repos_scanned: number;
  projects: ProjectData[];
}
