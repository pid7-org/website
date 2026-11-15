import { describe, expect, it } from 'vitest';
import {
  getColumnAlignment,
  isTableDelimiterRow,
  isValidDateString,
  parseFrontmatter,
  parseMarkdownBlog,
  parseSimpleMarkdownInline,
  parseTableBlock,
  slugify,
  splitTableRow,
  validateAllBlogPosts,
  validateBlogPost,
} from '../index.ts';

const DUMMY_BLOG_POST = `---
slug: dummy-speed-test
title: Dummy Benchmark & Table Post
created: 10-09-2026
last-updated: 12-09-2026
description: A mock blog post containing all markdown extensions for isolated unit testing.
tags: rust, benchmarks, simd, tables
---

Welcome to this synthetic blog post demonstrating **bold text**, _italic text_, and \`inline code\`.
We also reference inline math $E = mc^2$ and citation[^algo-1].

## ⁕ Benchmark Summary

Below is a standalone table comparing execution metrics:

| Metric | Baseline | Optimized | Speedup |
| :--- | :---: | ---: | ---: |
| Latency | 66 ns | 11 ns | **6.0x** |
| Cycles | 174 | 29 | **6.0x** |
| Branch Misses | 21% | 0% | 100% |

## § Custom Block With Table

<>
| Operation | Throughput | Status |
|:---|:---:|---:|
| Vector Scan | 4.2 GB/s | \`PASS\` |
| Bitmask Filter | 8.9 GB/s | \`PASS\` |
@desc High-performance vector scanning benchmarks on dummy data
</>

## Code Snippet Example

<>
\`\`\`rust
pub fn dummy_simd_scan(data: &[u8]) -> usize {
    data.iter().filter(|&&b| b == 0xFF).count()
}
\`\`\`
@desc Rust implementation of dummy scan
</>

~
\`\`\`c
int dummy_c_scan(const unsigned char *buf, size_t len);
\`\`\`
@desc C extern signature
~

> [!TIP]
> Hardware acceleration yields significant latency reductions.

> [!WARNING]
> Ensure alignment before calling unaligned load intrinsics.

{@anim (001) visual demo showing 512-bit vector register comparison}

{ANIM002: second animation format demo}

### Equations Section

$$
\\text{Speedup} = \\frac{T_{\\text{old}}}{T_{\\text{new}}}
$$

Here is an unordered list:

* First item with \`code\`
* Second item with **emphasis**

And an ordered list:

1. Initialize buffer
2. Load vector register
3. Compute mask

@glossary

* SIMD: Single Instruction Multiple Data parallel execution model.
* AVX-512: 512-bit vector extensions on modern x86 processors.

@references

[^algo-1]: Fast scanning algorithm reference guide, 2026.
`;

describe('parser: Frontmatter Parsing', () => {
  it('correctly parses valid YAML frontmatter fields', () => {
    const { frontmatter, content } = parseFrontmatter(DUMMY_BLOG_POST);
    expect(frontmatter.slug).toBe('dummy-speed-test');
    expect(frontmatter.title).toBe('Dummy Benchmark & Table Post');
    expect(frontmatter.created).toBe('10-09-2026');
    expect(frontmatter.lastUpdated).toBe('12-09-2026');
    expect(frontmatter.description).toBe(
      'A mock blog post containing all markdown extensions for isolated unit testing.',
    );
    expect(frontmatter.tags).toEqual(['rust', 'benchmarks', 'simd', 'tables']);
    expect(frontmatter.published).toBeUndefined();
    expect(content.startsWith('Welcome to this synthetic blog post')).toBe(true);
  });

  it('parses published boolean field when specified in frontmatter', () => {
    const postWithPublishedTrue = `---
slug: test-published-true
title: Published True Post
created: 10-09-2026
tags: test
published: true
---
Content`;
    const postWithPublishedFalse = `---
slug: test-published-false
title: Published False Post
created: 10-09-2026
tags: test
published: false
---
Content`;

    expect(parseFrontmatter(postWithPublishedTrue).frontmatter.published).toBe(true);
    expect(parseFrontmatter(postWithPublishedFalse).frontmatter.published).toBe(false);
  });

  it('falls back to default values when optional fields are missing', () => {
    const minimal = `---
slug: minimal-post
---
Body text only`;
    const { frontmatter, content } = parseFrontmatter(minimal);
    expect(frontmatter.slug).toBe('minimal-post');
    expect(frontmatter.title).toBe('Untitled Post');
    expect(frontmatter.created).toBe('');
    expect(frontmatter.lastUpdated).toBe('');
    expect(frontmatter.tags).toEqual([]);
    expect(frontmatter.description).toBeUndefined();
    expect(content).toBe('Body text only');
  });

  it('supports id as fallback for slug', () => {
    const markdown = `---
id: custom-id-slug
title: Post with ID
---
Content`;
    const { frontmatter } = parseFrontmatter(markdown);
    expect(frontmatter.slug).toBe('custom-id-slug');
  });

  it('throws error when frontmatter block is missing', () => {
    expect(() => parseFrontmatter('No frontmatter here\nJust text')).toThrow(
      /Invalid blog markdown: missing YAML frontmatter block/,
    );
  });
});

