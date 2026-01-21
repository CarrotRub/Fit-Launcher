import { LocationChange } from "@solidjs/router";

export type MemoryHistoryWrapper = {
  get: () => string;
  set: ({ replace, scroll, value }: LocationChange<unknown>) => void;
  back: () => void;
  forward: () => void;
  go: (n: number) => void;
  listen: (listener: (value: string) => void) => () => void;
};
