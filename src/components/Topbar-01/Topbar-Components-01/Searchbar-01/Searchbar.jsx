import { createSignal, createEffect, Show, onMount } from "solid-js";
import { appDataDir, join } from "@tauri-apps/api/path";
import { readTextFile } from "@tauri-apps/plugin-fs";
import "./Searchbar.css";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { useNavigate } from "@solidjs/router";
import { setDownloadGamePageInfo } from "../../../functions/dataStoreGlobal";
import { Portal } from "solid-js/web";
const appDir = await appDataDir();


function Searchbar({isTopBar = true, setSearchValue  }) {
    let navigate;
    if(isTopBar) {
      navigate = useNavigate();
    }
    const [clicked, setClicked] = createSignal(false)
    const [searchTerm, setSearchTerm] = createSignal("");
    const [searchResults, setSearchResults] = createSignal([]);
    const [searchedGameTitle, setSearchedGameTitle] = createSignal("");
    const [selectedGameLink, setSelectedGameLink] = createSignal(null);
    const [showDragonBallSVG, setShowDragonBallSVG] = createSignal(false); // Signal for SVG display
    const [isDialogOpen, setIsDialogopen] = createSignal(false);
    const [games, setGames] = createSignal([]);
    const [searchBarUUID, setSearchBarUUID] = createSignal(123)
  

    onMount(() => {
        const urlParameter = getUrlParameter("url");
        if (urlParameter !== "") {
            showResults(urlParameter);
        }
        const uuid = crypto.randomUUID();

        setSearchBarUUID(uuid)
    });

    function getUrlParameter(name) {
        name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
        let regex = new RegExp("[\\?&]" + name + "=([^&#]*)");
        let results = regex.exec(window.location.search);
        return results === null
            ? ""
            : decodeURIComponent(results[1].replace(/\+/g, " "));
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

        if (searchTerm().toLowerCase().includes("dragon ball")) {
            setShowDragonBallSVG(true);
        } else {
            setShowDragonBallSVG(false);
        }
    });

    async function showResults(query) {
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
            let postURLs = [];

            for (let response of responses) {
                if (response.ok) {
                    let text = await response.text();
                    let parser = new DOMParser();
                    let xmlDoc = parser.parseFromString(text, "text/xml");
                    let urls = xmlDoc.getElementsByTagName("url");

                    for (let url of urls) {
                        let loc = url.getElementsByTagName("loc")[0].textContent;
                        postURLs.push(loc);
                    }
                } else {
                    console.error("Failed to fetch sitemap:", response.statusText);
                }
            }

            let results = postURLs.filter((postURL) => {
                let title = getTitleFromUrl(postURL).toUpperCase().replace(/-/g, " ");
                return title.includes(query.toUpperCase().trim());
            });

            setSearchResults(results.slice(0, 5));
        } catch (error) {
            console.error("Failed to fetch sitemap data:", error);
        }
    }

    function capitalizeTitle(title) {
        return title.replace(/-/g, " ").toUpperCase();
    }

    function getTitleFromUrl(url) {
        var parts = url.split("/");
        var title = parts[3];
        return title;
    }

    function handleInputChange(event) {
        const value = event.target.value.toLowerCase();
        setSearchTerm(value);
        if (value !== "") {
            showResults(value);
        } else {
            clearSearch();
        }
    }

    const handleGoToGamePage = async (href) => {
        if (!clicked() && isTopBar) {

            console.log(href)
            setClicked(true);
            const uuid = crypto.randomUUID();
            setDownloadGamePageInfo({
                gameTitle: "",
                gameHref: href,
                filePath: ""
            })
            navigate(`/game/${uuid}`);
            clearSearch()
        } else if (!isTopBar) {
            setSearchTerm(capitalizeTitle(getTitleFromUrl(href)));
            setSearchResults([]);
            setSearchValue(href)
        }
    };

    return (
        <div class="searchbar-container" id={`searchbar-container-${searchBarUUID()}`}>
          <div class="search-bar">
            {/* Your search icon, etc. */}
            <svg
              width="24"
              xmlns="http://www.w3.org/2000/svg"
              height="24"
              viewBox="-543 241.4 24 24"
              style="-webkit-print-color-adjust: exact"
              fill="none"
            >
              <g data-testid="search">
                <circle
                  cx="-532"
                  cy="252.4"
                  r="8"
                  stroke="#ece0f0"
                  stroke-width="2"
                  fill="none"
                />
                <path
                  d="m-522 262.4-4.3-4.3"
                  stroke="#ece0f0"
                  stroke-width="2"
                  fill="none"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </g>
            </svg>
    
            <input
              id="searchbar-input"
              type="text"
              placeholder="Search Game"
              value={searchTerm()}
              onInput={handleInputChange}
              autocomplete="off"
            />
          </div>
    
          {/* Option 1: NO PORTAL – just render the results in place, absolutely anchored */}
          <Show when={searchResults().length > 0}>
            <ul id="searchbar-results">
              {searchResults().map((result, index) => (
                <li key={index}>
                  <a href="#" onClick={() => handleGoToGamePage(result)}>
                    {capitalizeTitle(getTitleFromUrl(result))}
                  </a>
                </li>
              ))}
            </ul>
          </Show>
    
          {/* 
            Option 2: If you WANT a Portal for layering, mount to this container 
            (and ensure .searchbar-container is position: relative):
            
            <Show when={searchResults().length > 0}>
              <Portal mount={document.getElementById(`searchbar-container-${searchBarUUID()}`)}>
                <ul id="searchbar-results">
                  {searchResults().map((result, index) => (
                    <li key={index}>
                      <a href="#" onClick={() => handleGoToGamePage(result)}>
                        {capitalizeTitle(getTitleFromUrl(result))}
                      </a>
                    </li>
                  ))}
                </ul>
              </Portal>
            </Show>
          */}
        </div>
      );
    }
    
    export default Searchbar;