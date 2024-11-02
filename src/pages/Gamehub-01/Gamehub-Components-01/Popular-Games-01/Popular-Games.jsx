import { createEffect, onMount, createSignal, onCleanup } from 'solid-js';
import { readTextFile } from '@tauri-apps/api/fs';
import { invoke } from '@tauri-apps/api';
import { createWorker } from '@solid-primitives/workers';
import { appDataDir } from '@tauri-apps/api/path';
import './Popular-Games.css'


import { colorCache, setColorCache } from '../../../../components/functions/dataStoreGlobal';
import { makePersisted } from '@solid-primitives/storage';

const appDir = await appDataDir()
const popularRepacksPath = `${appDir}tempGames/popular_games.json`

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
        const settingsPath = `${appDir}/fitgirlConfig/settings.json`
        const settingsContent = await readTextFile(settingsPath)
        const settings = JSON.parse(settingsContent)
        const hideNSFW = true; // settings.hide_nsfw_content

        // Filter out NSFW games based on the "Adult" tag if the setting is enabled
        const filteredGameData = hideNSFW
            ? gameData.filter((game) => !game.tag.includes('Adult'))
            : gameData

        console.log(filteredGameData)
        return filteredGameData
    } catch (error) {
        console.error('Error parsing game data:', error)
        throw error
    }
}

function extractMainTitle(title) {
    const regex = /^(.*?)(?=| -| Edition)/i;
    const simplifiedTitle = title?.replace(/(?: - |, | )?(Digital Deluxe|Ultimate Edition)\s*[:\-]?.*|(?: - |, ).*/, '')?.replace(/\s*[:\-]\s*$/, '');

    return simplifiedTitle
}

