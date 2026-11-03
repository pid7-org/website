import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMarkdownBlog } from 'mdparser';

describe('Integration: Production Blog Articles Content Validation', () => {
  const contentDir = path.resolve(process.cwd(), 'src/content/blog');

  it('parses all production markdown articles without syntax errors or unhandled tags', async () => {
    const files = await fs.readdir(contentDir);
    const mdFiles = files.filter((f) => f.endsWith('.md'));

    expect(mdFiles.length).toBeGreaterThan(0);

    for (const file of mdFiles) {
      const raw = await fs.readFile(path.join(contentDir, file), 'utf-8');
      const parsed = await parseMarkdownBlog(raw);

      // Frontmatter contracts
      expect(parsed.frontmatter.title, `Empty title in ${file}`).toBeTruthy();
      expect(parsed.frontmatter.slug, `Empty slug in ${file}`).toBeTruthy();
      expect(parsed.frontmatter.created, `Empty created date in ${file}`).toBeTruthy();
      expect(parsed.frontmatter.tags.length, `Missing tags in ${file}`).toBeGreaterThan(0);

      // HTML output integrity
      expect(parsed.html, `HTML output empty in ${file}`).toBeTruthy();
      expect(parsed.html, `Leftover @desc in ${file}`).not.toContain('@desc');
      expect(parsed.html, `Leftover raw code markers in ${file}`).not.toContain('<>```');
      expect(parsed.html, `Broken KaTeX rendering in ${file}`).not.toContain('katex-error');

      // Headings contract (at least one section heading with id in each article)
      const headingIds = [...parsed.html.matchAll(/<h2 id="([^"]+)"/g)].map((m) => m[1]);
      expect(headingIds.length, `No h2 section headings extracted in ${file}`).toBeGreaterThan(0);
      for (const hid of headingIds) {
        expect(hid, `Empty heading id in ${file}`).toBeTruthy();
      }

      // Footnote references consistency
      if (parsed.references.length > 0) {
        const refIds = new Set(parsed.references.map((r) => r.id));
        const footnoteMatches = [...parsed.html.matchAll(/id="fnref-([^"]+)"/g)].map((m) => m[1]);
        for (const fnId of footnoteMatches) {
          expect(refIds.has(fnId), `Footnote [^${fnId}] referenced without citation in @references`).toBe(true);
        }
      }

      // Glossary consistency
      if (parsed.glossary.length > 0) {
        for (const g of parsed.glossary) {
          expect(g.term, `Empty glossary term in ${file}`).toBeTruthy();
          expect(g.definitionHtml, `Empty glossary definition in ${file}`).toBeTruthy();
        }
      }
    }
  });
});
