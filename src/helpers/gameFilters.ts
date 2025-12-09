import { Game } from "../bindings";
import { FilterState, SizeRange } from "../types/filters";

/**
 * Parse size string (e.g., "15.2 GB", "800 MB") to bytes
 */
export function parseSizeToBytes(sizeStr: string): number {
  if (!sizeStr || sizeStr === "N/A") return 0;

  const match = sizeStr.match(/([0-9.]+)\s*(B|KB|MB|GB|TB)/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  switch (unit) {
    case "B":
      return value;
    case "KB":
      return value * 1024;
    case "MB":
      return value * 1024 * 1024;
    case "GB":
      return value * 1024 * 1024 * 1024;
    case "TB":
      return value * 1024 * 1024 * 1024 * 1024;
    default:
      return 0;
  }
}

/**
 * Format bytes to human readable string
 */
export function formatBytesToSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);

  return `${value.toFixed(1)} ${units[i]}`;
}

/**
 * Extract size from game details
 */
export function parseGameSize(
  details: string,
  type: "repack" | "original"
): number {
  if (!details) return 0;

  const label = type === "repack" ? "Repack Size" : "Original Size";
  const regex = new RegExp(`${label}:\\s*([^\\n]+)`, "i");
  const match = details.match(regex);

  if (!match) return 0;

  return parseSizeToBytes(match[1].trim());
}

/**
 * Extract genres from tags string
 */
export function extractGenres(tags: string): string[] {
  if (!tags || tags === "N/A") return [];

  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

/**
 * Get all unique genres from a list of games
 */
export function getAllGenres(games: Game[]): string[] {
  const genresSet = new Set<string>();

  games.forEach((game) => {
    const genres = extractGenres(game.tag);
    genres.forEach((genre) => genresSet.add(genre));
  });

  return Array.from(genresSet).sort();
}

/**
 * Get size range (min/max) from a list of games
 */
export function getSizeRange(
  games: Game[],
  type: "repack" | "original"
): SizeRange {
  let min = Infinity;
  let max = 0;

  games.forEach((game) => {
    const size = parseGameSize(game.details, type);

    if (size > 0) {
      min = Math.min(min, size);
      max = Math.max(max, size);
    }
  });

  // Default range if no valid sizes found
  if (min === Infinity) min = 0;
  if (max === 0) max = 100 * 1024 * 1024 * 1024; // 100 GB default

  return { min, max };
}

/**
 * Check if a game matches the genre filter
 */
function matchesGenreFilter(game: Game, selectedGenres: string[]): boolean {
  if (selectedGenres.length === 0) return true;

  const gameGenres = extractGenres(game.tag);

  // Game matches if it has at least one of the selected genres
  return selectedGenres.some((genre) => gameGenres.includes(genre));
}

/**
 * Check if a game matches the size filter
 */
function matchesSizeFilter(
  game: Game,
  range: SizeRange | null,
  type: "repack" | "original"
): boolean {
  if (!range) return true;

  const size = parseGameSize(game.details, type);

  // If size couldn't be parsed, include the game (don't filter it out)
  if (size === 0) return true;

  return size >= range.min && size <= range.max;
}

/**
 * Filter games based on filter state
 */
export function filterGames(games: Game[], filters: FilterState): Game[] {
  return games.filter((game) => {
    const matchesGenre = matchesGenreFilter(game, filters.genres);
    const matchesRepackSize = matchesSizeFilter(
      game,
      filters.repackSizeRange,
      "repack"
    );
    const matchesOriginalSize = matchesSizeFilter(
      game,
      filters.originalSizeRange,
      "original"
    );

    return matchesGenre && matchesRepackSize && matchesOriginalSize;
  });
}

/**
 * Extract company/publisher from game details
 */
export function extractCompany(details: string): string {
  if (!details) return "N/A";
  const match = details.match(/(?:Companies|Company):\s*([^\n]+)/i);
  return match?.[1]?.trim() ?? "N/A";
}

/**
 * Extract language from game details
 */
export function extractLanguage(details: string): string {
  if (!details) return "N/A";
  const match = details.match(/(?:Languages|Language):\s*([^\n]+)/i);
  return match?.[1]?.trim() ?? "N/A";
}

/**
 * Check if any filters are active
 */
export function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.genres.length > 0 ||
    filters.repackSizeRange !== null ||
    filters.originalSizeRange !== null
  );
}