describe('parser: Markdown Tables', () => {
  it('splits table row into cells correctly, handling leading/trailing pipes and escapes', () => {
    const cells1 = splitTableRow('| Col 1 | Col 2 | Col 3 |');
    expect(cells1).toEqual(['Col 1', 'Col 2', 'Col 3']);

    const cells2 = splitTableRow('Col A | Col B');
    expect(cells2).toEqual(['Col A', 'Col B']);

    const cellsEscaped = splitTableRow('| Key | Escaped \\| Pipe | Val |');
    expect(cellsEscaped).toEqual(['Key', 'Escaped | Pipe', 'Val']);
  });

  it('validates table delimiter rows correctly', () => {
    expect(isTableDelimiterRow(['---', '---'])).toBe(true);
    expect(isTableDelimiterRow([':---', ':---:', '---:'])).toBe(true);
    expect(isTableDelimiterRow([':-:', ':-', '-:'])).toBe(true);
    expect(isTableDelimiterRow(['abc', '---'])).toBe(false);
    expect(isTableDelimiterRow([])).toBe(false);
  });

  it('determines column alignment from delimiter syntax', () => {
    expect(getColumnAlignment(':---')).toBe('left');
    expect(getColumnAlignment('---')).toBe('left');
    expect(getColumnAlignment(':---:')).toBe('center');
    expect(getColumnAlignment(':-:')).toBe('center');
    expect(getColumnAlignment('---:')).toBe('right');
    expect(getColumnAlignment('-:')).toBe('right');
  });

  it('parses standalone markdown table block with alignments and cell formatting', () => {
    const tableMd = `| Item | Alignment | Score |
|:---|:---:|---:|
| **Alpha** | Center | \`100\` |
| *Beta* | Center | \`200\` |`;

    const html = parseTableBlock(tableMd);
    expect(html).not.toBeNull();
    expect(html).toContain('custom-table-container not-prose');
    expect(html).toContain('table class="w-full m-0 text-left font-mono text-xs sm:text-sm border-collapse"');
    expect(html).toContain('border-b border-ctp-surface0/60');
    expect(html).toContain('Item</th>');
    expect(html).toContain('Alignment</th>');
    expect(html).toContain('Score</th>');
    expect(html).toContain('<strong>Alpha</strong>');
    expect(html).toContain('<em>Beta</em>');
    expect(html).toContain('<code>100</code>');
    expect(html).toContain('<code>200</code>');
  });

  it('renders table with optional description caption when inside custom blocks', () => {
    const tableMd = `| Metric | Value |
|---|---|
| IPC | 2.5 |`;

    const html = parseTableBlock(tableMd, 'Benchmarking IPC results');
    expect(html).not.toBeNull();
    expect(html).toContain('custom-table-container');
    expect(html).toContain('table-desc');
    expect(html).toContain('Benchmarking IPC results');
  });

  it('returns null for non-table markdown blocks', () => {
    expect(parseTableBlock('Just a normal paragraph without pipes.')).toBeNull();
    expect(parseTableBlock('Single line with pipe | not table')).toBeNull();
    expect(parseTableBlock('Line 1 | Line 2\nNot delimiter line')).toBeNull();
  });
});

