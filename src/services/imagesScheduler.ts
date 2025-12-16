import { commands, Result, CacheError } from "../bindings";

const cachedDownloadImage = commands.cachedDownloadImage;

const MAX_CONCURRENT = 12;

/**
 * Lower = sooner
 * 0   : visible
 * 100 : near viewport
 * 1000+ : far
 */
type PriorityScore = number;

type Task = {
  src: string;
  priority: PriorityScore;
  signal: AbortSignal;
  resolve: (v: Result<string, CacheError>) => void;
  reject: (e: any) => void;
};

let active = 0;

// Single queue, ordered by priority score
const queue: Task[] = [];

// Dedup by src (important)
const bySrc = new Map<string, Task>();

function sortQueue() {
  queue.sort((a, b) => a.priority - b.priority);
}

function runQueue() {
  if (active >= MAX_CONCURRENT) return;

  const task = queue.shift();
  if (!task) return;

  if (task.signal.aborted) {
    bySrc.delete(task.src);
    runQueue();
    return;
  }

  active++;
  console.debug(
    "[ImageQueue][RUN]",
    "active:",
    active,
    "task:",
    task.src,
    "priority:",
    task.priority,
    "queueLength:",
    queue.length
  );
  cachedDownloadImage(task.src)
    .then((v) => {
      if (!task.signal.aborted) task.resolve(v);
    })
    .catch((e) => {
      if (!task.signal.aborted) task.reject(e);
    })
    .finally(() => {
      active--;
      bySrc.delete(task.src);
      runQueue();
    });
}

export function queueImage(
  src: string,
  priority: PriorityScore,
  signal: AbortSignal
): Promise<Result<string, CacheError>> {
  // if alrdy queued : upgrade priority if needed
  const existing = bySrc.get(src);
  if (existing) {
    if (priority < existing.priority) {
      existing.priority = priority;
      sortQueue();
    }
    return new Promise((resolve, reject) => {
      // chain resolution
      const prevResolve = existing.resolve;
      const prevReject = existing.reject;

      existing.resolve = (v) => {
        prevResolve(v);
        resolve(v);
      };
      existing.reject = (e) => {
        prevReject(e);
        reject(e);
      };
    });
  }

  return new Promise((resolve, reject) => {
    const task: Task = {
      priority,
      reject,
      resolve,
      signal,
      src,
    };

    bySrc.set(src, task);
    queue.push(task);
    sortQueue();
    runQueue();
  });
}

// ---

type VisibilityCallback = (entry: IntersectionObserverEntry) => void;

const callbacks = new WeakMap<Element, VisibilityCallback>();

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      callbacks.get(entry.target)?.(entry);
    }
  },
  {
    rootMargin: "400px",
    threshold: 0.01,
  }
);

export function observeVisibility(el: Element, cb: VisibilityCallback) {
  callbacks.set(el, cb);
  observer.observe(el);

  return () => {
    callbacks.delete(el);
    observer.unobserve(el);
  };
}

/**
 * Converts intersection info into a priority score.
 * Visible images get priority ~0
 * Far images get larger numbers
 */
export function priorityFromEntry(
  entry: IntersectionObserverEntry
): PriorityScore {
  if (entry.isIntersecting) return 0;

  // Distance-based degradation
  const rect = entry.boundingClientRect;
  const viewportHeight = window.innerHeight;

  const distance =
    rect.top > viewportHeight ? rect.top - viewportHeight : -rect.bottom;

  return Math.min(2000, Math.abs(distance));
}
