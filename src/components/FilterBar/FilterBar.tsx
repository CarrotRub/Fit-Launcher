import { createSignal, createEffect, Show, JSX } from "solid-js";
import { Filter, X, RotateCcw, ChevronLeft, ChevronRight } from "lucide-solid";
import MultiSelectDropdown from "../UI/MultiSelectDropdown/MultiSelectDropdown";
import DualRangeSlider from "../UI/DualRangeSlider/DualRangeSlider";
import Button from "../UI/Button/Button";
import {
  FilterState,
  DEFAULT_FILTER_STATE,
  SizeRange,
} from "../../types/filters";
import {
  formatBytesToSize,
  hasActiveFilters,
} from "../../helpers/gameFilters";

export interface FilterBarProps {
  availableGenres: string[];
  repackSizeRange: SizeRange;
  originalSizeRange: SizeRange;
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  class?: string;
}

export default function FilterBar(props: FilterBarProps): JSX.Element {
  const [isExpanded, setIsExpanded] = createSignal(false);

  // Local state for slider values (in bytes)
  const [repackMin, setRepackMin] = createSignal(props.repackSizeRange.min);
  const [repackMax, setRepackMax] = createSignal(props.repackSizeRange.max);
  const [originalMin, setOriginalMin] = createSignal(props.originalSizeRange.min);
  const [originalMax, setOriginalMax] = createSignal(props.originalSizeRange.max);

  // Sync local state with props when ranges change
  createEffect(() => {
    if (!props.filters.repackSizeRange) {
      setRepackMin(props.repackSizeRange.min);
      setRepackMax(props.repackSizeRange.max);
    }
  });

  createEffect(() => {
    if (!props.filters.originalSizeRange) {
      setOriginalMin(props.originalSizeRange.min);
      setOriginalMax(props.originalSizeRange.max);
    }
  });

  const handleGenreChange = (genres: string[]) => {
    props.onFilterChange({
      ...props.filters,
      genres,
    });
  };

  const handleRepackSizeChange = (min: number, max: number) => {
    const isFullRange =
      min <= props.repackSizeRange.min && max >= props.repackSizeRange.max;

    props.onFilterChange({
      ...props.filters,
      repackSizeRange: isFullRange ? null : { min, max },
    });
  };

  const handleOriginalSizeChange = (min: number, max: number) => {
    const isFullRange =
      min <= props.originalSizeRange.min && max >= props.originalSizeRange.max;

    props.onFilterChange({
      ...props.filters,
      originalSizeRange: isFullRange ? null : { min, max },
    });
  };

  const clearFilters = () => {
    setRepackMin(props.repackSizeRange.min);
    setRepackMax(props.repackSizeRange.max);
    setOriginalMin(props.originalSizeRange.min);
    setOriginalMax(props.originalSizeRange.max);
    props.onFilterChange(DEFAULT_FILTER_STATE);
  };

  const activeFilterCount = () => {
    let count = 0;
    if (props.filters.genres.length > 0) count++;
    if (props.filters.repackSizeRange) count++;
    if (props.filters.originalSizeRange) count++;
    return count;
  };

  // Convert bytes to GB for slider step calculation
  const GB = 1024 * 1024 * 1024;
  const sliderStep = GB * 0.5; // 0.5 GB steps

  return (
    <div
      class={`
        relative bg-background-70/80 backdrop-blur-sm border border-secondary-20/50 
        rounded-xl overflow-visible transition-all duration-300 z-30
        ${props.class || ""}
      `}
    >
      {/* Filter Toggle Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded())}
        class="
          w-full flex items-center justify-between gap-3 px-4 py-3
          hover:bg-secondary-20/10 transition-colors cursor-pointer
        "
      >
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

          {/* Pagination Controls */}
          <div class="flex items-center gap-1 bg-secondary-20/20 rounded-lg p-1 mr-2" onClick={(e) => e.stopPropagation()}>
            <button
              disabled={props.currentPage === 1}
              onClick={() => props.onPageChange(props.currentPage - 1)}
              class="p-1 hover:bg-accent/10 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-muted hover:text-accent"
            >
              <ChevronLeft size={16} />
            </button>
            <span class="text-xs font-mono text-muted w-16 text-center select-none">
              {props.currentPage} / {Math.max(1, props.totalPages)}
            </span>
            <button
              disabled={props.currentPage >= props.totalPages}
              onClick={() => props.onPageChange(props.currentPage + 1)}
              class="p-1 hover:bg-accent/10 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-muted hover:text-accent"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <Show when={hasActiveFilters(props.filters)}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearFilters();
              }}
              class="
                flex items-center gap-1 px-2 py-1 text-xs
                text-muted hover:text-accent rounded-md
                hover:bg-accent/10 transition-colors
              "
            >
              <RotateCcw size={12} />
              Clear
            </button>
          </Show>
          <div
            class={`
              transition-transform duration-200
              ${isExpanded() ? "rotate-180" : ""}
            `}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              class="text-muted"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expandable Filter Content */}
      <Show when={isExpanded()}>
        <div class="px-4 pb-4 pt-2 border-t border-secondary-20/30">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Genres Filter */}
            <div class="space-y-2">
              <label class="text-sm font-medium text-muted flex items-center gap-2">
                Genres
                <Show when={props.filters.genres.length > 0}>
                  <span class="text-xs text-accent">
                    ({props.filters.genres.length})
                  </span>
                </Show>
              </label>
              <MultiSelectDropdown
                options={props.availableGenres}
                selected={props.filters.genres}
                onChange={handleGenreChange}
                placeholder="Select genres..."
              />
            </div>

            {/* Repack Size Filter */}
            <div class="space-y-2">
              <label class="text-sm font-medium text-muted">Repack Size</label>
              <DualRangeSlider
                min={props.repackSizeRange.min}
                max={props.repackSizeRange.max}
                minValue={repackMin()}
                maxValue={repackMax()}
                step={sliderStep}
                onMinChange={(val) => {
                  setRepackMin(val);
                  handleRepackSizeChange(val, repackMax());
                }}
                onMaxChange={(val) => {
                  setRepackMax(val);
                  handleRepackSizeChange(repackMin(), val);
                }}
                formatValue={formatBytesToSize}
              />
            </div>

            {/* Original Size Filter */}
            <div class="space-y-2">
              <label class="text-sm font-medium text-muted">Original Size</label>
              <DualRangeSlider
                min={props.originalSizeRange.min}
                max={props.originalSizeRange.max}
                minValue={originalMin()}
                maxValue={originalMax()}
                step={sliderStep}
                onMinChange={(val) => {
                  setOriginalMin(val);
                  handleOriginalSizeChange(val, originalMax());
                }}
                onMaxChange={(val) => {
                  setOriginalMax(val);
                  handleOriginalSizeChange(originalMin(), val);
                }}
                formatValue={formatBytesToSize}
              />
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

