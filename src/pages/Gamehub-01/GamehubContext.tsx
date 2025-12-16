import { createContext, useContext, createSignal, createResource, createMemo, JSX, Accessor, onMount, onCleanup } from "solid-js";
import type { Game } from "../../bindings";
import { GamesCacheApi } from "../../api/cache/api";
import { FilterState, DEFAULT_FILTER_STATE, SizeRange } from "../../types/filters";
import { getAllGenres, getSizeRange, filterGames } from "../../helpers/gameFilters";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

const cache = new GamesCacheApi();

// Fetcher: loads all game categories in parallel
async function fetchAllGamehubData() {
  const [popular, newlyAdded, recentlyUpdated] = await Promise.all([
    cache.getPopularGames().then(r => r.status === "ok" ? cache.removeNSFW(r.data) : []),
    cache.getNewlyAddedGames().then(r => r.status === "ok" ? cache.removeNSFW(r.data) : []),
    cache.getRecentlyUpdatedGames().then(r => r.status === "ok" ? cache.removeNSFW(r.data) : []),
  ]);
  return { popular, newlyAdded, recentlyUpdated };
}

interface GamehubContextType {
  // Data
  popular: Accessor<Game[]>;
  newlyAdded: Accessor<Game[]>;
  recentlyUpdated: Accessor<Game[]>;
  loading: Accessor<boolean>;

  // Filters
  filters: Accessor<FilterState>;
  setFilters: (f: FilterState) => void;
  availableGenres: Accessor<string[]>;
  repackSizeRange: Accessor<SizeRange>;
  originalSizeRange: Accessor<SizeRange>;

  // Filtered data
  filteredNewlyAdded: Accessor<Game[]>;
  filteredRecentlyUpdated: Accessor<Game[]>;
}

const GamehubContext = createContext<GamehubContextType>();

const DEFAULT_SIZE_RANGE: SizeRange = { min: 0, max: 100 * 1024 * 1024 * 1024 };

export function GamehubProvider(props: { children: JSX.Element }) {
  const [data, { refetch }] = createResource(fetchAllGamehubData);
  const [filters, setFilters] = createSignal<FilterState>(DEFAULT_FILTER_STATE);

  onMount(() => {
    let unlisten: UnlistenFn | undefined;
    listen('backend-ready', () => {
      cache.clearCache();
      refetch();
    }).then(fn => { unlisten = fn; });

    onCleanup(() => { unlisten?.(); });
  });

  // Accessors for each category
  const popular = () => data()?.popular ?? [];
  const newlyAdded = () => data()?.newlyAdded ?? [];
  const recentlyUpdated = () => data()?.recentlyUpdated ?? [];
  const loading = () => data.loading;

  // Combine all games for filter metadata
  const allGames = createMemo(() => [...popular(), ...newlyAdded(), ...recentlyUpdated()]);

  // Derived: genres and size ranges from ALL games
  const availableGenres = createMemo(() => getAllGenres(allGames()));
  const repackSizeRange = createMemo(() => allGames().length > 0 ? getSizeRange(allGames(), 'repack') : DEFAULT_SIZE_RANGE);
  const originalSizeRange = createMemo(() => allGames().length > 0 ? getSizeRange(allGames(), 'original') : DEFAULT_SIZE_RANGE);

  // Filtered versions for display
  const filteredNewlyAdded = createMemo(() => filterGames(newlyAdded(), filters()));
  const filteredRecentlyUpdated = createMemo(() => filterGames(recentlyUpdated(), filters()));

  return (
    <GamehubContext.Provider value={{
      popular,
      newlyAdded,
      recentlyUpdated,
      loading,
      filters,
      setFilters,
      availableGenres,
      repackSizeRange,
      originalSizeRange,
      filteredNewlyAdded,
      filteredRecentlyUpdated,
    }}>
      {props.children}
    </GamehubContext.Provider>
  );
}

export function useGamehub() {
  const context = useContext(GamehubContext);
  if (!context) throw new Error("useGamehub must be used within GamehubProvider");
  return context;
}
