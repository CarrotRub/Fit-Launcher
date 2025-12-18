export interface SizeRange {
  min: number;
  max: number;
}

export interface FilterState {
  genres: string[];
  repackSizeRange: SizeRange | null;
  originalSizeRange: SizeRange | null;
}

export const DEFAULT_FILTER_STATE: FilterState = {
  genres: [],
  originalSizeRange: null,
  repackSizeRange: null,
};

