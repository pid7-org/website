import fs from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatBlogDate, getAllBlogPosts, getBlogPostById, getBlogPostBySlug } from '../blog.ts';

const MOCK_FILES: Record<string, string> = {
  '/mock/src/content/blog/older-post.md': `---
slug: older-post
title: Older Post
created: 01-01-2025
tags: Testing
---
Content older
`,
  '/mock/src/content/blog/newer-post.md': `---
slug: newer-post
title: Newer Post
created: 15-06-2025
tags: Testing
---
Content newer
`,
  '/mock/src/content/blog/iso-date-post.md': `---
slug: iso-post
title: ISO Date Post
created: 2025-12-01
tags: Architecture
---
Content iso
`,
  '/mock/src/content/blog/unpublished-post.md': `---
slug: unpublished-post
title: Unpublished Post
created: 2025-08-01
tags: Draft
published: false
---
Content draft
`,
};

describe('Blog Content Library', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('loads mock blog posts and sorts them chronologically in descending order', async () => {
    vi.spyOn(fs, 'readdir').mockResolvedValue(
      ['older-post.md', 'newer-post.md', 'iso-date-post.md', 'draft.txt'] as any
    );
    vi.spyOn(fs, 'readFile').mockImplementation(async (filePath) => {
      const match = Object.keys(MOCK_FILES).find((k) => (filePath as string).endsWith(k.split('/').pop()!));
      if (match) return MOCK_FILES[match];
      throw new Error(`File not found: ${filePath}`);
    });

    const posts = await getAllBlogPosts();
    expect(posts).toHaveLength(3);

    // Descending order: Dec 1, 2025 -> Jun 15, 2025 -> Jan 1, 2025
    expect(posts[0].frontmatter.slug).toBe('iso-post');
    expect(posts[1].frontmatter.slug).toBe('newer-post');
    expect(posts[2].frontmatter.slug).toBe('older-post');
  });

  it('filters out unpublished posts when includeUnpublished is false', async () => {
    vi.spyOn(fs, 'readdir').mockResolvedValue(
      ['older-post.md', 'unpublished-post.md'] as any
    );
    vi.spyOn(fs, 'readFile').mockImplementation(async (filePath) => {
      const match = Object.keys(MOCK_FILES).find((k) => (filePath as string).endsWith(k.split('/').pop()!));
      if (match) return MOCK_FILES[match];
      throw new Error(`File not found: ${filePath}`);
    });

    const publishedOnly = await getAllBlogPosts({ includeUnpublished: false });
    expect(publishedOnly).toHaveLength(1);
    expect(publishedOnly[0].frontmatter.slug).toBe('older-post');

    const withUnpublished = await getAllBlogPosts({ includeUnpublished: true });
    expect(withUnpublished).toHaveLength(2);
  });

  it('finds blog post by slug with case-insensitive tolerance', async () => {
    vi.spyOn(fs, 'readdir').mockResolvedValue(['older-post.md', 'newer-post.md'] as any);
    vi.spyOn(fs, 'readFile').mockImplementation(async (filePath) => {
      const match = Object.keys(MOCK_FILES).find((k) => (filePath as string).endsWith(k.split('/').pop()!));
      if (match) return MOCK_FILES[match];
      throw new Error(`File not found: ${filePath}`);
    });

    const foundExact = await getBlogPostBySlug('newer-post');
    expect(foundExact).toBeDefined();
    expect(foundExact?.frontmatter.slug).toBe('newer-post');

    const foundUpper = await getBlogPostBySlug('NEWER-POST');
    expect(foundUpper).toBeDefined();
    expect(foundUpper?.frontmatter.slug).toBe('newer-post');

    const notFound = await getBlogPostBySlug('non-existent');
    expect(notFound).toBeUndefined();
  });

  it('handles filesystem read failure gracefully by returning empty array', async () => {
    vi.spyOn(fs, 'readdir').mockRejectedValue(new Error('EACCES: permission denied'));

    const posts = await getAllBlogPosts();
    expect(posts).toEqual([]);

    const post = await getBlogPostById('any-slug');
    expect(post).toBeUndefined();
  });
});