function PopularGames() {
    const [imagesObject, setImagesObject] = createSignal(null)
    const [numberOfGames, setNumberOfGames] = createSignal(1);
    const [filteredImages, setFilteredImages] = createSignal([]) // Images after filtering
    const [selectedGame, setSelectedGame] = createSignal(0); // Number of the game in the selected array.
    const [borderColor, setBorderColor] = createSignal("");
    const [infoContainerColor, setInfoContainerColor] = createSignal("");
    const [cleanGameTitle, setCleanGameTitle] = createSignal("");
    const [longGameTitle, setLongGameTitle] = createSignal("");
    const [gameDescription, setGameDescription] = createSignal("");
    const [gameDetails, setGameDetails] = createSignal("");

    onMount( async () => {
        try {
            const popularGamesData = await parseNewGameData();
            setImagesObject(popularGamesData);

            setNumberOfGames(popularGamesData?.length)
            if (Object.keys(colorCache).length !== numberOfGames()) {
                console.warn(Object.keys(colorCache).length, numberOfGames())
                await fetchDominantColors();
            }
    
            setFilteredImages(popularGamesData);
            
        } catch (error) {
            console.error("Error parsing game data : ", error)
        }
    })

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
            const imageUrls = images.map(img => img.img);
            console.log("Fetching colors for images:", imageUrls); // Log image URLs for debugging

            // TODO: Fix callback issue when user reload the page, could also prohibit the user completely from reloading the window.
            const colorStrings = await invoke("check_dominant_color_vec", { listImages: imageUrls });
            
            console.log(colorStrings)

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
        console.log("1")
        lightenedRgb = [blendWithWhite(r, percentage), blendWithWhite(g, percentage), blendWithWhite(b, percentage)];
        currentContrast = contrastRatio(lightenedRgb, [borderR, borderG, borderB]);
    }

    const color = `rgba(${lightenedRgb[0]}, ${lightenedRgb[1]}, ${lightenedRgb[2]}, 0.8)`;
    setInfoContainerColor(color);

    return color;
}


    // Set the border color for the current game
    createEffect( async () => {

        const cachedColor = colorCache[selectedGame()];
        console.warn("HEEEEEEEEEEEEEEEEEEEEEY : ", cachedColor)
        if (cachedColor) {
            console.log("already cached here")
            setBorderColor(`rgb${cachedColor}`);


            setCleanGameTitle(extractMainTitle(imagesObject()?.[selectedGame()]?.title))
            setLongGameTitle(imagesObject()?.[selectedGame()]?.title)

            setGameDetails(extractDetails(imagesObject()?.[selectedGame()]?.desc))
            await lightenRgbColor(borderColor(), 20, borderColor());
        } else {
            fetchDominantColors();
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
            GenreTags : genresTagsMatch ? genresTagsMatch[1]?.trim() : 'N/A',
            Companies: companiesMatch ? companiesMatch[1]?.trim() : 'N/A',
            Language: languageMatch ? languageMatch[1]?.trim() : 'N/A',
            OriginalSize: originalSizeMatch ? originalSizeMatch[1]?.trim() : 'N/A',
            RepackSize: repackSizeMatch ? repackSizeMatch[1]?.trim() : 'N/A',
        };
    }


    return (
        <div className="popular-games-grid">
            <div className="game-presentation">
                <img src={imagesObject()?.[selectedGame()]?.img} alt="game-background" className="game-image-background" />
                <div className="main-game-container">
                    <div className="main-game-image-zoomed-in">
                        <img src={imagesObject()?.[selectedGame()]?.img} alt="game-background" className="game-image-background" style={{
                        'border-color': borderColor(),
                        'border-style': 'solid',
                        'border-width': '2px',
                        'box-shadow'  : `0px 0px 30px 3px ${infoContainerColor()}`,
                    }}/>
                    </div>
                    <div className="main-game-info-container" style={
                        `
                        background-color : ${infoContainerColor()}; 
                        border-color: ${borderColor()};
                        border-style: solid;
                        border-width: 2px;
                        box-shadow  : 0px 0px 30px 3px ${infoContainerColor()}
                        `
                    }>
                        <p id="game-clean-title">
                            {cleanGameTitle()}
                        </p>
                        <p id="long-game-title">
                            {longGameTitle()}
                        </p>
                        <div id="game-details">
                            <p><strong>Genre/Tags:</strong> {gameDetails().GenreTags}</p>
                            <p><strong>Companies:</strong> {gameDetails().Companies}</p>
                            <p><strong>Languages:</strong> {gameDetails().Language}</p>
                            <p><strong>Original Size:</strong> {gameDetails().OriginalSize}</p>
                            <p><strong>Repack Size:</strong> {gameDetails().RepackSize}</p>
                        </div>
                    </div>
                    <div className="game-skipper" style={
                        `
                            background-color : ${infoContainerColor()}; 
                            border-style: solid;
                            border-width: 2px;
                            border-color: ${borderColor()};
                            box-shadow  : 0px 0px 50px 3px ${infoContainerColor()}
                        `
                    }>
                        <div id="next-area-skipper" onClick={() => {
                            setSelectedGame((prev) => (prev + 1) % numberOfGames());
                        }}>
                            <svg width="32" xmlns="http://www.w3.org/2000/svg" height="32" viewBox="894 629.25 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="894" y="629.25" width="24" height="24" class="frame-background"/></g><g class="frame-children"><path d="M897 634.25v14" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M897 634.25v14" style={`fill:none;fill-opacity:none;stroke-width:2;stroke:${borderColor()};stroke-opacity:1`} class="stroke-shape"/></g><path d="M915 641.25h-14" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M915 641.25h-14" style={`fill:none;fill-opacity:none;stroke-width:2;stroke:${borderColor()};stroke-opacity:1`} class="stroke-shape"/></g><path d="m909 647.25 6-6-6-6" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m909 647.25 6-6-6-6" style={`fill:none;fill-opacity:none;stroke-width:2;stroke:${borderColor()};stroke-opacity:1`} class="stroke-shape"/></g></g></svg>
                        </div>
                        <div id="previous-next-divider" style={
                            `
                                background-color: ${borderColor()}
                            `
                        }></div>
                        <div id="previous-area-skipper" onClick={() => {
                            setSelectedGame((prev) => (prev - 1 + numberOfGames()) % numberOfGames());
                        }}>
                            <svg width="32" xmlns="http://www.w3.org/2000/svg" height="32" viewBox="894 444.75 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="894" y="444.75" width="24" height="24" class="frame-background"/></g><g class="frame-children"><path d="m903 450.75-6 6 6 6" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m903 450.75-6 6 6 6" style={`fill:none;fill-opacity:none;stroke-width:2;stroke:${borderColor()};stroke-opacity:1`} class="stroke-shape"/></g><path d="M897 456.75h14" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M897 456.75h14" style={`fill:none;fill-opacity:none;stroke-width:2;stroke:${borderColor()};stroke-opacity:1`} class="stroke-shape"/></g><path d="M915 463.75v-14" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M915 463.75v-14" style={`fill:none;fill-opacity:none;stroke-width:2;stroke:${borderColor()};stroke-opacity:1`} class="stroke-shape"/></g></g></svg>
                        </div>
                    </div>
                </div>
            </div>
            <div className="item-skipper-container">
                <div className="item-skipper" style={
                    `filter: drop-shadow(0px 0px 32px ${borderColor()});`
                }>
                    {Array.from({ length: numberOfGames() }, (_, index) => (
                              <div class={`item-elipse ${selectedGame() === index ? 'active' : 'inactive'}`} style={{
                                fill: selectedGame() === index ? `${borderColor()}` : '', // Change background based on active state
                              }}>
                              <svg width="28" xmlns="http://www.w3.org/2000/svg" height="28" id="screenshot-fab4a6ec-74ec-8017-8005-2a1923de04fc" viewBox="864.01 772.864 31 32" style="-webkit-print-color-adjust::exact" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1">
                                <g id="shape-fab4a6ec-74ec-8017-8005-2a1923de04fc" data-testid="Ellipse">
                                  <defs></defs>
                                  <g class="fills" id="fills-fab4a6ec-74ec-8017-8005-2a1923de04fc">
                                    <ellipse cx="879.510000000001" cy="788.864" rx="12.5" ry="13" transform="matrix(1.000000, 0.000000, 0.000000, 1.000000, 0.000000, 0.000000)"></ellipse>
                                  </g>
                                  <g id="strokes-fab4a6ec-74ec-8017-8005-2a1923de04fc" class="strokes">
                                    <g class="outer-stroke-shape">
                                      <defs>
                                        <mask id="outer-stroke-render-886-fab4a6ec-74ec-8017-8005-2a1923de04fc-0" x="864.1815728752548" y="773.0355728752538" width="30.65685424949238" height="31.65685424949238" maskUnits="userSpaceOnUse">
                                          <use href="#stroke-shape-render-886-fab4a6ec-74ec-8017-8005-2a1923de04fc-0" style="fill:none;stroke:white;stroke-width:4"></use>
                                          <use href="#stroke-shape-render-886-fab4a6ec-74ec-8017-8005-2a1923de04fc-0" style="fill:black;stroke:none"></use>
                                        </mask>
                                        <ellipse cx="879.510000000001" cy="788.864" rx="12.5" ry="13" transform="matrix(1.000000, 0.000000, 0.000000, 1.000000, 0.000000, 0.000000)" id="stroke-shape-render-886-fab4a6ec-74ec-8017-8005-2a1923de04fc-0"></ellipse>
                                      </defs>
                                      <use href="#stroke-shape-render-886-fab4a6ec-74ec-8017-8005-2a1923de04fc-0" mask="url(#outer-stroke-render-886-fab4a6ec-74ec-8017-8005-2a1923de04fc-0)" style={`fill:none;stroke-width:4;stroke:${infoContainerColor()};stroke-opacity:1`}></use>
                                      <use href="#stroke-shape-render-886-fab4a6ec-74ec-8017-8005-2a1923de04fc-0" style="fill:none;fill-opacity:none;stroke-width:2;stroke:none;stroke-opacity:1"></use>
                                    </g>
                                  </g>
                                </g>
                              </svg>
                            </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default PopularGames;