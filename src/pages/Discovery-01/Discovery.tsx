import { createSignal, For, JSX, Suspense, createResource, lazy, createMemo, createEffect, Show } from 'solid-js';
import { appDataDir, join } from '@tauri-apps/api/path';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { commands, Game } from '../../bindings';
import LoadingPage from '../LoadingPage-01/LoadingPage';
// Button no longer needed for pagination
import { GamesCacheApi } from '../../api/cache/api';
import { LibraryApi } from '../../api/library/api';
import FilterBar from '../../components/FilterBar/FilterBar';
import { FilterState, DEFAULT_FILTER_STATE, SizeRange } from '../../types/filters';
import { getAllGenres, getSizeRange, filterGames } from '../../helpers/gameFilters';
const LazyDiscoveryRow = lazy(() => import("./Discovery-Components/DiscoveryRow"));

const gameCacheInst = new GamesCacheApi();
const libraryInst = new LibraryApi();

async function fetchDiscoveryGames(): Promise<{ games: Game[]; toDownloadLater: Set<string> }> {
  try {
    const resultGame = await gameCacheInst.getDiscoveryGames();
    const downloadLaterList = await libraryInst.getGamesToDownload();
    const toDownloadLater = new Set(downloadLaterList.map(g => g.title));

    if (resultGame.status === "ok") {
      const filteredGames = await gameCacheInst.removeNSFW(resultGame.data);
      return { games: filteredGames, toDownloadLater };
    } else {
      console.warn("Failed to get discovery games from cache.");
      return { games: [], toDownloadLater };
    }
  } catch (error) {
    console.error("Error fetching discovery games:", error);
    throw error;
  }
}


const ITEMS_PER_PAGE = 10;

function DiscoveryPage(): JSX.Element {
  const [filters, setFilters] = createSignal<FilterState>(DEFAULT_FILTER_STATE);
  const [gamesResource] = createResource(fetchDiscoveryGames);
  const [currentPage, setCurrentPage] = createSignal(1);

  // Extract available genres from all games
  const availableGenres = createMemo(() => {
    const data = gamesResource();
    if (!data) return [];
    return getAllGenres(data.games);
  });

  // Calculate size ranges from all games
  const repackSizeRange = createMemo((): SizeRange => {
    const data = gamesResource();
    if (!data) return { min: 0, max: 100 * 1024 * 1024 * 1024 };
    return getSizeRange(data.games, 'repack');
  });

  const originalSizeRange = createMemo((): SizeRange => {
    const data = gamesResource();
    if (!data) return { min: 0, max: 100 * 1024 * 1024 * 1024 };
    return getSizeRange(data.games, 'original');
  });

  // Apply filters to games
  const filteredGames = createMemo(() => {
    const data = gamesResource();
    if (!data) return [];
    return filterGames(data.games, filters());
  });

  // Calculate pagination
  const totalPages = createMemo(() => Math.ceil(filteredGames().length / ITEMS_PER_PAGE));

  const paginatedGames = createMemo(() => {
    const start = (currentPage() - 1) * ITEMS_PER_PAGE;
    return filteredGames().slice(start, start + ITEMS_PER_PAGE);
  });

  // Reset pagination when filters change
  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentPage(1);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Suspense fallback={<LoadingPage />}>
      {/* Sticky Header */}
      <div class="sticky top-0 z-50 px-4 pt-8 bg-background/95 backdrop-blur-sm pb-4 border-b border-secondary-20/20 shadow-lg">
        <FilterBar
          availableGenres={availableGenres()}
          repackSizeRange={repackSizeRange()}
          originalSizeRange={originalSizeRange()}
          filters={filters()}
          onFilterChange={handleFilterChange}
          currentPage={currentPage()}
          totalPages={totalPages()}
          onPageChange={handlePageChange}
        />

        {/* Results count */}
        <div class="mt-2 px-1 text-sm text-muted">
          Showing {paginatedGames().length} of {filteredGames().length} games
          {filters().genres.length > 0 && ` (filtered)`}
        </div>
      </div>

      {/* Grid Container - No Virtualization */}
      <div class="relative flex flex-col bg-gradient-to-br from-background to-background-70 w-full grow overflow-y-auto no-scrollbar">
        <div class="flex flex-col gap-4 p-4 md:p-6 lg:p-8 max-w-[1920px] mx-auto w-full">
          <For each={paginatedGames()}>
            {(game) => (
              <div class="w-full">
                <LazyDiscoveryRow
                  gameItemObject={game}
                  preloadedDownloadLater={gamesResource()?.toDownloadLater.has(game.title) ?? false}
                />
              </div>
            )}
          </For>

          <Show when={paginatedGames().length === 0}>
            <div class="flex flex-col items-center justify-center py-20 text-muted">
              <p>No games found matching your criteria</p>
            </div>
          </Show>
        </div>
      </div>
    </Suspense>
  );
}





export default DiscoveryPage;
