import { marked } from "marked";
import DOMPurify from "dompurify";

export interface ChangelogEntry {
  version: string;
  date: string;
  body: string;
  url?: string;
}

export interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  body: string;
  html_url: string;
}

/**
 * Type priority for sorting (lower = higher priority)
 */
export const TYPE_PRIORITY: Record<string, number> = {
  feat: 1,
  fix: 2,
  refactor: 3,
  core: 4,
  perf: 5,
  docs: 6,
  style: 7,
  test: 8,
  chore: 9,
  ci: 10,
  build: 11,
};

/**
 * Extracts commit type from a line (e.g., "feat:", "fix:")
 */
function extractType(line: string): string | null {
  const match = line.match(
    /^[*\-]\s*(feat|fix|refactor|core|perf|docs|style|test|chore|ci|build):/i
  );
  return match ? match[1].toLowerCase() : null;
}

function sortChangelogItems(body: string): string {
  const lines = body.split("\n");
  const sections: string[][] = [];
  let currentSection: string[] = [];
  let inListSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const isListItem = trimmed.startsWith("*") || trimmed.startsWith("-");

    if (isListItem) {
      if (!inListSection) {
        // Starting a new list section
        if (currentSection.length > 0) {
          sections.push(currentSection);
          currentSection = [];
        }
        inListSection = true;
      }
      currentSection.push(line);
    } else {
      if (inListSection) {
        const items = currentSection.map((l) => ({
          line: l,
          type: extractType(l.trim()),
          priority: (() => {
            const t = extractType(l.trim());
            return t ? TYPE_PRIORITY[t] ?? 999 : 999;
          })(),
        }));
        items.sort((a, b) => a.priority - b.priority);
        sections.push(items.map((i) => i.line));
        currentSection = [];
        inListSection = false;
      }
      currentSection.push(line);
    }
  }

  if (currentSection.length > 0) {
    if (inListSection) {
      const items = currentSection.map((l) => ({
        line: l,
        type: extractType(l.trim()),
        priority: (() => {
          const t = extractType(l.trim());
          return t ? TYPE_PRIORITY[t] ?? 999 : 999;
        })(),
      }));
      items.sort((a, b) => a.priority - b.priority);
      sections.push(items.map((i) => i.line));
    } else {
      sections.push(currentSection);
    }
  }

  return sections.flat().join("\n");
}

/**
 * Cleans GitHub release body (removes junk, comments, unwanted sections)
 */
function cleanReleaseBody(body: string): string {
  if (!body) return "No changes documented.";

  let cleaned = body
    // Remove zero-width & BOM characters (all occurrences)
    .replace(/[\u200B\u200C\u200D\u200E\u200F\uFEFF]/g, "")
    // Remove GitHub auto-generated "See assets" lines
    .replace(/See the assets to download[^.\n]*\./gi, "")
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, "")
    // Normalize windows CRLF → LF
    .replace(/\r\n/g, "\n")
    // Trim excessive blank lines (2+ → 1)
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  cleaned = sortChangelogItems(cleaned);

  return cleaned;
}

/**
 * Converts cleaned markdown to sanitized HTML
 */
async function convertMarkdownToHtml(md: string): Promise<string> {
  const html = await marked.parse(md);

  return DOMPurify.sanitize(html);
}

export async function fetchLatestGithubRelease(
  owner: string,
  repo: string
): Promise<ChangelogEntry[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  const release: GitHubRelease = await res.json();
  const cleaned = cleanReleaseBody(release.body);
  const sanitizedHtml = await convertMarkdownToHtml(cleaned);

  return [
    {
      version: release.tag_name || release.name || "Unknown",
      date: new Date(release.published_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      body: sanitizedHtml,
      url: release.html_url,
    },
  ];
}

/**
 * Fetches N GitHub releases (paginated)
 */
export async function fetchAllGithubReleases(
  owner: string,
  repo: string,
  limit: number = 10
): Promise<ChangelogEntry[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=${limit}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  const releases: GitHubRelease[] = await res.json();

  return Promise.all(
    releases.map(async (r) => {
      const cleaned = cleanReleaseBody(r.body);
      const sanitizedHtml = await convertMarkdownToHtml(cleaned);
      return {
        version: r.tag_name || r.name || "Unknown",
        date: new Date(r.published_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        body: sanitizedHtml,
        url: r.html_url,
      };
    })
  );
}
