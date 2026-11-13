import katex from "katex";
import { codeToHtml } from "shiki";
import type {
  BlogFrontmatter,
  GlossaryItem,
  ParsedBlogPost,
  ParsedTable,
  ReferenceItem,
  TableAlignment,
  ValidationError,
} from "./types.ts";

export type {
  BlogFrontmatter,
  GlossaryItem,
  ParsedBlogPost,
  ParsedTable,
  ReferenceItem,
  TableAlignment,
  ValidationError,
};

export {
  validateBlogPost,
  validateAllBlogPosts,
  isValidDateString,
} from "./validator.ts";

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---/;
const ANGLE_BLOCK_REGEX = /^<>\s*\r?\n([\s\S]*?)\r?\n^<\/>\s*$/gm;
const TILDE_BLOCK_REGEX = /^~\s*\r?\n([\s\S]*?)\r?\n^~\s*$/gm;
const CODE_FENCE_REGEX = /^```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)\r?\n```$/m;
const ANIM_TAG_REGEX =
  /(?:\{@anim\s+\(([^)]+)\)\s*([^}]*)\}|\{ANIM([A-Za-z0-9_-]+):\s*([^}]+)\})/g;
const CALLOUT_BLOCK_REGEX =
  /^>\s*\[!(INFO|TIP|NOTE|TASK|WARNING|CAUTION|IMPORTANT|SUCCESS|DANGER|BUG|QUESTION|EXAMPLE|QUOTE)\]\r?\n((?:^>.*(?:\r?\n|$))+)/gim;
const BLOCK_MATH_REGEX = /\$\$([\s\S]*?)\$\$/g;
const INLINE_MATH_REGEX = /(?<!\\)\$([^\$\n]+?)\$/g;
const FOOTNOTE_REF_REGEX = /\[\^([a-zA-Z0-9_-]+)\]/g;

export function parseFrontmatter(markdown: string): {
  frontmatter: BlogFrontmatter;
  content: string;
} {
  const match = markdown.match(FRONTMATTER_REGEX);
  if (!match) {
    throw new Error("Invalid blog markdown: missing YAML frontmatter block");
  }

  const rawYaml = match[1];
  const content = markdown.slice(match[0].length).trim();
  const fields: Record<string, string> = {};

  for (const line of rawYaml.split(/\r?\n/)) {
    const colonIdx = line.indexOf(":");
    if (colonIdx !== -1) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      fields[key] = value;
    }
  }

  const tags = fields["tags"]
    ? fields["tags"]
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const rawSlug = fields["slug"] || fields["id"] || "untitled";
  const frontmatter: BlogFrontmatter = {
    slug: rawSlug.trim(),
    title: (fields["title"] || "Untitled Post").trim(),
    created: (fields["created"] || "").trim(),
    lastUpdated: (
      fields["last-updated"] ||
      fields["lastUpdated"] ||
      fields["created"] ||
      ""
    ).trim(),
    tags,
    ...(fields["description"]
      ? { description: fields["description"].trim() }
      : {}),
  };

  return { frontmatter, content };
}

export function renderMathInText(text: string): string {
  let processed = text.replace(BLOCK_MATH_REGEX, (_, expr) => {
    try {
      return `<div class="katex-display-block">${katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false })}</div>\n\n`;
    } catch {
      return `<pre class="katex-error">${expr}</pre>\n\n`;
    }
  });

  processed = processed.replace(INLINE_MATH_REGEX, (_, expr) => {
    try {
      return katex.renderToString(expr.trim(), {
        displayMode: false,
        throwOnError: false,
      });
    } catch {
      return `<code>${expr}</code>`;
    }
  });

  return processed;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[§⁕*]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function parseSimpleMarkdownInline(text: string): string {
  let html = renderMathInText(text);

  html = html.replace(FOOTNOTE_REF_REGEX, (_, id) => {
    return `<sup class="footnote-ref"><a href="#fn-${id}" id="fnref-${id}" class="text-[var(--color-accent)] hover:underline font-mono text-[11px]">[${id}]</a></sup>`;
  });

  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  html = html.replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([\s\S]+?)__/g, "<strong>$1</strong>");

  html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, "<em>$1</em>");
  html = html.replace(
    /(?<![a-zA-Z0-9_])_([^_]+?)_(?![a-zA-Z0-9_])/g,
    "<em>$1</em>",
  );

  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
  );

  return html;
}

