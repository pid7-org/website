# Repository Instructions — pid7

**pid7** is a minimalist developer blog & portfolio built with Astro (v7 static), Tailwind CSS v4, Catppuccin themes, and Vitest.

---

## 1. Core Workflow Commands

- `npm run dev` — Launch local development server
- `npm run build` — Build static site to `dist/`
- `npm test` — Run Vitest unit test suite

---

## 2. Tech Stack & Styling Architecture

- **Framework**: Astro (`output: 'static'`).
- **Styling**: Tailwind CSS v4 + `@catppuccin/tailwindcss` + `@tailwindcss/typography`.
  - **Themes**: Dark (Catppuccin Macchiato, default) / Light (Catppuccin Latte).
  - **Accents**: `--color-accent` (`peach`, default / `mono`, `yellow`, `mauve`, `blue`, `green`).
  - **Theme Background**: Body background uses clean theme base color (`var(--color-ctp-base)`) without accent tinting.
- **Fonts**:
  - Logo/Header: `Clash Grotesk` (`var(--font-clash)`)
  - Headings: `Space Grotesk` (`var(--font-serif)`)
  - Body/Code/UI: `JetBrains Mono` (`var(--font-mono)`)
- **Layout**: Constrained width `max-w-screen-md` (`max-w-3xl`), centered with `mx-auto px-6`.

---

## 3. Blog Markdown Dialect (`src/lib/parser/`)

Blog articles in `src/content/blog/*.md` are parsed by a custom engine ([src/lib/parser/index.ts](file:///home/adii/pid7/src/lib/parser/index.ts)):

- **Frontmatter**:
  ```yaml
  ---
  slug: post-slug
  title: Post Title
  created: DD-MM-YYYY
  last-updated: DD-MM-YYYY
  description: SEO description summary
  tags: Tag-One, Tag-Two  # Hyphens auto-converted to spaces ('Tag One')
  ---
  ```
- **Custom Code Blocks**: `<> ... </>` (angle) or `~ ... ~` (tilde).
  - Add optional caption line `@desc Caption text` inside the block before closing.
  - Automatically highlights using Shiki (`catppuccin-macchiato` / `catppuccin-latte`) with copy buttons.
- **Interactive Animations**: `{@anim (001) Description}` or `{ANIM001: Description}` rendering dynamic widget placeholders.
- **Callouts**: `> [!INFO]`, `> [!TIP]`, `> [!NOTE]`, `> [!WARNING]`, `> [!CAUTION]`.
- **LaTeX Math (KaTeX)**: Display `$$ ... $$` and Inline `$ ... $`.
- **Glossary & References**:
  - `@glossary` section using `* TERM: Definition` list items.
  - `@references` section using `[^1]: Citation text`.

---

## 4. Code & Commit Conventions

- **Code Comments**: High-value architectural rationale only. Standard alert markers: `NOTE:`, `IMPORTANT:`, `WARN:`, `ALERT:`.
- **Git Commits**: Imperative mood, ~50 chars. Prefixes: `feat:`, `fix:`, `style:`, `refactor:`, `anim:`, `content:`, `setup:`, `docs:`.
