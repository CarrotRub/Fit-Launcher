import { Game, DiscoveryGame } from "../bindings";
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
 * Extract size from game description
 */
export function parseGameSize(
  description: string,
  type: "repack" | "original"
): number {
  if (!description) return 0;

  const label = type === "repack" ? "Repack Size" : "Original Size";
  const regex = new RegExp(`${label}:\\s*([^\\n]+)`, "i");
  const match = description.match(regex);

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
export function getAllGenres(games: (Game | DiscoveryGame)[]): string[] {
  const genresSet = new Set<string>();

  games.forEach((game) => {
    const tags = "tag" in game ? game.tag : game.game_tags;
    const genres = extractGenres(tags);
    genres.forEach((genre) => genresSet.add(genre));
  });

  return Array.from(genresSet).sort();
}

/**
 * Get size range (min/max) from a list of games
 */
export function getSizeRange(
  games: (Game | DiscoveryGame)[],
  type: "repack" | "original"
): SizeRange {
  let min = Infinity;
  let max = 0;

  games.forEach((game) => {
    const desc = "desc" in game ? game.desc : game.game_description;
    const size = parseGameSize(desc, type);

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
function matchesGenreFilter(
  game: Game | DiscoveryGame,
  selectedGenres: string[]
): boolean {
  if (selectedGenres.length === 0) return true;

  const tags = "tag" in game ? game.tag : game.game_tags;
  const gameGenres = extractGenres(tags);

  // Game matches if it has at least one of the selected genres
  return selectedGenres.some((genre) => gameGenres.includes(genre));
}

/**
 * Check if a game matches the size filter
 */
function matchesSizeFilter(
  game: Game | DiscoveryGame,
  range: SizeRange | null,
  type: "repack" | "original"
): boolean {
  if (!range) return true;

  const desc = "desc" in game ? game.desc : game.game_description;
  const size = parseGameSize(desc, type);

  // If size couldn't be parsed, include the game (don't filter it out)
  if (size === 0) return true;

  return size >= range.min && size <= range.max;
}

/**
 * Filter games based on filter state
 */
export function filterGames<T extends Game | DiscoveryGame>(
  games: T[],
  filters: FilterState
): T[] {
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
 * Check if any filters are active
 */
export function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.genres.length > 0 ||
    filters.repackSizeRange !== null ||
    filters.originalSizeRange !== null
  );
}

