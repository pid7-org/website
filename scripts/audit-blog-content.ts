import fs from 'node:fs/promises';
import path from 'node:path';
import { parseMarkdownBlog } from '../src/lib/parser/index.ts';

async function auditBlogContent() {
  const contentDir = path.resolve(process.cwd(), 'src/content/blog');
  const files = await fs.readdir(contentDir);
  const mdFiles = files.filter((f) => f.endsWith('.md'));

  if (mdFiles.length === 0) {
    console.error('Audit failure: No markdown files found in src/content/blog');
    process.exit(1);
  }

  let errorCount = 0;

  for (const file of mdFiles) {
    const raw = await fs.readFile(path.join(contentDir, file), 'utf-8');
    try {
      const parsed = await parseMarkdownBlog(raw);

      if (!parsed.frontmatter.title) {
        console.error(`[${file}] Missing frontmatter title`);
        errorCount++;
      }
      if (!parsed.frontmatter.slug) {
        console.error(`[${file}] Missing frontmatter slug`);
        errorCount++;
      }
      if (!parsed.html) {
        console.error(`[${file}] Empty HTML output`);
        errorCount++;
      }
      if (parsed.html.includes('@desc')) {
        console.error(`[${file}] Leftover unparsed @desc tag`);
        errorCount++;
      }
      if (parsed.html.includes('<>```')) {
        console.error(`[${file}] Leftover unparsed code marker <>`);
        errorCount++;
      }
      if (parsed.html.includes('katex-error')) {
        console.error(`[${file}] Broken KaTeX rendering`);
        errorCount++;
      }

      if (parsed.references.length > 0) {
        const refIds = new Set(parsed.references.map((r) => r.id));
        const footnoteMatches = [...parsed.html.matchAll(/id="fnref-([^"]+)"/g)].map((m) => m[1]);
        for (const fnId of footnoteMatches) {
          if (!refIds.has(fnId)) {
            console.error(`[${file}] Footnote [^${fnId}] missing definition in @references`);
            errorCount++;
          }
        }
      }
    } catch (err) {
      console.error(`[${file}] Failed to parse:`, err);
      errorCount++;
    }
  }

  if (errorCount > 0) {
    console.error(`\nAudit completed with ${errorCount} error(s)`);
    process.exit(1);
  }

  console.log(`✓ Blog content audit passed: ${mdFiles.length} articles verified.`);
}

auditBlogContent();