export function formatLanguageName(lang: string): string {
  const normalized = (lang || "").trim().toLowerCase();
  const map: Record<string, string> = {
    rs: "Rust",
    rust: "Rust",
    js: "JavaScript",
    javascript: "JavaScript",
    ts: "TypeScript",
    typescript: "TypeScript",
    jsx: "JSX",
    tsx: "TSX",
    py: "Python",
    python: "Python",
    c: "C",
    cpp: "C++",
    "c++": "C++",
    cc: "C++",
    cxx: "C++",
    cs: "C#",
    csharp: "C#",
    "c#": "C#",
    go: "Go",
    golang: "Go",
    sh: "Bash",
    bash: "Bash",
    zsh: "Zsh",
    shell: "Shell",
    shellscript: "Shell",
    asm: "ASM",
    nasm: "NASM",
    x86asm: "x86 ASM",
    assembly: "Assembly",
    html: "HTML",
    css: "CSS",
    scss: "SCSS",
    sass: "SASS",
    json: "JSON",
    yaml: "YAML",
    yml: "YAML",
    toml: "TOML",
    xml: "XML",
    sql: "SQL",
    md: "Markdown",
    markdown: "Markdown",
    zig: "Zig",
    lua: "Lua",
    java: "Java",
    kt: "Kotlin",
    kotlin: "Kotlin",
    swift: "Swift",
    rb: "Ruby",
    ruby: "Ruby",
    php: "PHP",
    r: "R",
    dart: "Dart",
    graphql: "GraphQL",
    gql: "GraphQL",
    docker: "Docker",
    dockerfile: "Dockerfile",
    astro: "Astro",
    wasm: "WASM",
    diff: "Diff",
    txt: "Text",
    text: "Text",
    plain: "Text",
  };

  if (map[normalized]) {
    return map[normalized];
  }

  if (!normalized) {
    return "Code";
  }

  if (normalized.length <= 3) {
    return normalized.toUpperCase();
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function normalizeShikiLang(lang: string): string {
  const clean = (lang || "").trim().toLowerCase();
  const map: Record<string, string> = {
    "c++": "cpp",
    "c#": "csharp",
    yml: "yaml",
  };
  return map[clean] || clean || "text";
}

export async function highlightCode(
  code: string,
  lang: string,
): Promise<string> {
  const normalizedLang = normalizeShikiLang(lang);
  try {
    return await codeToHtml(code.trim(), {
      lang: normalizedLang,
      themes: {
        light: "rose-pine-dawn",
        dark: "rose-pine-moon",
      },
      defaultColor: false,
    });
  } catch {
    try {
      return await codeToHtml(code.trim(), {
        lang: "txt",
        themes: {
          light: "rose-pine-dawn",
          dark: "rose-pine-moon",
        },
        defaultColor: false,
      });
    } catch {
      return `<pre><code>${code}</code></pre>`;
    }
  }
}

export function splitTableRow(row: string): string[] {
  let trimmed = row.trim();
  if (trimmed.startsWith("|")) {
    trimmed = trimmed.slice(1);
  }
  if (trimmed.endsWith("|") && !trimmed.endsWith("\\|")) {
    trimmed = trimmed.slice(0, -1);
  }

  const cells: string[] = [];
  let current = "";
  let escaped = false;

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (escaped) {
      current += char;
      escaped = false;
    } else if (char === "\\") {
      if (i + 1 < trimmed.length && trimmed[i + 1] === "|") {
        escaped = true;
      } else {
        current += char;
      }
    } else if (char === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function isTableDelimiterRow(cells: string[]): boolean {
  if (cells.length === 0) return false;
  return cells.every((cell) => /^:?-{1,}:?$/.test(cell.trim()));
}

export function getColumnAlignment(cell: string): TableAlignment {
  const trimmed = cell.trim();
  const startsWithColon = trimmed.startsWith(":");
  const endsWithColon = trimmed.endsWith(":");
  if (startsWithColon && endsWithColon) return "center";
  if (endsWithColon) return "right";
  return "left";
}

export function renderTableHtml(
  headers: string[],
  aligns: TableAlignment[],
  rows: string[][],
  desc?: string,
): string {
  const alignClass = (align: TableAlignment) => {
    switch (align) {
      case "center":
        return "text-center";
      case "right":
        return "text-right";
      default:
        return "text-left";
    }
  };

  const theadHtml =
    `  <thead>\n    <tr class="bg-rp-surface/80 border-b border-rp-highlight-med text-[var(--color-accent)] font-semibold">\n` +
    headers
      .map(
        (h, i) =>
          `      <th scope="col" class="py-2 px-3 sm:py-2.5 sm:px-3.5 text-[var(--color-accent)] font-semibold border-r border-rp-highlight-med/30 last:border-r-0 ${alignClass(aligns[i] || "left")}">${parseSimpleMarkdownInline(h)}</th>`,
      )
      .join("\n") +
    `\n    </tr>\n  </thead>`;

  const tbodyHtml =
    `  <tbody class="divide-y divide-rp-highlight-med/30">\n` +
    rows
      .map((row) => {
        const cellsHtml = row
          .map(
            (cell, i) =>
              `      <td class="py-2 px-3 sm:py-2.5 sm:px-3.5 text-rp-text border-r border-rp-highlight-med/30 last:border-r-0 ${alignClass(aligns[i] || "left")}">${parseSimpleMarkdownInline(cell)}</td>`,
          )
          .join("\n");
        return `    <tr class="hover:bg-rp-surface/40 transition-colors">\n${cellsHtml}\n    </tr>`;
      })
      .join("\n") +
    `\n  </tbody>`;

  const descHtml = desc
    ? `\n  <div class="table-desc font-mono italic text-[10px] leading-normal text-rp-muted border-t border-rp-highlight-med/40 pt-2 px-3.5 pb-2 bg-rp-surface/20">${parseSimpleMarkdownInline(desc)}</div>`
    : "";

  return (
    `<div class="custom-table-container not-prose my-4 sm:my-6 rounded-lg border border-rp-highlight-med bg-rp-surface/60 overflow-hidden shadow-xs">\n` +
    `  <div class="overflow-x-auto">\n` +
    `    <table class="w-full m-0 text-left font-mono text-xs sm:text-sm border-collapse">\n` +
    `${theadHtml}\n` +
    `${tbodyHtml}\n` +
    `    </table>\n` +
    `  </div>${descHtml}\n` +
    `</div>`
  );
}

export function parseTableBlock(block: string, desc?: string): string | null {
  const lines = block.trim().split(/\r?\n/);
  if (lines.length < 2) return null;

  const headerCells = splitTableRow(lines[0]);
  const delimiterCells = splitTableRow(lines[1]);

  if (headerCells.length === 0 || !isTableDelimiterRow(delimiterCells)) {
    return null;
  }

  const alignments = delimiterCells.map(getColumnAlignment);
  const columnCount = Math.max(headerCells.length, alignments.length);

  while (headerCells.length < columnCount) {
    headerCells.push("");
  }
  while (alignments.length < columnCount) {
    alignments.push("left");
  }

  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const rowCells = splitTableRow(line);
    while (rowCells.length < columnCount) {
      rowCells.push("");
    }
    rows.push(rowCells.slice(0, columnCount));
  }

  return renderTableHtml(headerCells, alignments, rows, desc);
}

export async function processCustomBlocks(content: string): Promise<string> {
  const replaceBlock = async (
    match: string,
    inner: string,
    style: "angle" | "tilde",
  ) => {
    let desc = "";
    const lines = inner.split(/\r?\n/);
    const descIdx = lines.findIndex((l) => l.trim().startsWith("@desc"));
    if (descIdx !== -1) {
      const descLines = lines.slice(descIdx);
      desc = descLines
        .map((l, i) => (i === 0 ? l.trim().replace(/^@desc\s*/, "") : l.trim()))
        .filter(Boolean)
        .join(" ");
      lines.splice(descIdx, lines.length - descIdx);
    }

    const blockText = lines.join("\n").trim();

    const tableHtml = parseTableBlock(blockText, desc);
    if (tableHtml) {
      return `${tableHtml}\n\n`;
    }

    let codeStr = "";
    let lang = "";
    const fenceMatch = blockText.match(CODE_FENCE_REGEX);

    if (fenceMatch) {
      lang = fenceMatch[1];
      codeStr = fenceMatch[2];
    } else {
      codeStr = blockText;
    }

    const highlighted = await highlightCode(codeStr, lang);
    const descHtml = desc
      ? `<div class="code-desc font-mono italic text-[10px] leading-normal text-rp-muted border-t border-rp-highlight-med/40 pt-2 px-3.5 pb-2 bg-rp-surface/20">${parseSimpleMarkdownInline(desc)}</div>`
      : "";

    const cleanRawCode = codeStr.trim();
    const encodedRawCode = encodeURIComponent(cleanRawCode);

    const displayLang = formatLanguageName(lang);

    return `<div class="custom-code-block custom-code-block-${style} my-4 sm:my-6 rounded-lg border border-rp-highlight-med bg-rp-surface/60 overflow-hidden shadow-xs" data-block-style="${style}">
      <div class="code-header flex items-center justify-between px-3 sm:px-3.5 py-1.5 bg-rp-surface/30 border-b border-rp-highlight-med/40 text-xs font-mono text-rp-muted select-none">
        <span class="code-lang tracking-wider text-[10px] sm:text-[11px] text-rp-subtle font-bold">${displayLang}</span>
        <button
          type="button"
          class="copy-code-btn p-1 rounded text-rp-muted hover:text-rp-text hover:bg-rp-highlight-med/50 transition-colors cursor-pointer"
          data-code="${encodedRawCode}"
          aria-label="Copy code"
          title="Copy code to clipboard"
        >
          <svg class="w-3.5 h-3.5 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
      </div>
      <div class="code-body overflow-x-auto p-2.5 sm:p-3.5 font-mono text-xs sm:text-sm leading-relaxed">${highlighted}</div>
      ${descHtml}
    </div>\n\n`;
  };

  let result = content;
  const angleMatches = Array.from(content.matchAll(ANGLE_BLOCK_REGEX));
  for (const match of angleMatches) {
    const replacement = await replaceBlock(match[0], match[1], "angle");
    result = result.replace(match[0], replacement);
  }

  const tildeMatches = Array.from(result.matchAll(TILDE_BLOCK_REGEX));
  for (const match of tildeMatches) {
    const replacement = await replaceBlock(match[0], match[1], "tilde");
    result = result.replace(match[0], replacement);
  }

  return result;
}

export function processCallouts(content: string): string {
  return content.replace(
    CALLOUT_BLOCK_REGEX,
    (_, type: string, bodyLines: string) => {
      const cleanLines = bodyLines
        .split(/\r?\n/)
        .map((line) => line.replace(/^>\s?/, ""))
        .join("\n")
        .trim();

      const bodyHtml = parseSimpleMarkdownInline(cleanLines);
      const typeLower = type.toLowerCase();

      return `<div class="callout callout-${typeLower} my-4 sm:my-6 p-3.5 sm:p-4 rounded-r-lg border-l-4 border-[var(--color-accent)] bg-[var(--color-accent)]/5 space-y-1.5">
      <div class="callout-header font-serif italic text-xs sm:text-sm font-semibold text-[var(--color-accent)] select-none">
        ${typeLower}
      </div>
      <div class="callout-body font-mono text-xs sm:text-sm leading-relaxed text-rp-text break-words">
        ${bodyHtml}
      </div>
    </div>\n\n`;
    },
  );
}

export function processAnimationTags(content: string): string {
  return content.replace(
    ANIM_TAG_REGEX,
    (_, animId1, desc1, animId2, desc2) => {
      let animId = "";
      let desc = "";

      if (animId1 !== undefined) {
        animId = animId1.trim();
        desc = (desc1 || "").trim();
      } else {
        const cleanId = (animId2 || "").trim();
        animId =
          cleanId.startsWith("ANIM") ||
          cleanId.includes("-") ||
          cleanId.includes("_")
            ? cleanId
            : `ANIM${cleanId}`;
        desc = (desc2 || "").trim();
      }

      return `<div class="blog-animation-wrapper my-6 sm:my-8" data-anim-id="${animId}" data-anim-desc="${desc}">
      <div id="anim-slot-${animId}" class="anim-slot flex flex-col items-center justify-center p-4 sm:p-6 border border-dashed border-rp-highlight-med/40 rounded-lg bg-rp-surface/40 font-mono text-xs text-rp-muted">
        <span class="text-[var(--color-accent)] font-semibold mb-1">Interactive Visualizer [${animId}]</span>
        <span>${desc}</span>
      </div>
    </div>\n\n`;
    },
  );
}

export function parseGlossary(glossaryMarkdown: string): GlossaryItem[] {
  const items: GlossaryItem[] = [];
  const lines = glossaryMarkdown.split(/\r?\n/);
  let currentTerm = "";
  let currentDefLines: string[] = [];

  const flush = () => {
    if (currentTerm) {
      const rawDef = currentDefLines.join(" ").trim();
      items.push({
        term: currentTerm,
        definitionHtml: parseSimpleMarkdownInline(rawDef),
      });
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^\*\s*([^:]+):\s*(.*)$/);
    if (match) {
      flush();
      currentTerm = match[1].trim();
      currentDefLines = [match[2].trim()];
    } else if (currentTerm) {
      currentDefLines.push(trimmed);
    }
  }
  flush();

  return items;
}

export function parseReferences(referencesMarkdown: string): ReferenceItem[] {
  const items: ReferenceItem[] = [];
  const entries = referencesMarkdown.split(/(?=\[\^[\w-]+\]:)/);

  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^\[\^([\w-]+)\]:\s*([\s\S]*)$/);
    if (match) {
      const label = match[1];
      const contentRaw = match[2].trim();
      items.push({
        id: label,
        label,
        contentHtml: parseSimpleMarkdownInline(contentRaw),
      });
    }
  }

  return items;
}

export function processListBlock(block: string): string | null {
  const lines = block.trim().split(/\r?\n/);
  if (lines.length === 0) return null;

  const firstLine = lines[0].trim();
  const isUnordered = /^[\*\-\+]\s+/.test(firstLine);
  const isOrdered = /^\d+\.\s+/.test(firstLine);

  if (!isUnordered && !isOrdered) {
    const listStartIdx = lines.findIndex(
      (l) => /^[\*\-\+]\s+/.test(l.trim()) || /^\d+\.\s+/.test(l.trim()),
    );
    if (listStartIdx > 0) {
      const introLines = lines.slice(0, listStartIdx).join("\n").trim();
      const listLines = lines.slice(listStartIdx).join("\n");
      const listHtml = processListBlock(listLines);
      if (listHtml) {
        const introHtml = introLines
          ? `<p class="font-mono text-xs sm:text-sm leading-relaxed text-rp-text my-3.5 sm:my-4">${parseSimpleMarkdownInline(introLines)}</p>`
          : "";
        return introHtml ? `${introHtml}\n\n${listHtml}` : listHtml;
      }
    }
    return null;
  }

  const items: string[] = [];
  let currentItem = "";

  for (const line of lines) {
    const isNewItem = isUnordered
      ? /^[\*\-\+]\s+/.test(line.trim())
      : /^\d+\.\s+/.test(line.trim());

    if (isNewItem) {
      if (currentItem) {
        items.push(currentItem.trim());
      }
      currentItem = line.trim().replace(/^([\*\-\+]|\d+\.)\s+/, "");
    } else {
      currentItem += " " + line.trim();
    }
  }
  if (currentItem) {
    items.push(currentItem.trim());
  }

  if (isUnordered) {
    const itemsHtml = items
      .map(
        (item) =>
          `<li class="leading-relaxed pl-4 relative before:content-['-'] before:absolute before:left-0 before:text-rp-muted">${parseSimpleMarkdownInline(item)}</li>`,
      )
      .join("\n");
    return `<ul class="list-none space-y-1.5 my-3.5 sm:my-4 font-mono text-xs sm:text-sm text-rp-text">\n${itemsHtml}\n</ul>`;
  } else {
    const itemsHtml = items
      .map(
        (item) =>
          `<li class="leading-relaxed">${parseSimpleMarkdownInline(item)}</li>`,
      )
      .join("\n");
    return `<ol class="list-decimal list-inside space-y-1.5 my-3.5 sm:my-4 font-mono text-xs sm:text-sm text-rp-text">\n${itemsHtml}\n</ol>`;
  }
}

export async function parseMarkdownBlog(
  rawMarkdown: string,
): Promise<ParsedBlogPost> {
  const { frontmatter, content: rawBody } = parseFrontmatter(rawMarkdown);

  const glossaryIdx = rawBody.indexOf("@glossary");
  const referencesIdx = rawBody.indexOf("@references");

  let bodyMarkdown = rawBody;
  let glossaryMarkdown = "";
  let referencesMarkdown = "";

  const indices = [
    { type: "glossary", idx: glossaryIdx },
    { type: "references", idx: referencesIdx },
  ]
    .filter((x) => x.idx !== -1)
    .sort((a, b) => a.idx - b.idx);

  if (indices.length > 0) {
    bodyMarkdown = rawBody.slice(0, indices[0].idx).trim();

    for (let i = 0; i < indices.length; i++) {
      const current = indices[i];
      const nextIdx =
        i + 1 < indices.length ? indices[i + 1].idx : rawBody.length;
      const sectionText = rawBody
        .slice(current.idx, nextIdx)
        .replace(/^@(glossary|references)/, "")
        .trim();

      if (current.type === "glossary") {
        glossaryMarkdown = sectionText;
      } else if (current.type === "references") {
        referencesMarkdown = sectionText;
      }
    }
  }

  const proseTextOnly = bodyMarkdown
    .replace(/^<>\s*[\s\S]*?^<\/>\s*$/gm, "")
    .replace(/^~\s*[\s\S]*?^~\s*$/gm, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\{@anim[\s\S]*?\}/g, "")
    .replace(/\{ANIM[\s\S]*?\}/g, "")
    .replace(/\$\$[\s\S]*?\$\$/g, "")
    .replace(/(?<!\\)\$[^\$\n]+?\$/g, "")
    .replace(/^>\s*\[!.*?\]/gm, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\|/g, " ")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim();

  const plainTextWords = proseTextOnly
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  const readTimeMinutes = Math.max(1, Math.ceil(plainTextWords / 200));
  const wordCount = plainTextWords;

  let html = await processCustomBlocks(bodyMarkdown);
  html = processCallouts(html);
  html = processAnimationTags(html);

  html = html.replace(/^#\s+([^#\n].*)$/gm, (_, title) => {
    const id = slugify(title);
    return `<h1 id="${id}" class="font-serif italic text-2xl sm:text-4xl font-semibold mt-8 sm:mt-10 mb-3 sm:mb-4 text-rp-text leading-tight break-words">
      <span>${parseSimpleMarkdownInline(title)}</span>
    </h1>`;
  });

  html = html.replace(/^##\s+([§⁕])\s+(.*)$/gm, (_, symbol, title) => {
    const id = slugify(title);
    return `<h2 id="${id}" class="font-serif text-lg sm:text-2xl font-semibold mt-8 sm:mt-10 mb-3 sm:mb-4 text-rp-text flex items-center gap-2 group flex-wrap">
      <span class="text-[var(--color-accent)] font-mono font-normal">${symbol}</span>
      <span>${parseSimpleMarkdownInline(title)}</span>
      <a href="#${id}" class="opacity-0 group-hover:opacity-100 text-rp-muted hover:text-[var(--color-accent)] font-mono text-xs transition-opacity ml-2">#</a>
    </h2>`;
  });

  html = html.replace(/^##\s+([^§⁕\n].*)$/gm, (_, title) => {
    const id = slugify(title);
    return `<h2 id="${id}" class="font-serif text-lg sm:text-2xl font-semibold mt-8 sm:mt-10 mb-3 sm:mb-4 text-rp-text flex items-center gap-2 group flex-wrap">
      <span>${parseSimpleMarkdownInline(title)}</span>
    </h2>`;
  });

  html = html.replace(/^###\s+(.*)$/gm, (_, title) => {
    const id = slugify(title);
    return `<h3 id="${id}" class="font-serif text-base sm:text-xl font-semibold mt-6 sm:mt-8 mb-2 sm:mb-3 text-rp-text flex items-center gap-2 group flex-wrap">
      <span>${parseSimpleMarkdownInline(title)}</span>
    </h3>`;
  });

  html = html.replace(/^####\s+(.*)$/gm, (_, title) => {
    const id = slugify(title);
    return `<h4 id="${id}" class="font-serif text-sm sm:text-base font-semibold mt-4 sm:mt-6 mb-2 text-rp-text flex items-center gap-2 group flex-wrap">
      <span>${parseSimpleMarkdownInline(title)}</span>
    </h4>`;
  });

  const blocks = html.split(/\n\s*\n/);
  const processedBlocks = blocks.map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return "";
    if (
      trimmed.startsWith("<div") ||
      trimmed.startsWith("<table") ||
      trimmed.startsWith("<h1") ||
      trimmed.startsWith("<h2") ||
      trimmed.startsWith("<h3") ||
      trimmed.startsWith("<h4") ||
      trimmed.startsWith("<blockquote") ||
      trimmed.startsWith("<pre") ||
      trimmed.startsWith("<ul") ||
      trimmed.startsWith("<ol")
    ) {
      return trimmed;
    }

    const tableHtml = parseTableBlock(trimmed);
    if (tableHtml) {
      return tableHtml;
    }

    const listHtml = processListBlock(trimmed);
    if (listHtml) {
      return listHtml;
    }

    return `<p class="font-mono text-xs sm:text-sm leading-relaxed text-rp-text my-3.5 sm:my-4">${parseSimpleMarkdownInline(trimmed)}</p>`;
  });

  html = processedBlocks.filter(Boolean).join("\n\n");

  const glossary = parseGlossary(glossaryMarkdown);
  const references = parseReferences(referencesMarkdown);

  return {
    frontmatter,
    html,
    glossary,
    references,
    readTimeMinutes,
    wordCount,
    rawMarkdown,
  };
}