describe('parser: Full Blog Post Parser', () => {
  it('parses dummy post and renders standalone table HTML', async () => {
    const parsed = await parseMarkdownBlog(DUMMY_BLOG_POST);
    expect(parsed.html).toContain('custom-table-container');
    expect(parsed.html).toContain('Latency');
    expect(parsed.html).toContain('66 ns');
    expect(parsed.html).toContain('<strong>6.0x</strong>');
  });

  it('parses markdown table inside custom angle block <> with @desc caption', async () => {
    const parsed = await parseMarkdownBlog(DUMMY_BLOG_POST);
    expect(parsed.html).toContain('Vector Scan');
    expect(parsed.html).toContain('4.2 GB/s');
    expect(parsed.html).toContain('High-performance vector scanning benchmarks on dummy data');
  });

  it('renders custom angle and tilde code blocks with Shiki syntax highlighting and copy buttons', async () => {
    const parsed = await parseMarkdownBlog(DUMMY_BLOG_POST);
    expect(parsed.html).toContain('custom-code-block-angle');
    expect(parsed.html).toContain('custom-code-block-tilde');
    expect(parsed.html).toContain('copy-code-btn');
    expect(parsed.html).toContain('Rust implementation of dummy scan');
    expect(parsed.html).toContain('C extern signature');
    expect(parsed.html).toContain('data-code=');
  });

  it('renders callouts for [!TIP] and [!WARNING]', async () => {
    const parsed = await parseMarkdownBlog(DUMMY_BLOG_POST);
    expect(parsed.html).toContain('callout-tip');
    expect(parsed.html).toContain('Hardware acceleration yields significant latency reductions.');
    expect(parsed.html).toContain('callout-warning');
    expect(parsed.html).toContain('Ensure alignment before calling unaligned load intrinsics.');
  });

  it('renders animation tags for both {@anim (...)} and {ANIM...}', async () => {
    const parsed = await parseMarkdownBlog(DUMMY_BLOG_POST);
    expect(parsed.html).toContain('data-anim-id="001"');
    expect(parsed.html).toContain('visual demo showing 512-bit vector register comparison');
    expect(parsed.html).toContain('data-anim-id="ANIM002"');
    expect(parsed.html).toContain('second animation format demo');
  });

  it('renders LaTeX math equations via KaTeX', async () => {
    const parsed = await parseMarkdownBlog(DUMMY_BLOG_POST);
    expect(parsed.html).toContain('katex');
    expect(parsed.html).toContain('Speedup');
  });

  it('renders headers with section anchors and symbols (§ and ⁕)', async () => {
    const parsed = await parseMarkdownBlog(DUMMY_BLOG_POST);
    expect(parsed.html).toContain('id="benchmark-summary"');
    expect(parsed.html).toContain('⁕');
    expect(parsed.html).toContain('id="custom-block-with-table"');
    expect(parsed.html).toContain('§');
    expect(parsed.html).toContain('id="equations-section"');
  });

  it('renders ordered and unordered lists', async () => {
    const parsed = await parseMarkdownBlog(DUMMY_BLOG_POST);
    expect(parsed.html).toContain('<ul class="list-none');
    expect(parsed.html).toContain('First item with <code>code</code>');
    expect(parsed.html).toContain('<ol class="list-decimal');
    expect(parsed.html).toContain('Initialize buffer');
  });

  it('extracts glossary section into structured items', async () => {
    const parsed = await parseMarkdownBlog(DUMMY_BLOG_POST);
    expect(parsed.glossary.length).toBe(2);
    expect(parsed.glossary[0].term).toBe('SIMD');
    expect(parsed.glossary[0].definitionHtml).toContain('Single Instruction Multiple Data');
    expect(parsed.glossary[1].term).toBe('AVX-512');
  });

  it('extracts references and links footnotes in prose', async () => {
    const parsed = await parseMarkdownBlog(DUMMY_BLOG_POST);
    expect(parsed.references.length).toBe(1);
    expect(parsed.references[0].id).toBe('algo-1');
    expect(parsed.references[0].contentHtml).toContain('Fast scanning algorithm reference guide');
    expect(parsed.html).toContain('href="#fn-algo-1"');
    expect(parsed.html).toContain('id="fnref-algo-1"');
  });

  it('calculates word count and reading time', async () => {
    const parsed = await parseMarkdownBlog(DUMMY_BLOG_POST);
    expect(parsed.wordCount).toBeGreaterThan(10);
    expect(parsed.readTimeMinutes).toBeGreaterThanOrEqual(1);
  });
});

