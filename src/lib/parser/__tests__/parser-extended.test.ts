import { describe, expect, it } from 'vitest';
import { parseFrontmatter, parseMarkdownBlog } from '../index';

describe('Markdown Parser Extended Core Logic', () => {
  it('throws an error when YAML frontmatter is completely missing', () => {
    const raw = '# Just markdown without frontmatter\nSome content';
    expect(() => parseFrontmatter(raw)).toThrowError('missing YAML frontmatter block');
  });

  it('renders all 6 callout variants: INFO, TIP, NOTE, TASK, WARNING, CAUTION', async () => {
    const sample = `---
slug: callouts-test
title: Callouts Test
created: 01-01-2026
---

> [!INFO]
> Info message body.

> [!TIP]
> Tip message body.

> [!NOTE]
> Note message body.

> [!TASK]
> Task message body.

> [!WARNING]
> Warning message body.

> [!CAUTION]
> Caution message body.
`;

    const parsed = await parseMarkdownBlog(sample);
    expect(parsed.html).toContain('callout-info');
    expect(parsed.html).toContain('callout-tip');
    expect(parsed.html).toContain('callout-note');
    expect(parsed.html).toContain('callout-task');
    expect(parsed.html).toContain('callout-warning');
    expect(parsed.html).toContain('callout-caution');
  });

  it('handles custom code blocks without @desc caption gracefully', async () => {
    const sample = `---
slug: no-caption-test
title: No Caption Code Block
created: 01-01-2026
---

<>
\`\`\`rust
fn main() {}
\`\`\`
</>
`;

    const parsed = await parseMarkdownBlog(sample);
    expect(parsed.html).toContain('custom-code-block-angle');
    expect(parsed.html).not.toContain('@desc');
    expect(parsed.html).toContain('class="shiki');
  });

  it('renders alternative animation syntax {ANIM042: test description}', async () => {
    const sample = `---
slug: anim-alt-syntax
title: Anim Alt Syntax
created: 01-01-2026
---

{ANIM042: visual buffer simulation}
`;

    const parsed = await parseMarkdownBlog(sample);
    expect(parsed.html).toContain('data-anim-id="ANIM042"');
    expect(parsed.html).toContain('visual buffer simulation');
  });

  it('handles invalid KaTeX formulas with fallback without crashing', async () => {
    const sample = `---
slug: katex-error-test
title: KaTeX Error Test
created: 01-01-2026
---

$$
\\invalidMacroXYZ{{{
$$
`;

    const parsed = await parseMarkdownBlog(sample);
    expect(parsed.html).toBeDefined();
    expect(parsed.html.length).toBeGreaterThan(0);
  });

  it('generates header anchors with § symbols and slugified IDs', async () => {
    const sample = `---
slug: toc-test
title: Table of Contents Test
created: 01-01-2026
---

## § Hardware Registers and AVX-512

## Memory Layout & Alignment

## System Benchmarks
`;

    const parsed = await parseMarkdownBlog(sample);
    expect(parsed.html).toContain('id="hardware-registers-and-avx-512"');
    expect(parsed.html).toContain('href="#hardware-registers-and-avx-512"');
    expect(parsed.html).toContain('id="memory-layout-alignment"');
    expect(parsed.html).toContain('id="system-benchmarks"');
  });

  it('parses references and footnotes correctly with bidirectional linkage', async () => {
    const sample = `---
slug: refs-test
title: References Test
created: 01-01-2026
---

Inline citation[^refA] and second citation[^refB].

@references

[^refA]: Reference A description.
[^refB]: Reference B description.
`;

    const parsed = await parseMarkdownBlog(sample);
    expect(parsed.html).toContain('href="#fn-refA"');
    expect(parsed.html).toContain('id="fnref-refA"');
    expect(parsed.references).toHaveLength(2);
    expect(parsed.references[0].id).toBe('refA');
    expect(parsed.references[0].contentHtml).toContain('Reference A description');
  });
});
