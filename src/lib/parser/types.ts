export interface BlogFrontmatter {
  slug: string;
  title: string;
  created: string;
  lastUpdated: string;
  tags: string[];
  description?: string;
}

export interface GlossaryItem {
  term: string;
  definitionHtml: string;
}

export interface ReferenceItem {
  id: string;
  label: string;
  contentHtml: string;
}

export type TableAlignment = "left" | "center" | "right";

export interface ParsedTable {
  headers: string[];
  alignments: TableAlignment[];
  rows: string[][];
  caption?: string;
}

export interface ParsedBlogPost {
  frontmatter: BlogFrontmatter;
  html: string;
  glossary: GlossaryItem[];
  references: ReferenceItem[];
  readTimeMinutes: number;
  wordCount: number;
  rawMarkdown: string;
}

export interface ValidationError {
  file?: string;
  slug?: string;
  field: string;
  message: string;
}
