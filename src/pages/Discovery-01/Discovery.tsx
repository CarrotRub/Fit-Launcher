import { createSignal, For, Suspense, createResource, lazy, createMemo, Show, onMount, onCleanup } from 'solid-js';
import type { Game } from '../../bindings';
import LoadingPage from '../LoadingPage-01/LoadingPage';
import { GamesCacheApi } from '../../api/cache/api';
import { LibraryApi } from '../../api/library/api';
import FilterBar from '../../components/FilterBar/FilterBar';
import { FilterState, DEFAULT_FILTER_STATE, SizeRange } from '../../types/filters';
import { getAllGenres, getSizeRange, filterGames } from '../../helpers/gameFilters';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

const LazyDiscoveryRow = lazy(() => import("./Discovery-Components/DiscoveryRow"));

const gameCacheInst = new GamesCacheApi();
const libraryInst = new LibraryApi();

const ITEMS_PER_PAGE = 10;
const DEFAULT_SIZE_RANGE: SizeRange = { min: 0, max: 100 * 1024 * 1024 * 1024 };

// Fetcher for createResource
async function fetchDiscoveryData() {
  const [resultGame, downloadLaterList] = await Promise.all([
    gameCacheInst.getDiscoveryGames(),
    libraryInst.getGamesToDownload()
  ]);

  const toDownloadLater = new Set(downloadLaterList.map(g => g.title));

  if (resultGame.status === "ok") {
    const games = await gameCacheInst.removeNSFW(resultGame.data);
    return { games, toDownloadLater };
  }
  return { games: [] as Game[], toDownloadLater };
}

export default function DiscoveryPage() {
  const [data, { refetch }] = createResource(fetchDiscoveryData);
  const [filters, setFilters] = createSignal<FilterState>(DEFAULT_FILTER_STATE);
  const [currentPage, setCurrentPage] = createSignal(1);
  const [scrollBehavior, setScrollBehavior] = createSignal<ScrollBehavior>('auto');

  onMount(() => {
    let unlisten: UnlistenFn | undefined;
    listen('discovery-ready', () => {
      gameCacheInst.clearCache('discovery');
      refetch();
    }).then(fn => { unlisten = fn; });

    // OS animation preference for scroll
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mapMotionToBehavior = (matches: boolean) => matches ? 'auto' : 'smooth';
    setScrollBehavior(mapMotionToBehavior(mediaQuery.matches));
    const mediaQueryScrollListener = (e: MediaQueryListEvent) => setScrollBehavior(mapMotionToBehavior(e.matches));
    mediaQuery.addEventListener('change', mediaQueryScrollListener);

    onCleanup(() => { unlisten?.(); mediaQuery.removeEventListener('change', mediaQueryScrollListener); });
  });

  // Derived state
  const games = () => data()?.games ?? [];
  const toDownloadLater = () => data()?.toDownloadLater ?? new Set<string>();

  const availableGenres = createMemo(() => getAllGenres(games()));
  const repackSizeRange = createMemo(() => games().length ? getSizeRange(games(), 'repack') : DEFAULT_SIZE_RANGE);
  const originalSizeRange = createMemo(() => games().length ? getSizeRange(games(), 'original') : DEFAULT_SIZE_RANGE);
  const scrollElement = createMemo(() => document.getElementById('scrollElement') as HTMLElement);
  const filteredGames = createMemo(() => filterGames(games(), filters()));
  const totalPages = createMemo(() => Math.ceil(filteredGames().length / ITEMS_PER_PAGE));
  const paginatedGames = createMemo(() => {
    const start = (currentPage() - 1) * ITEMS_PER_PAGE;
    return filteredGames().slice(start, start + ITEMS_PER_PAGE);
  });

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentPage(1);
    scrollElement().scrollTo({ top: 0, behavior: "instant" });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    scrollElement().scrollTo({ top: 0, behavior: scrollBehavior() })
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
        <div class="mt-2 px-1 text-sm text-muted">
          Showing {paginatedGames().length} of {filteredGames().length} games
          {filters().genres.length > 0 && ` (filtered)`}
        </div>
      </div>

      {/* Games Grid */}
      <div class="relative flex flex-col bg-gradient-to-br from-background to-background-70 w-full grow overflow-y-auto no-scrollbar">
        <div class="flex flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-[1920px] mx-auto w-full">
          <For each={paginatedGames()}>
            {(game) => (
              <LazyDiscoveryRow
                game={game}
                isFavorite={toDownloadLater().has(game.title)}
              />
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
