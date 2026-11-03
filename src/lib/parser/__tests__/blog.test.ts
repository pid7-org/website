import { describe, expect, it } from 'vitest';
import { formatBlogDate, getAllBlogPosts, getBlogPostById, getBlogPostBySlug } from '../../blog';

describe('Blog Content Library', () => {
  it('formats DD-MM-YYYY dates correctly', () => {
    expect(formatBlogDate('01-09-2026')).toBe('Sep 1, 2026');
    expect(formatBlogDate('15-01-2025')).toBe('Jan 15, 2025');
    expect(formatBlogDate('31-12-2026')).toBe('Dec 31, 2026');
  });

  it('formats YYYY-MM-DD dates correctly', () => {
    expect(formatBlogDate('2026-09-01')).toBe('Sep 1, 2026');
    expect(formatBlogDate('2025-05-20')).toBe('May 20, 2025');
  });

  it('handles empty, malformed, or invalid date strings gracefully without throwing', () => {
    expect(formatBlogDate('')).toBe('');
    expect(formatBlogDate('invalid-date')).toBe('invalid-date');
    expect(formatBlogDate('99-99-9999')).toBe('99-99-9999');
  });

  it('loads real blog posts and sorts them chronologically in descending order', async () => {
    const posts = await getAllBlogPosts();
    expect(posts.length).toBeGreaterThan(0);

    for (let i = 0; i < posts.length - 1; i++) {
      const parseDate = (dStr: string) => {
        const parts = dStr.split(/[-/]/);
        if (parts.length === 3 && parts[2].length === 4) {
          return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
        }
        return new Date(dStr).getTime();
      };
      const curTime = parseDate(posts[i].frontmatter.created);
      const nextTime = parseDate(posts[i + 1].frontmatter.created);
      expect(curTime).toBeGreaterThanOrEqual(nextTime);
    }
  });

  it('finds blog post by slug with case-insensitive tolerance', async () => {
    const posts = await getAllBlogPosts();
    const targetSlug = posts[0].frontmatter.slug;

    const foundExact = await getBlogPostBySlug(targetSlug);
    expect(foundExact).toBeDefined();
    expect(foundExact?.frontmatter.slug).toBe(targetSlug);

    const foundUpper = await getBlogPostBySlug(targetSlug.toUpperCase());
    expect(foundUpper).toBeDefined();
    expect(foundUpper?.frontmatter.slug).toBe(targetSlug);

    const foundById = await getBlogPostById(targetSlug);
    expect(foundById).toBeDefined();

    const notFound = await getBlogPostBySlug('nonexistent-post-slug-xyz-123');
    expect(notFound).toBeUndefined();
  });
});
