import { createSignal, createMemo, Show, JSX, createComputed } from "solid-js";
import { Filter, RotateCcw, ChevronLeft, ChevronRight, ChevronDown } from "lucide-solid";
import MultiSelectDropdown from "../UI/MultiSelectDropdown/MultiSelectDropdown";
import DualRangeSlider from "../UI/DualRangeSlider/DualRangeSlider";
import { FilterState, DEFAULT_FILTER_STATE, SizeRange } from "../../types/filters";
import { formatBytesToSize, hasActiveFilters } from "../../helpers/gameFilters";

export interface FilterBarProps {
  availableGenres: string[];
  repackSizeRange: SizeRange;
  originalSizeRange: SizeRange;
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  class?: string;
}

const GB = 1024 * 1024 * 1024;
const SLIDER_STEP = GB * 0.5;

export default function FilterBar(props: FilterBarProps) {
  const [isExpanded, setIsExpanded] = createSignal(false);

  // Local slider state
  const [repackMin, setRepackMin] = createSignal(props.repackSizeRange.min);
  const [repackMax, setRepackMax] = createSignal(props.repackSizeRange.max);
  const [originalMin, setOriginalMin] = createSignal(props.originalSizeRange.min);
  const [originalMax, setOriginalMax] = createSignal(props.originalSizeRange.max);

  // Sync local state with filter reset
  createComputed(() => {
    const repack = props.filters.repackSizeRange;
    if (!repack) {
      setRepackMin(props.repackSizeRange.min);
      setRepackMax(props.repackSizeRange.max);
    }
  });

  createComputed(() => {
    const original = props.filters.originalSizeRange;
    if (!original) {
      setOriginalMin(props.originalSizeRange.min);
      setOriginalMax(props.originalSizeRange.max);
    }
  });

  // Derived
  const activeFilterCount = createMemo(() => {
    const f = props.filters;
    return (
      (f.genres.length > 0 ? 1 : 0) +
      (f.repackSizeRange ? 1 : 0) +
      (f.originalSizeRange ? 1 : 0)
    );
  });

  const hasPagination = createMemo(() => props.currentPage !== undefined && props.totalPages !== undefined);

  // Handlers
  const updateFilters = (patch: Partial<FilterState>) => props.onFilterChange({ ...props.filters, ...patch });

  const handleRepackChange = (min: number, max: number) => {
    const isFullRange = min <= props.repackSizeRange.min && max >= props.repackSizeRange.max;
    updateFilters({ repackSizeRange: isFullRange ? null : { min, max } });
  };

  const handleOriginalChange = (min: number, max: number) => {
    const isFullRange = min <= props.originalSizeRange.min && max >= props.originalSizeRange.max;
    updateFilters({ originalSizeRange: isFullRange ? null : { min, max } });
  };

  const commitRepack = () =>
    handleRepackChange(repackMin(), repackMax());

  const commitOriginal = () =>
    handleOriginalChange(originalMin(), originalMax());

  const clearFilters = () => {
    setRepackMin(props.repackSizeRange.min);
    setRepackMax(props.repackSizeRange.max);
    setOriginalMin(props.originalSizeRange.min);
    setOriginalMax(props.originalSizeRange.max);
    props.onFilterChange(DEFAULT_FILTER_STATE);
  };

  return (
    <div class={`relative bg-background-70/80 backdrop-blur-sm border border-secondary-20/50 rounded-xl overflow-visible transition-all duration-300 z-30 ${props.class || ""}`}>
      {/* Header */}
      <div onClick={() => setIsExpanded(!isExpanded())} class="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-secondary-20/10 transition-colors cursor-pointer">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-accent/10 rounded-lg">
            <Filter size={18} class="text-accent" />
          </div>
          <span class="font-medium text-text">Filters</span>
          <Show when={activeFilterCount() > 0}>
            <span class="px-2 py-0.5 text-xs font-medium rounded-full bg-accent text-background">
              {activeFilterCount()}
            </span>
          </Show>
        </div>

        <div class="flex items-center gap-3">
          {/* Pagination (optional) */}
          <Show when={hasPagination()}>
            {props.currentPage && props.totalPages && props.onPageChange && (
              <Pagination
                current={props.currentPage}
                total={props.totalPages}
                onChange={props.onPageChange}
              />
            )}
          </Show>

          <Show when={hasActiveFilters(props.filters)}>
            <button onClick={(e) => { e.stopPropagation(); clearFilters(); }} class="flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-accent rounded-md hover:bg-accent/10 transition-colors">
              <RotateCcw size={12} />
              Clear
            </button>
          </Show>

          <ChevronDown size={16} class={`text-muted transition-transform duration-200 ${isExpanded() ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Expandable Content */}
      <Show when={isExpanded()}>
        <div class="px-4 pb-4 pt-2 border-t border-secondary-20/30">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Genres */}
            <FilterSection label="Genres" count={props.filters.genres.length}>
              <MultiSelectDropdown
                options={props.availableGenres}
                selected={props.filters.genres}
                onChange={(genres) => updateFilters({ genres })}
                placeholder="Select genres..."
              />
            </FilterSection>

            {/* Repack Size */}
            <FilterSection label="Repack Size">
              <DualRangeSlider
                min={props.repackSizeRange.min}
                max={props.repackSizeRange.max}
                minValue={repackMin()}
                maxValue={repackMax()}
                step={SLIDER_STEP}
                onMinChange={setRepackMin}
                onMaxChange={setRepackMax}
                onChangeComplete={commitRepack}
                formatValue={formatBytesToSize}
              />
            </FilterSection>

            {/* Original Size */}
            <FilterSection label="Original Size">
              <DualRangeSlider
                min={props.originalSizeRange.min}
                max={props.originalSizeRange.max}
                minValue={originalMin()}
                maxValue={originalMax()}
                step={SLIDER_STEP}
                onMinChange={setOriginalMin}
                onMaxChange={setOriginalMax}
                onChangeComplete={commitOriginal}
                formatValue={formatBytesToSize}
              />
            </FilterSection>
          </div>
        </div>
      </Show>
    </div>
  );
}

// --- Helper Components ---

const Pagination = (props: { current: number; total: number; onChange: (page: number) => void }) => (
  <div class="flex items-center gap-1 bg-secondary-20/20 rounded-lg p-1 mr-2" onClick={(e) => e.stopPropagation()}>
    <button
      disabled={props.current === 1}
      onClick={() => props.onChange(props.current - 1)}
      class="p-1 hover:bg-accent/10 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-muted hover:text-accent"
    >
      <ChevronLeft size={16} />
    </button>
    <span class="text-xs font-mono text-muted w-16 text-center select-none">
      {props.current} / {Math.max(1, props.total)}
    </span>
    <button
      disabled={props.current >= props.total}
      onClick={() => props.onChange(props.current + 1)}
      class="p-1 hover:bg-accent/10 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-muted hover:text-accent"
    >
      <ChevronRight size={16} />
    </button>
  </div>
);

const FilterSection = (props: { label: string; count?: number; children: JSX.Element }) => (
  <div class="space-y-2">
    <label class="text-sm font-medium text-muted flex items-center gap-2">
      {props.label}
      <Show when={props.count && props.count > 0}>
        <span class="text-xs text-accent">({props.count})</span>
      </Show>
    </label>
    {props.children}
  </div>
);
