import { createContext, useContext, createSignal, JSX, Accessor, Setter } from "solid-js";
import { FilterState, DEFAULT_FILTER_STATE, SizeRange } from "../../types/filters";

type SetterOrUpdater<T> = Setter<T>;

interface GamehubContextType {
  filters: Accessor<FilterState>;
  setFilters: (filters: FilterState) => void;
  availableGenres: Accessor<string[]>;
  setAvailableGenres: SetterOrUpdater<string[]>;
  repackSizeRange: Accessor<SizeRange>;
  setRepackSizeRange: SetterOrUpdater<SizeRange>;
  originalSizeRange: Accessor<SizeRange>;
  setOriginalSizeRange: SetterOrUpdater<SizeRange>;
}

const GamehubContext = createContext<GamehubContextType>();

const DEFAULT_SIZE_RANGE: SizeRange = { min: 0, max: 100 * 1024 * 1024 * 1024 };

export function GamehubProvider(props: { children: JSX.Element }) {
  const [filters, setFilters] = createSignal<FilterState>(DEFAULT_FILTER_STATE);
  const [availableGenres, setAvailableGenres] = createSignal<string[]>([]);
  const [repackSizeRange, setRepackSizeRange] = createSignal<SizeRange>(DEFAULT_SIZE_RANGE);
  const [originalSizeRange, setOriginalSizeRange] = createSignal<SizeRange>(DEFAULT_SIZE_RANGE);

  return (
    <GamehubContext.Provider
      value={{
        filters,
        setFilters,
        availableGenres,
        setAvailableGenres,
        repackSizeRange,
        setRepackSizeRange,
        originalSizeRange,
        setOriginalSizeRange,
      }}
    >
      {props.children}
    </GamehubContext.Provider>
  );
}

export function useGamehubFilters() {
  const context = useContext(GamehubContext);
  if (!context) {
    throw new Error("useGamehubFilters must be used within a GamehubProvider");
  }
  return context;
}

