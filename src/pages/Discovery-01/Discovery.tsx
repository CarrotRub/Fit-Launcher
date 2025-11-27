import { createSignal, For, JSX, Suspense, createResource, lazy, createMemo } from 'solid-js';
import { appDataDir, join } from '@tauri-apps/api/path';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { commands, DiscoveryGame } from '../../bindings';
import LoadingPage from '../LoadingPage-01/LoadingPage';
import Button from '../../components/UI/Button/Button';
import { GamesCacheApi } from '../../api/cache/api';
import { LibraryApi } from '../../api/library/api';
import FilterBar from '../../components/FilterBar/FilterBar';
import { FilterState, DEFAULT_FILTER_STATE, SizeRange } from '../../types/filters';
import { getAllGenres, getSizeRange, filterGames } from '../../helpers/gameFilters';
const LazyGameObject = lazy(() => import("./Discovery-Components/GameObject"));

const gameCacheInst = new GamesCacheApi();
const libraryInst = new LibraryApi();

async function fetchDiscoveryGames(): Promise<{ games: DiscoveryGame[]; toDownloadLater: Set<string> }> {
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


function DiscoveryPage(): JSX.Element {
  const [currentPage, setCurrentPage] = createSignal(0);
  const [filters, setFilters] = createSignal<FilterState>(DEFAULT_FILTER_STATE);
  const [gamesResource] = createResource(fetchDiscoveryGames);

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

  // Paginate filtered games
  const visibleGames = createMemo(() => {
    const games = filteredGames();
    const start = currentPage() * 25;
    return games.slice(start, start + 25);
  });

  // Reset to first page when filters change
  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentPage(0);
  };

  const totalPages = createMemo(() => Math.ceil(filteredGames().length / 25));

  return (
    <Suspense fallback={<LoadingPage />}>
      <div class="sticky top-0 z-50 px-4 pt-8 bg-background/95 backdrop-blur-sm pb-4 border-b border-secondary-20/20 shadow-lg">
        <FilterBar
          availableGenres={availableGenres()}
          repackSizeRange={repackSizeRange()}
          originalSizeRange={originalSizeRange()}
          filters={filters()}
          onFilterChange={handleFilterChange}
        />

        {/* Results count - moved inside sticky header */}
        <div class="mt-2 px-1 text-sm text-muted">
          Showing {visibleGames().length} of {filteredGames().length} games
          {filters().genres.length > 0 && ` (filtered)`}
        </div>
      </div>
      <div class="relative flex flex-col bg-gradient-to-br from-background to-background-70 w-full grow overflow-y-auto no-scrollbar">
        {/* Filter Bar */}


        <div class="flex flex-col gap-4 p-4">
          <For each={visibleGames()}>
            {(game) => (
              <LazyGameObject
                gameItemObject={game}
                isToDownloadLater={gamesResource()?.toDownloadLater.has(game.game_title) ?? false}
              />
            )}
          </For>
        </div>
      </div>
      <div class="flex justify-center items-center gap-4 my-8">
        <Button label="Previous" disabled={currentPage() === 0} onClick={() => setCurrentPage(p => Math.max(p - 1, 0))} />

        <span class="text-text">Page {currentPage() + 1} of {totalPages()}</span>

        <Button label="Next" disabled={currentPage() + 1 >= totalPages()} onClick={() => {
          setCurrentPage(p => Math.min(p + 1, totalPages() - 1));
        }} />
      </div>
    </Suspense>
  );
}





export default DiscoveryPage;
