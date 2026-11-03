import fs from 'node:fs/promises';
import path from 'node:path';
import { parseMarkdownBlog, validateBlogPost } from 'mdparser';
import type { ParsedBlogPost } from 'mdparser';

const BLOG_DIR = path.resolve(process.cwd(), 'src/content/blog');

export function formatBlogDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split(/[-/]/);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (parts.length === 3) {
    if (parts[2].length === 4) {
      const day = parseInt(parts[0], 10);
      const monthIdx = parseInt(parts[1], 10) - 1;
      const year = parts[2];
      if (monthIdx >= 0 && monthIdx < 12 && !isNaN(day)) {
        return `${months[monthIdx]} ${day}, ${year}`;
      }
    } else if (parts[0].length === 4) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (monthIdx >= 0 && monthIdx < 12 && !isNaN(day)) {
        return `${months[monthIdx]} ${day}, ${year}`;
      }
    }
  }
  return dateStr;
}

export async function getAllBlogPosts(): Promise<ParsedBlogPost[]> {
  try {
    const files = await fs.readdir(BLOG_DIR);
    const mdFiles = files.filter((f) => f.endsWith('.md'));

    const posts: ParsedBlogPost[] = [];
    for (const file of mdFiles) {
      const filePath = path.join(BLOG_DIR, file);
      const rawContent = await fs.readFile(filePath, 'utf-8');
      const parsed = await parseMarkdownBlog(rawContent);
      posts.push(parsed);
    }

    return posts.sort((a, b) => {
      const parseDate = (dStr: string) => {
        if (!dStr) return 0;
        const parts = dStr.split(/[-/]/);
        if (parts.length === 3) {
          if (parts[2].length === 4) {
            return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
          } else if (parts[0].length === 4) {
            return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
          }
        }
        const t = new Date(dStr).getTime();
        return isNaN(t) ? 0 : t;
      };
      return parseDate(b.frontmatter.created) - parseDate(a.frontmatter.created);
    });
  } catch {
    return [];
  }
}

export async function getBlogPostBySlug(slug: string): Promise<ParsedBlogPost | undefined> {
  const posts = await getAllBlogPosts();
  return posts.find((p) => p.frontmatter.slug === slug || p.frontmatter.slug.toLowerCase() === slug.toLowerCase());
}

export async function getBlogPostById(id: string): Promise<ParsedBlogPost | undefined> {
  return getBlogPostBySlug(id);
}