describe('parser: Slugify, Dates, and Inline Utilities', () => {
  it('slugifies titles with special characters and symbols', () => {
    expect(slugify('§ Hello World!')).toBe('hello-world');
    expect(slugify('⁕ AVX-512 & SIMD Performance')).toBe('avx-512-simd-performance');
    expect(slugify('Simple Title 123')).toBe('simple-title-123');
  });

  it('parses inline markdown links, formatting and math', () => {
    const input = 'Check **bold**, _italic_, `code`, and [Google](https://google.com) plus $x+y$.';
    const output = parseSimpleMarkdownInline(input);
    expect(output).toContain('<strong>bold</strong>');
    expect(output).toContain('<em>italic</em>');
    expect(output).toContain('<code>code</code>');
    expect(output).toContain(
      '<a href="https://google.com" target="_blank" rel="noreferrer">Google</a>',
    );
    expect(output).toContain('katex');
  });

  it('validates date strings according to format and calendar bounds', () => {
    expect(isValidDateString('15-09-2026')).toBe(true);
    expect(isValidDateString('2026-09-15')).toBe(true);
    expect(isValidDateString('99-99-9999')).toBe(false);
    expect(isValidDateString('invalid-date')).toBe(false);
  });
});

describe('parser: Authoring Error Catching (Validator Unit Tests)', () => {
  it('catches missing frontmatter, bad dates, and empty tags', async () => {
    const invalidPost = `---
slug: Invalid Slug Spaces!
title:
created: 99-99-9999
tags:
---
Body text.`;

    const parsed = await parseMarkdownBlog(invalidPost);
    const errors = validateBlogPost(parsed);

    expect(errors.some((e) => e.field === 'slug')).toBe(true);
    expect(errors.some((e) => e.field === 'title')).toBe(true);
    expect(errors.some((e) => e.field === 'created')).toBe(true);
    expect(errors.some((e) => e.field === 'tags')).toBe(true);
  });

  it('catches unlinked footnote citations', async () => {
    const postWithBrokenFootnote = `---
slug: broken-footnote
title: Post with Missing Reference
created: 01-09-2026
tags: test
---
Here is a citation[^missing-ref] that has no definition.

@references

[^other-ref]: Other reference.
`;

    const parsed = await parseMarkdownBlog(postWithBrokenFootnote);
    const errors = validateBlogPost(parsed);

    expect(
      errors.some(
        (e) =>
          e.field === 'references' &&
          e.message.includes("Footnote citation '[^missing-ref]'"),
      ),
    ).toBe(true);
  });

  it('catches duplicate slugs across multiple posts', async () => {
    const post1 = await parseMarkdownBlog(`---
slug: duplicate-slug
title: Post 1
created: 01-09-2026
tags: a
---
Content 1`);

    const post2 = await parseMarkdownBlog(`---
slug: duplicate-slug
title: Post 2
created: 02-09-2026
tags: b
---
Content 2`);

    const errors = validateAllBlogPosts([post1, post2]);
    expect(errors.some((e) => e.message.includes("Duplicate slug 'duplicate-slug'"))).toBe(true);
  });

  it('correctly parses <fig> block and excludes its diagram content from word count', async () => {
    const postWithFig = `---
slug: fig-post
title: Fig Post
created: 15-11-2026
tags: rust
---
Paragraph before diagram.

<fig>
\`\`\`
Slot 0 -> Slot 1 -> Slot 2
\`\`\`
@desc Diagram of slot transitions across stages
</fig>

Paragraph after diagram.
`;
    const parsed = await parseMarkdownBlog(postWithFig);
    expect(parsed.html).toContain('custom-fig-block');
    expect(parsed.html).toContain('Diagram of slot transitions across stages');
    expect(parsed.html).not.toContain('copy-code-btn');
    expect(parsed.html).not.toContain('cat diagram.fig');
    expect(parsed.wordCount).toBe(6);
  });
});
