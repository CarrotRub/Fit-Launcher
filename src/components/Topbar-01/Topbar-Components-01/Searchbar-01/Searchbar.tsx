import { createSignal, createEffect, Show, onMount, For, onCleanup } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Search, X, Sparkles, Loader2 } from "lucide-solid";
import { commands } from "../../../../bindings";
import { listen } from "@tauri-apps/api/event";

interface SearchbarProps {
  isTopBar?: boolean;
  setSearchValue?: (value: string) => void;
  class?: string;
}

interface SearchIndexEntry {
  slug: string;
  title: string;
  href: string;
}

export default function Searchbar(props: SearchbarProps) {
  const isTopBar = props.isTopBar ?? true;
  const setSearchValue = props.setSearchValue;
  const navigate = isTopBar ? useNavigate() : undefined;

  const [clicked, setClicked] = createSignal(false);
  const [searchTerm, setSearchTerm] = createSignal("");
  const [searchResults, setSearchResults] = createSignal<SearchIndexEntry[]>([]);
  const [indexLoading, setIndexLoading] = createSignal(false);
  const [indexError, setIndexError] = createSignal<string | null>(null);
  const [showDragonBallSVG, setShowDragonBallSVG] = createSignal(false);
  const [isFocused, setIsFocused] = createSignal(false);
  const [highlightedIndex, setHighlightedIndex] = createSignal(-1);
  let debounceTimer: number | undefined;
  let readyUnlisten: (() => void) | undefined;
  let errorUnlisten: (() => void) | undefined;

  onMount(async () => {
    // Check if URL has a search parameter
    const urlParameter = getUrlParameter("url");
    if (urlParameter !== "") {
      setSearchTerm(urlParameter);
      filterResults(urlParameter);
    }

    // Listen for index rebuild events to clear any cached errors
    readyUnlisten = await listen("search-index-ready", () => {
      setIndexError(null);
    });

    errorUnlisten = await listen<string>("search-index-error", (event) => {
      setIndexError(event.payload || "Search index error");
    });
  });

  onCleanup(() => {
    readyUnlisten?.();
    errorUnlisten?.();
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
    }
  });

  function getUrlParameter(name: string): string {
    const regex = new RegExp("[\\?&]" + name + "=([^&#]*)");
    const results = regex.exec(window.location.search);
    return results ? decodeURIComponent(results[1].replace(/\+/g, " ")) : "";
  }

  function clearSearch() {
    setSearchTerm("");
    setSearchResults([]);
    setClicked(false);
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
    }
  }

  createEffect(() => {
    setShowDragonBallSVG(searchTerm().toLowerCase().includes("dragon ball"));
  });

  async function filterResults(query: string) {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIndexLoading(true);
    try {
      const result = await commands.querySearchIndex(query);
      if (result.status === "ok") {
        setSearchResults(result.data);
        setIndexError(null);
      } else {
        console.error("Search query failed:", result.error);
        setSearchResults([]);
        // Only show error if it's not a "database not found" (index still building)
        if (!String(result.error).includes("not found")) {
          setIndexError("Search failed");
        }
      }
    } catch (err) {
      console.error("Search error:", err);
      setSearchResults([]);
    } finally {
      setIndexLoading(false);
    }
  }

  function handleInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const value = target.value;
    setSearchTerm(value);

    // Clear previous debounce timer
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
    }

    if (!value.trim()) {
      clearSearch();
      return;
    }

    // Debounce the search
    debounceTimer = window.setTimeout(() => {
      filterResults(value);
    }, 150);
  }

  async function handleGoToGamePage(entry: SearchIndexEntry) {
    if (!clicked()) {
      setClicked(true);

      if (isTopBar && navigate) {
        const uuid = await commands.hashUrl(entry.href);
        navigate(`/game/${uuid}`, {
          state: { gameHref: entry.href, gameTitle: entry.title, filePath: "" }
        });
        clearSearch();
      } else if (!isTopBar && setSearchValue) {
        setSearchTerm(entry.title);
        setSearchResults([]);
        setSearchValue(entry.href);
        setClicked(false);
      }
    }
  }

  createEffect(() => {
    searchTerm();
    setHighlightedIndex(-1);
  });


  return (
    <div class="relative w-full max-w-sm mx-auto">
      {/* Search Bar */}
      <div class={`
        relative flex items-center
        border rounded-full overflow-hidden
        transition-all duration-300
        ${isFocused() ?
          'border-accent ring-1 ring-accent/20' :
          'border-secondary-20 hover:border-accent/50'}
      `}>
        <div class="absolute left-4 text-muted">
          <Show when={!indexLoading()} fallback={
            <Loader2 size={20} class="animate-spin" />
          }>
            <Search size={20} class={`
              transition-all duration-300
              ${isFocused() ? 'text-accent scale-110' : ''}
            `} />
          </Show>
        </div>

        <input
          type="text"
          placeholder="Search Game..."
          value={searchTerm()}
          onInput={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          tabIndex={1}
          autocomplete="off"
          onKeyDown={(e) => {
            const results = searchResults();
            const index = highlightedIndex();

            if (e.key === "Tab") {
              e.preventDefault();
              const targetIndex = index >= 0 ? index : 0;
              if (results[targetIndex]) {
                handleGoToGamePage(results[targetIndex]);
              }
            }

            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlightedIndex((prev) => Math.min(prev + 1, results.length - 1));
            }

            if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlightedIndex((prev) => Math.max(prev - 1, 0));
            }

            if (e.key === "Enter") {
              e.preventDefault();
              const targetIndex = index >= 0 ? index : 0;
              if (results[targetIndex]) {
                handleGoToGamePage(results[targetIndex]);
              }
            }
          }}
          class={`
    w-full py-3 pl-12 pr-10 bg-background
    text-text placeholder:text-muted/60
    focus:outline-none
  `}
        />


        <Show when={searchTerm().length > 0}>
          <button
            tabIndex={-1}
            onClick={clearSearch}
            class={`
              absolute right-3 p-1 rounded-full
              text-muted hover:text-accent
              transition-all duration-200
            `}
          >
            <X size={18} />
          </button>
        </Show>

        <Show when={showDragonBallSVG()}>
          <div class="absolute right-10 animate-pulse">
            <Sparkles size={18} class="text-accent" />
          </div>
        </Show>
      </div>

      {/* Error Message */}
      <Show when={indexError() !== null && !indexLoading()}>
        <div class="absolute z-80 mt-2 w-full bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">
          Search index unavailable: {indexError()}
        </div>
      </Show>

      {/* Search Results */}
      <Show when={searchResults().length > 0 && !indexLoading()}>
        <div class={`
          absolute z-80 mt-2 w-full
          max-h-60 overflow-y-auto
          bg-popup-background border border-secondary-20 rounded-xl
          shadow-lg no-scrollbar
          transition-all duration-300
          ${isFocused() ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}
        `}>
          <ul class="py-1 divide-y divide-secondary-20/30">
            <For each={searchResults()}>
              {(result, index) => {
                let itemRef: HTMLButtonElement | undefined;

                createEffect(() => {
                  if (index() === highlightedIndex() && itemRef) {
                    itemRef.scrollIntoView({ block: "nearest" });
                  }
                });

                return (
                  <li>
                    <button
                      ref={itemRef}
                      onClick={() => handleGoToGamePage(result)}
                      class={`
                        w-full text-left px-4 py-3
                        text-sm text-text transition-colors duration-200
                        flex items-center gap-2
                        ${index() === highlightedIndex()
                          ? 'bg-secondary-20/30 text-accent'
                          : 'hover:bg-secondary-20/20'}
                      `}
                    >
                      <Search size={14} class="text-muted flex-shrink-0" />
                      <span class="truncate">{result.title}</span>
                    </button>
                  </li>
                );
              }}
            </For>
          </ul>
        </div>
      </Show>
    </div>
  );
}