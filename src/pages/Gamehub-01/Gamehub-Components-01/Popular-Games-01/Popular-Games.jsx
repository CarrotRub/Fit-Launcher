import { createEffect, onMount, createSignal, onCleanup, createResource } from 'solid-js';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { invoke } from "@tauri-apps/api/core";
import { createWorker } from '@solid-primitives/workers';
import { appDataDir } from '@tauri-apps/api/path';
import './Popular-Games.css'


import { colorCache, setColorCache } from '../../../../components/functions/dataStoreGlobal';
import { makePersisted } from '@solid-primitives/storage';
import { useNavigate } from '@solidjs/router';
import { setDownloadGamePageInfo } from '../../../../components/functions/dataStoreGlobal';
import { path } from '@tauri-apps/api';

const appDir = await appDataDir()

const popularRepacksPath = await path.join(appDir, 'tempGames', 'popular_games.json');

/**
 * Get newly added games into the GameHub.
 * 
 * Returns Object
 */
async function parseNewGameData() {
    try {
        const fileContent = await readTextFile(popularRepacksPath)
        const gameData = JSON.parse(fileContent)

        // Load the user's settings to check if NSFW content should be hidden
        const settingsPath = await path.join(appDir, 'fitgirlConfig', 'settings', 'gamehub', 'gamehub.json');
        const settingsContent = await readTextFile(settingsPath)
        const settings = JSON.parse(settingsContent)
        const hideNSFW = settings.nsfw_censorship;

        // Filter out NSFW games based on the "Adult" tag if the setting is enabled
        const filteredGameData = hideNSFW
            ? gameData.filter((game) => !game.tag.includes('Adult'))
            : gameData

        return filteredGameData
    } catch (error) {
        console.error('Error parsing game data:', error)
        throw error
    }
}

function extractMainTitle(title) {
    const simplifiedTitle = title
        ?.replace(/(?: - |, | )?(Digital Deluxe|Ultimate Edition|Deluxe Edition)\s*[:\-]?.*|(?: - |, ).*/, '')
        ?.replace(/\s*[:\-]\s*$/, '')
        ?.replace(/\(.*?\)/g, '')
        ?.replace(/\s*[:\–]\s*$/, '') // Clean up any trailing colons or hyphens THIS IS A FKCNG EN DASH AND NOT A HYPHEN WTF
        ?.replace(/[\–].*$/, '')

    return simplifiedTitle
}


