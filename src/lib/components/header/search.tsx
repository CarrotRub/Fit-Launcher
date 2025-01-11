import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import { default as SearchIcon } from "lucide-solid/icons/search";
import {
 type Setter,
 createEffect,
 createSignal,
 For,
 onMount,
 Show,
} from "solid-js";
import { setDownloadGamePageInfo } from "../../store/global.store";
import "./search.css";

interface SearchProps {
 isHeader?: boolean;
 setSearch: Setter<string>;
}

export function Search({ isHeader = true, setSearch }: SearchProps) {
 const [clicked, setClicked] = createSignal(false);
 const [searchTerm, setSearchTerm] = createSignal<string>("");
 const [searchResults, setSearchResults] = createSignal<string[]>([]);
 const [searchUUID, setSearchUUID] = createSignal<string | null>(null);

 onMount(() => {
  const urlParameter = getUrlParameter("url");

  if (urlParameter) {
   showResults(urlParameter);
  }

  const uuid = crypto.randomUUID();

  setSearchUUID(uuid);
 });

 function getUrlParameter(name: string) {
  name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
  let regex = new RegExp("[\\?&]" + name + "=([^&#]*)");
  let results = regex.exec(window.location.search);
  return results ? decodeURIComponent(results[1].replace(/\+/g, " ")) : "";
 }

 function clearSearch() {
  setSearchResults([]);
 }

 createEffect(() => {
  if (!searchTerm()) {
   let searchResultsDiv = document.getElementById("search-results");
   if (searchResultsDiv) {
    searchResultsDiv.style.display = "none";
   }
  } else {
   let searchResultsDiv = document.getElementById("search-results");
   if (searchResultsDiv) {
    searchResultsDiv.style.display = "flex";
   }
  }
 });

 async function showResults(search: string) {
  let requests = [];
  const appDir = await appDataDir();
  const dirPath = appDir;

  for (let i = 1; i <= 6; i++) {
   // let sitemapURL = `${dirPath}sitemaps/post-sitemap${i}.xml`;
   let sitemapURL = await join(dirPath, "sitemaps", `post-sitemap${i}.xml`);
   let convertedSitemapURL = convertFileSrc(sitemapURL);
   requests.push(fetch(convertedSitemapURL));
  }

  try {
   let responses = await Promise.all(requests);
   let postUrls: string[] = [];

   for (let response of responses) {
    if (response.ok) {
     let text = await response.text();
     let parser = new DOMParser();
     let xmlDoc = parser.parseFromString(text, "text/xml");
     let urls = xmlDoc.getElementsByTagName("url");

     for (let url of urls) {
      let loc = url.getElementsByTagName("loc")[0].textContent;
      postUrls.push(loc!);
     }
    } else {
     console.error("Failed to fetch sitemap:", response.statusText);
    }
   }

   let results = postUrls.filter((url: string) => {
    let title = getTitleFromUrl(url!).toUpperCase().replace(/-/g, " ");
    return title.includes(search.toUpperCase().trim());
   });

   setSearchResults(results.slice(0, 5));
  } catch (error) {
   console.error("Failed to fetch sitemap data:", error);
  }
 }

 function normalizeTitle(title: string) {
  return title.replace(/-/g, " ").toUpperCase();
 }

 function getTitleFromUrl(url: string) {
  var parts = url.split("/");
  var title = parts[3];
  return title;
 }

 return (
  <div class="search-container" id={`search-container-${searchUUID()}`}>
   <div class="search-bar">
    {/* Your search icon, etc. */}
    <SearchIcon />

    <input
     id="search-input"
     type="text"
     placeholder="Search Game"
     value={searchTerm()}
     oninput={event => {
      const value = event.target.value.toLowerCase();

      setSearchTerm(value);

      if (value) {
       showResults(value);
      } else {
       clearSearch();
      }
     }}
     autocomplete="off"
    />
   </div>

   <Show when={searchResults().length > 0}>
    <ul id="search-results">
     <For each={searchResults()}>
      {href => (
       <li
        role="button"
        onclick={() => {
         if (!clicked() && isHeader) {
          console.log(href);
          setClicked(true);

          const uuid = crypto.randomUUID();

          setDownloadGamePageInfo({
           gameTitle: "",
           gameHref: href,
           filePath: "",
          });

          window.location.href = `/game/${uuid}`;
          clearSearch();
         } else if (!isHeader) {
          setSearchTerm(normalizeTitle(getTitleFromUrl(href)));
          setSearchResults([]);
          setSearch(href);
         }
        }}
       >
        {normalizeTitle(getTitleFromUrl(href))}
       </li>
      )}
     </For>
    </ul>
   </Show>
  </div>
 );
}
