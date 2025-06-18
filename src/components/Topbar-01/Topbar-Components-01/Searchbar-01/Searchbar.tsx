import { createSignal, createEffect, Show, onMount, For } from "solid-js";
import { appDataDir, join } from "@tauri-apps/api/path";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useNavigate } from "@solidjs/router";
import { setDownloadGamePageInfo } from "../../../functions/dataStoreGlobal";
import { Search, X, Sparkles } from "lucide-solid";

interface SearchbarProps {
  isTopBar?: boolean;
  setSearchValue?: (value: string) => void;
}

export default function Searchbar(props: SearchbarProps) {
  const isTopBar = props.isTopBar ?? true;
  const setSearchValue = props.setSearchValue;
  const navigate = isTopBar ? useNavigate() : undefined;

  const [clicked, setClicked] = createSignal(false);
  const [searchTerm, setSearchTerm] = createSignal("");
  const [searchResults, setSearchResults] = createSignal<string[]>([]);
  const [showDragonBallSVG, setShowDragonBallSVG] = createSignal(false);
  const [isFocused, setIsFocused] = createSignal(false);

  onMount(() => {
    const urlParameter = getUrlParameter("url");
    if (urlParameter !== "") {
      showResults(urlParameter);
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
  }

  createEffect(() => {
    setShowDragonBallSVG(searchTerm().toLowerCase().includes("dragon ball"));
  });

  async function showResults(query: string) {
    try {
      const requests = [];
      const dirPath = await appDataDir();

      for (let i = 1; i <= 6; i++) {
        const sitemapURL = await join(dirPath, "sitemaps", `post-sitemap${i}.xml`);
        const converted = convertFileSrc(sitemapURL);
        requests.push(fetch(converted));
      }

      const responses = await Promise.all(requests);
      const postURLs: string[] = [];

      for (const response of responses) {
        if (response.ok) {
          const text = await response.text();
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(text, "text/xml");
          const urls = xmlDoc.getElementsByTagName("url");

          for (const url of urls) {
            const loc = url.getElementsByTagName("loc")[0]?.textContent;
            if (loc) postURLs.push(loc);
          }
        } else {
          console.error("Failed to fetch sitemap:", response.statusText);
        }
      }

      const results = postURLs.filter((postURL) => {
        const title = getTitleFromUrl(postURL).toUpperCase().replace(/-/g, " ");
        return title.includes(query.toUpperCase().trim());
      });

      setSearchResults(results.slice(0, 5));
    } catch (err) {
      console.error("Failed to fetch sitemap data:", err);
    }
  }

  function capitalizeTitle(title: string): string {
    return title.replace(/-/g, " ").toUpperCase();
  }

  function getTitleFromUrl(url: string): string {
    const parts = url.split("/");
    return parts[3] || "";
  }

  function handleInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const value = target.value.toLowerCase();
    setSearchTerm(value);
    value ? showResults(value) : clearSearch();
  }

  async function handleGoToGamePage(href: string) {
    if (!clicked()) {
      setClicked(true);

      if (isTopBar && navigate) {
        const uuid = crypto.randomUUID();
        setDownloadGamePageInfo({
          gameTitle: "",
          gameHref: href,
          filePath: ""
        });
        window.location.href = `/game/${uuid}`;
        clearSearch();
      } else if (!isTopBar && setSearchValue) {
        setSearchTerm(capitalizeTitle(getTitleFromUrl(href)));
        setSearchResults([]);
        setSearchValue(href);
      }
    }
  }

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
          <Search size={20} class={`
            transition-all duration-300
            ${isFocused() ? 'text-accent scale-110' : ''}
          `} />
        </div>

        <input
          type="text"
          placeholder="Search Game..."
          value={searchTerm()}
          onInput={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autocomplete="off"
          class={`
            w-full py-3 pl-12 pr-10 bg-background
            text-text placeholder:text-muted/60
            focus:outline-none
          `}
        />

        <Show when={searchTerm().length > 0}>
          <button
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

      {/* Search Results */}
      <Show when={searchResults().length > 0}>
        <div class={`
          absolute z-50 mt-2 w-full
          bg-popup-background border border-secondary-20 rounded-xl
          shadow-lg overflow-hidden
          transition-all duration-300
          ${isFocused() ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}
        `}>
          <ul class="py-1 divide-y divide-secondary-20/30">
            <For each={searchResults()}>
              {(result) => (
                <li>
                  <button
                    onClick={() => handleGoToGamePage(result)}
                    class={`
                      w-full text-left px-4 py-3
                      text-sm text-text hover:bg-secondary-20/20
                      transition-colors duration-200
                      flex items-center gap-2
                    `}
                  >
                    <Search size={14} class="text-muted flex-shrink-0" />
                    <span class="truncate">{capitalizeTitle(getTitleFromUrl(result))}</span>
                  </button>
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>
    </div>
  );
}