function PopularGames() {
    const [isLoading, setIsLoading] = createSignal(true);
    const [imagesObject, setImagesObject] = createSignal(null)
    const [numberOfGames, setNumberOfGames] = createSignal(1);
    const [filteredImages, setFilteredImages] = createSignal([]) // Images after filtering
    const [selectedGame, setSelectedGame] = createSignal(0); // Number of the game in the selected array.
    const [borderColor, setBorderColor] = createSignal("var(--accent-color)");
    const [infoContainerColor, setInfoContainerColor] = createSignal("var(--background-color)");
    const [cleanGameTitle, setCleanGameTitle] = createSignal("");
    const [longGameTitle, setLongGameTitle] = createSignal("");
    const [gameDescription, setGameDescription] = createSignal("");
    const [gameDetails, setGameDetails] = createSignal("");
    const [clicked, setClicked] = createSignal(false);
    const [displaySettings, setDisplaySettings] = createSignal(null)
    const navigate = useNavigate();

    onMount(async () => {
        try {
            const popularGamesData = await parseNewGameData();
            setImagesObject(popularGamesData);

            setNumberOfGames(popularGamesData?.length)


            setFilteredImages(popularGamesData);

            let display_settings = await invoke('get_gamehub_settings');
            setDisplaySettings(display_settings)

        } catch (error) {
            console.error("Error parsing game data : ", error)
        }
    })

    const [fetchColors] = createResource(numberOfGames, async (gamesCount) => {
        setIsLoading(true);

        // Create a timeout promise
        const timeout = new Promise((resolve) =>
            setTimeout(() => resolve("timeout"), 5000)
        );

        // Fetch dominant colors or resolve timeout
        const result = await Promise.race([
            (async () => {
                if (Object.keys(colorCache).length !== gamesCount) {
                    console.warn(Object.keys(colorCache).length, gamesCount);
                    await fetchDominantColors();
                }
                return "success";
            })(),
            timeout
        ]);

        // Handle timeout or success
        if (result === "timeout") {
            console.warn("Fetching dominant colors timed out");
        }

        setIsLoading(false);
    });


    const handleImageClick = (title, filePath, href) => {
        if (!clicked()) {
            console.log(href)
            setClicked(true);
            const uuid = crypto.randomUUID();
            setDownloadGamePageInfo({
                gameTitle: title,
                gameHref: href,
                filePath: filePath
            })
            window.location.href = `/game/${uuid}`;
        }
    };

    // Auto-update selected game every 10 seconds
    createEffect(async () => {
        const interval = setInterval(() => {
            setSelectedGame((prev) => (prev + 1) % numberOfGames());
        }, 10000);


        // Cleanup interval on component unmount
        onCleanup(() => clearInterval(interval));

        // // just for tests it's easier
        // setSelectedGame(0);
    });

    async function clearStore() {
        setColorCache([])
    }

    async function fetchDominantColors() {
        try {
            const images = imagesObject();
            const imageUrls = images?.map(img => img.img);

            // TODO: Fix callback issue when user reload the page, could also prohibit the user completely from reloading the window.
            const colorStrings = await invoke("check_dominant_color_vec", { listImages: imageUrls });

            setColorCache(colorStrings);

        } catch (error) {
            console.error("Error fetching dominant colors:", error);
        }
    }

    /**
     * Lightens an RGB color and ensures sufficient contrast with a border color.
     *
     * @param   rgbString The value of RGB in the format 'rgb(r, g, b)'.
     * @param   percentage Initial percentage to start lightening the color.
     * @param   borderColor The border color to ensure readability contrast against.
     * @returns Returns an RGBA string with 0.8 (80%) opacity.
     */
    async function lightenRgbColor(rgbString, percentage, borderColor) {
        const [r, g, b] = rgbString.match(/\d+/g).map(Number);
        const [borderR, borderG, borderB] = borderColor?.match(/\d+/g).map(Number);

        // Function to blend color with white
        const blendWithWhite = (color, percentage) => Math.round(color + (255 - color) * (percentage / 100));

        // Calculate relative luminance for contrast calculation
        const luminance = (r, g, b) => {
            const channel = (c) => {
                const scaled = c / 255;
                return scaled <= 0.03928 ? scaled / 12.92 : Math.pow((scaled + 0.055) / 1.055, 2.4);
            };
            return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
        };

        // Calculate contrast ratio between two RGB colors
        const contrastRatio = (rgb1, rgb2) => {
            const lum1 = luminance(...rgb1);
            const lum2 = luminance(...rgb2);
            const brightest = Math.max(lum1, lum2);
            const darkest = Math.min(lum1, lum2);
            return (brightest + 0.05) / (darkest + 0.05);
        };

        // Ensure sufficient contrast by incrementally lightening the color
        let lightenedRgb = [blendWithWhite(r, percentage), blendWithWhite(g, percentage), blendWithWhite(b, percentage)];
        let currentContrast = contrastRatio(lightenedRgb, [borderR, borderG, borderB]);

        while (currentContrast < 2 && percentage <= 100) {
            percentage += 5; // Increase lightening in small steps
            lightenedRgb = [blendWithWhite(r, percentage), blendWithWhite(g, percentage), blendWithWhite(b, percentage)];
            currentContrast = contrastRatio(lightenedRgb, [borderR, borderG, borderB]);
        }

        const color = `rgba(${lightenedRgb[0]}, ${lightenedRgb[1]}, ${lightenedRgb[2]}, 0.8)`;
        setInfoContainerColor(color);

        return color;
    }


    // Set the border color for the current game
    createEffect(async () => {

        const cachedColor = colorCache[selectedGame()];

        if (cachedColor) {

            if (displaySettings()?.auto_get_colors_popular_games) {
                setBorderColor(`rgb${cachedColor}`);
            }

            setCleanGameTitle(extractMainTitle(imagesObject()?.[selectedGame()]?.title))
            setLongGameTitle(imagesObject()?.[selectedGame()]?.title)

            setGameDetails(extractDetails(imagesObject()?.[selectedGame()]?.desc))
            if (displaySettings()?.auto_get_colors_popular_games) {
                await lightenRgbColor(borderColor(), 20, borderColor());
            }

        } else {

            if (displaySettings().auto_get_colors_popular_games) {
                fetchDominantColors();
            }
        }
    });


    //6px center solid ${borderColor()}

    function extractDetails(description) {
        let genresTagsMatch = description?.match(/Genres\/Tags:\s*([^\n]+)/);
        let companiesMatch = description?.match(/Company:\s*([^\n]+)/);
        if (companiesMatch === null) {
            companiesMatch = description?.match(/Companies:\s*([^\n]+)/);
        }
        const languageMatch = description?.match(/Languages:\s*([^\n]+)/);
        const originalSizeMatch = description?.match(/Original Size:\s*([^\n]+)/);
        const repackSizeMatch = description?.match(/Repack Size:\s*([^\n]+)/);

        return {
            GenreTags: genresTagsMatch ? genresTagsMatch[1]?.trim() : 'N/A',
            Companies: companiesMatch ? companiesMatch[1]?.trim() : 'N/A',
            Language: languageMatch ? languageMatch[1]?.trim() : 'N/A',
            OriginalSize: originalSizeMatch ? originalSizeMatch[1]?.trim() : 'N/A',
            RepackSize: repackSizeMatch ? repackSizeMatch[1]?.trim() : 'N/A',
        };
    }


    // * IMPORTANT : Here I removed the background-image because it was unseeable and it ate more memory (gradient are weirdly memory consuming) and made the launcher slower on startup.
    // * For later it will be an option to enable or disable but for now it will stay disabled.
    // * Keep the style comment as it will be useful for later purposes.

    return (
      <>
        <div className="popular-games-grid">
          <div className="game-presentation">
            <div
              className="game-whole-background"
              style={{
                // "background-image": `url(${
                //   imagesObject()?.[selectedGame()]?.img
                // })`,
                "background-size": "cover",
                "background-position": "center",
              }}
            >
              <div
                className="game-presentation-mask"
                style={{
                  "mask-image": "linear-gradient(to bottom, rgba(0, 0, 0, 1), rgba(0, 0, 0, 0))",
                }}
              ></div>
            </div>

            {isLoading() ? (
              <div className="loading-icon-pop-games">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="72"
                  height="72"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--secondary-color)"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="lucide lucide-loader-circle"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              </div>
            ) : (
              <div className="main-game-container">
                <div className="main-game-image-zoomed-in">
                  <img
                    src={imagesObject()?.[selectedGame()]?.img}
                    alt="game-background"
                    className="game-image-background"
                    style={{
                      "border-color": borderColor(),
                      "border-style": "solid",
                      "border-width": "2px",
                      "box-shadow": `0px 0px 30px 3px ${infoContainerColor()}`,
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      handleImageClick(
                        imagesObject()?.[selectedGame()]?.title,
                        popularRepacksPath,
                        imagesObject()?.[selectedGame()]?.href
                      );
                    }}
                  />
                </div>
                <div
                  className="main-game-info-container"
                  style={`
                            background-color : ${infoContainerColor()}; 
                            border-color: ${borderColor()};
                            border-style: solid;
                            border-width: 2px;
                            box-shadow  : 0px 0px 30px 3px ${infoContainerColor()};
                            cursor: pointer;
                            `}
                  onClick={() => {
                    handleImageClick(
                      imagesObject()?.[selectedGame()]?.title,
                      popularRepacksPath,
                      imagesObject()?.[selectedGame()]?.href
                    );
                  }}
                >
                  <p id="game-clean-title">{cleanGameTitle()}</p>
                  <p id="long-game-title">{longGameTitle()}</p>
                  <div id="game-details">
                    <p>
                      <strong>Genre/Tags:</strong> {gameDetails().GenreTags}
                    </p>
                    <p>
                      <strong>Companies:</strong> {gameDetails().Companies}
                    </p>
                    <p>
                      <strong>Languages:</strong> {gameDetails().Language}
                    </p>
                    <p>
                      <strong>Original Size:</strong>{" "}
                      {gameDetails().OriginalSize}
                    </p>
                    <p>
                      <strong>Repack Size:</strong> {gameDetails().RepackSize}
                    </p>
                  </div>
                </div>
                <div
                  className="game-skipper"
                  style={`
                                background-color : ${infoContainerColor()}; 
                                border-style: solid;
                                border-width: 2px;
                                border-color: ${borderColor()};
                                box-shadow  : 0px 0px 50px 3px ${infoContainerColor()}
                            `}
                >
                  <div
                    id="next-area-skipper"
                    onClick={() => {
                      setSelectedGame((prev) => (prev + 1) % numberOfGames());
                    }}
                  >
                    <svg
                      width="32"
                      xmlns="http://www.w3.org/2000/svg"
                      height="32"
                      viewBox="894 629.25 24 24"
                      style="-webkit-print-color-adjust::exact"
                      fill="none"
                    >
                      <g class="fills">
                        <rect
                          rx="0"
                          ry="0"
                          x="894"
                          y="629.25"
                          width="24"
                          height="24"
                          class="frame-background"
                        />
                      </g>
                      <g class="frame-children">
                        <path
                          d="M897 634.25v14"
                          style="fill:none"
                          class="fills"
                        />
                        <g
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          class="strokes"
                        >
                          <path
                            d="M897 634.25v14"
                            style={`fill:none;fill-opacity:none;stroke-width:2;stroke:${borderColor()};stroke-opacity:1`}
                            class="stroke-shape"
                          />
                        </g>
                        <path
                          d="M915 641.25h-14"
                          style="fill:none"
                          class="fills"
                        />
                        <g
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          class="strokes"
                        >
                          <path
                            d="M915 641.25h-14"
                            style={`fill:none;fill-opacity:none;stroke-width:2;stroke:${borderColor()};stroke-opacity:1`}
                            class="stroke-shape"
                          />
                        </g>
                        <path
                          d="m909 647.25 6-6-6-6"
                          style="fill:none"
                          class="fills"
                        />
                        <g
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          class="strokes"
                        >
                          <path
                            d="m909 647.25 6-6-6-6"
                            style={`fill:none;fill-opacity:none;stroke-width:2;stroke:${borderColor()};stroke-opacity:1`}
                            class="stroke-shape"
                          />
                        </g>
                      </g>
                    </svg>
                  </div>
                  <div
                    id="previous-next-divider"
                    style={`
                                    background-color: ${borderColor()}
                                `}
                  ></div>
                  <div
                    id="previous-area-skipper"
                    onClick={() => {
                      setSelectedGame(
                        (prev) => (prev - 1 + numberOfGames()) % numberOfGames()
                      );
                    }}
                  >
                    <svg
                      width="32"
                      xmlns="http://www.w3.org/2000/svg"
                      height="32"
                      viewBox="894 444.75 24 24"
                      style="-webkit-print-color-adjust::exact"
                      fill="none"
                    >
                      <g class="fills">
                        <rect
                          rx="0"
                          ry="0"
                          x="894"
                          y="444.75"
                          width="24"
                          height="24"
                          class="frame-background"
                        />
                      </g>
                      <g class="frame-children">
                        <path
                          d="m903 450.75-6 6 6 6"
                          style="fill:none"
                          class="fills"
                        />
                        <g
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          class="strokes"
                        >
                          <path
                            d="m903 450.75-6 6 6 6"
                            style={`fill:none;fill-opacity:none;stroke-width:2;stroke:${borderColor()};stroke-opacity:1`}
                            class="stroke-shape"
                          />
                        </g>
                        <path
                          d="M897 456.75h14"
                          style="fill:none"
                          class="fills"
                        />
                        <g
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          class="strokes"
                        >
                          <path
                            d="M897 456.75h14"
                            style={`fill:none;fill-opacity:none;stroke-width:2;stroke:${borderColor()};stroke-opacity:1`}
                            class="stroke-shape"
                          />
                        </g>
                        <path
                          d="M915 463.75v-14"
                          style="fill:none"
                          class="fills"
                        />
                        <g
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          class="strokes"
                        >
                          <path
                            d="M915 463.75v-14"
                            style={`fill:none;fill-opacity:none;stroke-width:2;stroke:${borderColor()};stroke-opacity:1`}
                            class="stroke-shape"
                          />
                        </g>
                      </g>
                    </svg>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="item-skipper-container">
            <div
              className="item-skipper"
              style={`filter: drop-shadow(0px 0px 32px ${borderColor()});`}
            >
              {Array.from({ length: numberOfGames() }, (_, index) => (
                <div
                  class={`item-elipse ${
                    selectedGame() === index ? "active" : "inactive"
                  }`}
                  style={{
                    fill: selectedGame() === index ? `${borderColor()}` : "", // Change background based on active state
                  }}
                >
                  <svg
                    width="28"
                    xmlns="http://www.w3.org/2000/svg"
                    height="28"
                    id="screenshot-fab4a6ec-74ec-8017-8005-2a1923de04fc"
                    viewBox="864.01 772.864 31 32"
                    style="-webkit-print-color-adjust::exact"
                    xmlns:xlink="http://www.w3.org/1999/xlink"
                    version="1.1"
                  >
                    <g
                      id="shape-fab4a6ec-74ec-8017-8005-2a1923de04fc"
                      data-testid="Ellipse"
                    >
                      <defs></defs>
                      <g
                        class="fills"
                        id="fills-fab4a6ec-74ec-8017-8005-2a1923de04fc"
                      >
                        <ellipse
                          cx="879.510000000001"
                          cy="788.864"
                          rx="12.5"
                          ry="13"
                          transform="matrix(1.000000, 0.000000, 0.000000, 1.000000, 0.000000, 0.000000)"
                        ></ellipse>
                      </g>
                      <g
                        id="strokes-fab4a6ec-74ec-8017-8005-2a1923de04fc"
                        class="strokes"
                      >
                        <g class="outer-stroke-shape">
                          <defs>
                            <mask
                              id="outer-stroke-render-886-fab4a6ec-74ec-8017-8005-2a1923de04fc-0"
                              x="864.1815728752548"
                              y="773.0355728752538"
                              width="30.65685424949238"
                              height="31.65685424949238"
                              maskUnits="userSpaceOnUse"
                            >
                              <use
                                href="#stroke-shape-render-886-fab4a6ec-74ec-8017-8005-2a1923de04fc-0"
                                style="fill:none;stroke:white;stroke-width:4"
                              ></use>
                              <use
                                href="#stroke-shape-render-886-fab4a6ec-74ec-8017-8005-2a1923de04fc-0"
                                style="fill:black;stroke:none"
                              ></use>
                            </mask>
                            <ellipse
                              cx="879.510000000001"
                              cy="788.864"
                              rx="12.5"
                              ry="13"
                              transform="matrix(1.000000, 0.000000, 0.000000, 1.000000, 0.000000, 0.000000)"
                              id="stroke-shape-render-886-fab4a6ec-74ec-8017-8005-2a1923de04fc-0"
                            ></ellipse>
                          </defs>
                          <use
                            href="#stroke-shape-render-886-fab4a6ec-74ec-8017-8005-2a1923de04fc-0"
                            mask="url(#outer-stroke-render-886-fab4a6ec-74ec-8017-8005-2a1923de04fc-0)"
                            style={`fill:none;stroke-width:4;stroke:${infoContainerColor()};stroke-opacity:1`}
                          ></use>
                          <use
                            href="#stroke-shape-render-886-fab4a6ec-74ec-8017-8005-2a1923de04fc-0"
                            style="fill:none;fill-opacity:none;stroke-width:2;stroke:none;stroke-opacity:1"
                          ></use>
                        </g>
                      </g>
                    </g>
                  </svg>
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
}

export default PopularGames;