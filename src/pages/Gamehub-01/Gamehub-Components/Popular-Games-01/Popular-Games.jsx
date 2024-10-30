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
    const simplifiedTitle = title.replace(/(?: - |, | )?(Digital Deluxe|Ultimate Edition)\s*[:\-]?.*|(?: - |, ).*/, '').replace(/\s*[:\-]\s*$/, '');

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

    onMount( async () => {
        try {
            const popularGamesData = await parseNewGameData();
            setImagesObject(popularGamesData);

            setNumberOfGames(popularGamesData?.length)

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
    * Does something nifty.
    *
    * @param   rgbString The value of rgb in this format 'rgb(r, g, b)'.
    * @param   percentage The percentage of how much more light do you want the image to be.
    * @returns Returns an RGB string similar to the rgbString format.
    */
    async function lightenRgbColor(rgbString, percentage) {
        const [r, g, b] = rgbString.match(/\d+/g).map(Number);

        // Lighten each color channel by blending with white
        const blendWithWhite = (color) => Math.round(color + (255 - color) * (percentage / 100));
        const lighterRgb = [blendWithWhite(r), blendWithWhite(g), blendWithWhite(b)];
        const color = `rgba(${lighterRgb[0]}, ${lighterRgb[1]}, ${lighterRgb[2]}, 0.8)`;

        setInfoContainerColor(color);

        return `rgba(${lighterRgb[0]}, ${lighterRgb[1]}, ${lighterRgb[2]}, 0.8)`;
    }

    // Set the border color for the current game
    createEffect( async () => {
        const cachedColor = colorCache[selectedGame()];
        console.warn("HEEEEEEEEEEEEEEEEEEEEEY : ", cachedColor)
        if (cachedColor) {
            console.log("already cached here")
            setBorderColor(`rgb${cachedColor}`);
            lightenRgbColor(borderColor(), 20);

            setCleanGameTitle(extractMainTitle(imagesObject()?.[selectedGame()]?.title))
            setLongGameTitle(imagesObject()?.[selectedGame()]?.title)
        } else {
            fetchDominantColors();
        }
    });


    //6px center solid ${borderColor()}
    
    
    return (
        <div className="popular-games-grid">
            <div className="game-presentation">
                <img src={imagesObject()?.[selectedGame()]?.img} alt="game-background" className="game-image-background" />
                <div className="main-game-container">
                    <div className="main-game-image-zoomed-in">
                        <img src={imagesObject()?.[selectedGame()]?.img} alt="game-background" className="game-image-background" style={{
                        'border-color': borderColor(),
                        'border-style': 'solid',
                        'border-width': '6px',
                    }}/>
                    </div>
                    <div className="main-game-info-container" style={
                        `
                        background-color : ${infoContainerColor()}; 
                        border-color: ${borderColor()};
                        border-style: solid;
                        border-width: 6px;
                        `
                    }>
                        <p id="game-clean-title">
                            {cleanGameTitle()}
                        </p>
                        <p id="long-game-title">
                            {longGameTitle()}
                        </p>
                    </div>
                </div>
            </div>
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
    )
}

export default PopularGames;