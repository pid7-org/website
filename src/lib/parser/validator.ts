import type { ParsedBlogPost, ValidationError } from "./types.ts";

export function isValidDateString(dateStr: string): boolean {
  if (!dateStr) return false;
  const match =
    dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/) ||
    dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  let day: number, month: number, year: number;
  if (match[1].length === 2) {
    day = parseInt(match[1], 10);
    month = parseInt(match[2], 10);
    year = parseInt(match[3], 10);
  } else {
    year = parseInt(match[1], 10);
    month = parseInt(match[2], 10);
    day = parseInt(match[3], 10);
  }

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1970 || year > 2100) return false;
  return true;
}

export function validateBlogPost(
  post: ParsedBlogPost,
  filename?: string,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const tag = filename ? `[${filename}] ` : "";

  if (!post.frontmatter.slug || post.frontmatter.slug === "untitled") {
    errors.push({
      file: filename,
      slug: post.frontmatter.slug,
      field: "slug",
      message: `${tag}Missing or invalid slug in frontmatter.`,
    });
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.frontmatter.slug)) {
    errors.push({
      file: filename,
      slug: post.frontmatter.slug,
      field: "slug",
      message: `${tag}Slug '${post.frontmatter.slug}' must be lowercase alphanumeric with hyphens (kebab-case).`,
    });
  }

  if (!post.frontmatter.title || post.frontmatter.title === "Untitled Post") {
    errors.push({
      file: filename,
      slug: post.frontmatter.slug,
      field: "title",
      message: `${tag}Missing or default post title.`,
    });
  }

  if (!isValidDateString(post.frontmatter.created)) {
    errors.push({
      file: filename,
      slug: post.frontmatter.slug,
      field: "created",
      message: `${tag}Invalid created date '${post.frontmatter.created}'. Expected valid calendar date in format DD-MM-YYYY or YYYY-MM-DD.`,
    });
  }

  if (
    post.frontmatter.lastUpdated &&
    !isValidDateString(post.frontmatter.lastUpdated)
  ) {
    errors.push({
      file: filename,
      slug: post.frontmatter.slug,
      field: "lastUpdated",
      message: `${tag}Invalid last-updated date '${post.frontmatter.lastUpdated}'. Expected valid calendar date in format DD-MM-YYYY or YYYY-MM-DD.`,
    });
  }

  if (
    !Array.isArray(post.frontmatter.tags) ||
    post.frontmatter.tags.length === 0
  ) {
    errors.push({
      file: filename,
      slug: post.frontmatter.slug,
      field: "tags",
      message: `${tag}Blog post must have at least one tag.`,
    });
  }

  if (!post.html || post.html.trim().length === 0) {
    errors.push({
      file: filename,
      slug: post.frontmatter.slug,
      field: "html",
      message: `${tag}Rendered HTML is empty.`,
    });
  }

  if (post.wordCount <= 0) {
    errors.push({
      file: filename,
      slug: post.frontmatter.slug,
      field: "wordCount",
      message: `${tag}Word count must be greater than 0.`,
    });
  }

  if (post.readTimeMinutes < 1) {
    errors.push({
      file: filename,
      slug: post.frontmatter.slug,
      field: "readTimeMinutes",
      message: `${tag}Read time must be at least 1 minute.`,
    });
  }

  if (/<p>\s*&lt;&gt;\s*<\/p>|<p>\s*&lt;\/&gt;\s*<\/p>/i.test(post.html)) {
    errors.push({
      file: filename,
      slug: post.frontmatter.slug,
      field: "html",
      message: `${tag}Unparsed custom angle block delimiter (<> or </>) leaked into HTML.`,
    });
  }

  if (/<p>\s*~\s*<\/p>/i.test(post.html)) {
    errors.push({
      file: filename,
      slug: post.frontmatter.slug,
      field: "html",
      message: `${tag}Unparsed custom tilde block delimiter (~) leaked into HTML.`,
    });
  }

  if (
    /@desc\b/i.test(post.html) &&
    !post.html.includes('class="code-desc"') &&
    !post.html.includes('class="table-desc"')
  ) {
    errors.push({
      file: filename,
      slug: post.frontmatter.slug,
      field: "html",
      message: `${tag}Unparsed @desc directive leaked into HTML.`,
    });
  }

  if (/<p>\s*&gt;\s*\[!/i.test(post.html) || /<p>\s*>\s*\[!/i.test(post.html)) {
    errors.push({
      file: filename,
      slug: post.frontmatter.slug,
      field: "html",
      message: `${tag}Unparsed callout syntax (> [!TYPE]) leaked into HTML.`,
    });
  }

  if (post.html.includes("katex-error")) {
    errors.push({
      file: filename,
      slug: post.frontmatter.slug,
      field: "html",
      message: `${tag}KaTeX math equation syntax error found in HTML.`,
    });
  }

  for (const item of post.glossary) {
    if (!item.term.trim() || !item.definitionHtml.trim()) {
      errors.push({
        file: filename,
        slug: post.frontmatter.slug,
        field: "glossary",
        message: `${tag}Glossary item '${item.term}' has missing term or definition.`,
      });
    }
  }

  const definedRefIds = new Set(post.references.map((r) => r.id));
  for (const ref of post.references) {
    if (!ref.id.trim() || !ref.contentHtml.trim()) {
      errors.push({
        file: filename,
        slug: post.frontmatter.slug,
        field: "references",
        message: `${tag}Reference '${ref.id}' has missing ID or content.`,
      });
    }
  }

  const citationMatches = post.rawMarkdown.matchAll(
    /\[\^([a-zA-Z0-9_-]+)\](?!:)/g,
  );
  for (const match of citationMatches) {
    const citationId = match[1];
    if (!definedRefIds.has(citationId)) {
      errors.push({
        file: filename,
        slug: post.frontmatter.slug,
        field: "references",
        message: `${tag}Footnote citation '[^${citationId}]' has no matching definition in @references.`,
      });
    }
  }

  return errors;
}

export function validateAllBlogPosts(
  posts: ParsedBlogPost[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  const seenSlugs = new Set<string>();

  for (const post of posts) {
    const postErrors = validateBlogPost(post);
    errors.push(...postErrors);

    if (post.frontmatter.slug) {
      if (seenSlugs.has(post.frontmatter.slug)) {
        errors.push({
          slug: post.frontmatter.slug,
          field: "slug",
          message: `Duplicate slug '${post.frontmatter.slug}' found across multiple blog posts.`,
        });
      }
      seenSlugs.add(post.frontmatter.slug);
    }
  }

  return errors;
}
