import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import './Download-Game-UUID.css';
import { mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { appCacheDir, appDataDir } from "@tauri-apps/api/path";
import { downloadGamePageInfo } from "../../components/functions/dataStoreGlobal";
import { useNavigate } from "@solidjs/router";
import { render } from "solid-js/web";
import DownloadPopup from "../../Pop-Ups/Download-PopUp/Download-PopUp";
import BasicErrorPopup from "../../Pop-Ups/Basic-Error-PopUp/Basic-Error-PopUp";
import { path } from "@tauri-apps/api";

const cacheDir = await appCacheDir();
const cacheDirPath = cacheDir;

const appDir =  await appDataDir();
const dirPath = appDir;


const singularGamePath = await path.join(dirPath, 'tempGames', 'single_game_images.json');
const ftgConfigPath = `${dirPath}\\fitgirlConfig\\settings.json`;
const userToDownloadGamesPath = await path.join(dirPath, 'library', 'games_to_download.json');
const gameImagesCache = `${cacheDirPath}\\image_cache.json`;

const DownloadGameUUIDPage = () => {
    const [gameInfo, setGameInfo] = createSignal({});
    
    const gameHref = downloadGamePageInfo.gameHref;
    const gameTitle = downloadGamePageInfo.gameTitle;
    const gameFilePath = downloadGamePageInfo.filePath
    const [currentImageIndex, setCurrentImageIndex] = createSignal(0);
    const [loading, setLoading] = createSignal(true);
    const [additionalImages, setAdditionalImages] = createSignal([])
    const [cacheDirPath, setCacheDirPath] = createSignal('');
    const [dirPath, setDirPath] = createSignal('');
    const navigate = useNavigate();
    
    const [genreTags, setGenreTags] = createSignal('N/A');
    const [gameCompanies, setCompanies] = createSignal('N/A');
    const [gameLanguages, setLanguage] = createSignal('N/A');
    const [originalSize, setOriginalSize] = createSignal('N/A');
    const [repackSize, setRepackSize] = createSignal('N/A');

    const [showPopup, setShowPopup] = createSignal(false);
    const [isToDownloadLater, setToDownloadLater] = createSignal(false);


    let imagesCheckingTimeoutID;
    let backgroundCycleIntervalID;

    async function checkImages(url) {
        try {
            
            const cacheFileContent = await readTextFile(`gameImagesCache`);

            let imagesCache;

            try {
                imagesCache = JSON.parse(cacheFileContent);
            } catch (parseError) {
                console.log("Invalid Persistent Cache JSON");
                return;
            }

            if (imagesCache[url]) {
                setAdditionalImages(imagesCache[url]);
                setLoading(false)
            } else {
                console.log("Not found in persistent cache, going to start the function.");
                imagesCheckingTimeoutID = setTimeout(checkImages.bind(null, url), 100);
            }

        } catch (error) {
            throw new Error(error);
        }

    }

    function startBackgroundCycle() {
        backgroundCycleIntervalID = setInterval(() => {
            setCurrentImageIndex((prevIndex) => (prevIndex + 1) % additionalImages().length);
        }, 5000);
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

    function cutTheDescription(description) {
        if (!description) {
            return 'Description not available';
        }
    
        const gameDescriptionIndex = description.indexOf('\nGame Description\n');
    
        if (gameDescriptionIndex !== -1) {
            return description.substring(gameDescriptionIndex + '\nGame Description\n'.length).trim();
        } else {
            return description.trim();
        }
    }

    onMount(async () => {
        setLoading(true);
        
        const cacheDir = await appCacheDir();
        setCacheDirPath(cacheDir);
    
        const appDir = await appDataDir();
        setDirPath(appDir);
        
        await fetchGameInfo(gameTitle, gameFilePath);
        extractDetails(gameInfo().desc)

        async function loadFromCache() {
            try {
                const cacheFileContent = await readTextFile(`${cacheDir}/image_cache.json`);
                const imagesCache = JSON.parse(cacheFileContent);
    
    
                if (imagesCache[gameHref]) {
                    setAdditionalImages(imagesCache[gameHref]);
                    setLoading(false);
                    startBackgroundCycle();
                    return true; 
                } else {
                    return false; 
                }
            } catch (error) {
                console.log('Error accessing or processing image cache:', error);
                return false;
            }
        }
    
        async function retryLoadFromCache() {

            let cacheLoaded = await loadFromCache();
            if (!cacheLoaded) {
                console.log("reloading")
                await invoke('get_games_images', { gameLink: gameHref });
    
                const retryInterval = setInterval(async () => {
                    cacheLoaded = await loadFromCache();
                    if (cacheLoaded) {
                        clearInterval(retryInterval); 
                    }
                }, 50);
            }
        }

        // Start the cache load with retry logic
        await retryLoadFromCache();
    });
    

    onCleanup(() => {
        clearInterval(backgroundCycleIntervalID);
        clearTimeout(imagesCheckingTimeoutID);
    });

    async function fetchGameInfo(title, filePath) {
        setLoading(true);
        try {
            const fileContent = await readTextFile(filePath);
            const gameData = JSON.parse(fileContent);
            let game = gameData.find(game => game.title === title);

            if (game && game.img) {
                const commaIndex = game.img.indexOf(',');
                if (commaIndex !== -1) {
                    game.img = game.img.substring(commaIndex + 1).trim();
                }
            }
            setGameInfo(game);

            try {
                // Read the existing file content
                const fileContent = await readTextFile(userToDownloadGamesPath);
                // Parse the JSON content from the file
                let currentData = JSON.parse(fileContent);
                console.log("tt", currentData, gameInfo().title)
                // Check if the game already exists in the file
                const gameExists = currentData.games.some(game => game.title === gameInfo().title);
                
                if (gameExists) {
                  setToDownloadLater(true);
                  console.log("Game exists");
                } else {
                  setToDownloadLater(false);
                  console.log("Game does not exist");
                }
            } catch (error) {
                // Handle case where the file does not exist yet (initialize with an empty array)
                console.log('No existing file found, starting fresh...');
                // Initialize with empty games list if needed
                setToDownloadLater(false); // You can set this to a default state
            }

        } catch (error) {
            console.error('Error fetching game info:', error);
        } finally {
            setLoading(false);
        }
    }

    function extractDetails(description) {
        let genresTagsMatch = description?.match(/Genres\/Tags:\s*([^\n]+)/);
        let companiesMatch = description?.match(/Company:\s*([^\n]+)/);
        if (companiesMatch === null) {
            companiesMatch = description?.match(/Companies:\s*([^\n]+)/);
        }
        const languageMatch = description?.match(/Languages:\s*([^\n]+)/);
        const originalSizeMatch = description?.match(/Original Size:\s*([^\n]+)/);
        const repackSizeMatch = description?.match(/Repack Size:\s*([^\n]+)/);

        setGenreTags(genresTagsMatch ? genresTagsMatch[1]?.trim() : 'N/A');
        setCompanies(companiesMatch ? companiesMatch[1]?.trim() : 'N/A');
        setLanguage(languageMatch ? languageMatch[1]?.trim() : 'N/A');
        setOriginalSize(originalSizeMatch ? originalSizeMatch[1]?.trim() : 'N/A');
        setRepackSize(repackSizeMatch ? repackSizeMatch[1]?.trim() : 'N/A');
    }

    function handleReturnToGamehub() {
        navigate(-1)
    }

   const handleDownloadClick = () => {
        setShowPopup(true);
    };

    const closePopup = () => {
        setShowPopup(false);
    };

    function testFav() {
        const pageContent = document.querySelector(".download-game")
        render(
            () =>   <BasicErrorPopup 
                        errorTitle={"AN ERROR PUTTING YOUR GAME INTO FAVORITES HAPPENED"}
                        errorMessage={"This is a placeholder message error to test so it will be kinda the long"} 
                        errorFooter={''}
                    />
            ,pageContent
        )
    }
    
    async function handleAddToDownloadLater(gameData, isChecked) {
        let currentData = [];
    
        // Ensure the directory exists
    
        try {
            let toDownloadDirPath = await path.join(appDir, 'library');
            await mkdir(toDownloadDirPath, { recursive: true }); // Create the directory
        } catch (error) {
            console.error('Error creating directory:', error);
        }
    
        // Read the current data from the file if it exists, or initialize it
        try {
          const fileContent = await readTextFile(userToDownloadGamesPath);
          currentData = JSON.parse(fileContent);
        } catch (error) {
          // Handle case where the file does not exist yet (initialize with an empty array)
          console.log('No existing file found, starting fresh...');
        }
    
        // Check if the game is already in the list
        const gameExists = currentData.some(game => game.title === gameData.title);
        
        if (isChecked && !gameExists) {
          // Add the new game to the games array if it's not already added
          gameData.filePath = gameFilePath;
          console.log(gameData.filePath)
          currentData.push(gameData);

        } else if (!isChecked && gameExists) {
          // Remove the game if unchecked
          currentData = currentData.filter(game => game.title !== gameData.title);
        }
    
        // Write the updated data back to the file
        try {
          await writeTextFile(userToDownloadGamesPath, JSON.stringify(currentData, null, 2));  // Pretty-print with indentation
          console.log(isChecked ? 'Game added successfully' : 'Game removed successfully');
        } catch (error) {
          console.error('Error writing to file', error);
        }
      }
    
      // Checkbox change handler
      const handleCheckboxChange = async (e) => {
        const isChecked = e.target.checked;
        setToDownloadLater(isChecked);
    
        // Call the function to add or remove game when checkbox state changes
        await handleAddToDownloadLater(gameInfo(), isChecked);
      };

    return (
        <div className="download-game content-page">
                {showPopup() && <DownloadPopup closePopup={closePopup} gameTitle={extractMainTitle(gameTitle)} gameMagnet={gameInfo().magnetlink} externFullGameInfo={gameInfo()}/>}
                {loading() ? (
                    <div className="loading-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-loader-circle"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    </div> 
                ) : (

                    <>
                        {gameInfo() ? (
                            <>
                                <div className="download-game-background"
                                style={{
                                    'background-image': `linear-gradient(0deg, var(--background-color) 0%, rgba(0, 0, 0, 0) 150%), url(${additionalImages()[currentImageIndex()]})`,
                                    'background-size': 'cover',
                                    'background-position': 'center',
                                }}>
                                    
                                    <div id="download-game-return-button" onClick={handleReturnToGamehub}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-forward"><path d="m15 17 5-5-5-5"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg>
                                    </div>
                                    
                                    <div id="download-game-favorite-button">
                                        <label class="container">
                                        <input 
                                          type="checkbox" 
                                          checked={isToDownloadLater()} 
                                          onChange={handleCheckboxChange} 
                                        />
                                          <svg class="save-regular" xmlns="http://www.w3.org/2000/svg" height="32" viewBox="0 0 384 512"><path d="M0 48C0 21.5 21.5 0 48 0v441.4l130.1-92.9c8.3-6 19.6-6 27.9 0l130 92.9V48H48V0h288c26.5 0 48 21.5 48 48v440c0 9-5 17.2-13 21.3s-17.6 3.4-24.9-1.8L192 397.5l-154.1 110c-7.3 5.2-16.9 5.9-24.9 1.8S0 497 0 488z"/></svg>
                                          <svg class="save-solid" xmlns="http://www.w3.org/2000/svg" height="32" viewBox="0 0 384 512"><path d="M0 48v439.7C0 501.1 10.9 512 24.3 512c5 0 9.9-1.5 14-4.4L192 400l153.7 107.6c4.1 2.9 9 4.4 14 4.4 13.4 0 24.3-10.9 24.3-24.3V48c0-26.5-21.5-48-48-48H48C21.5 0 0 21.5 0 48"/></svg>
                                        </label>
                                    </div>
                                </div>
                                <div className="download-game-info">
                                    <div className="download-game-main-info">
                                        <div className="download-game-title">
                                            <p id="download-game-main-title">
                                                {extractMainTitle(gameTitle)}
                                            </p>
                                            <p id="download-game-secondary-title">
                                                {gameTitle}
                                            </p>
                                        </div>
                                        <div className="download-game-download-button" onClick={handleDownloadClick}>
                                            <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="114 919.542 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="114" y="919.542" width="24" height="24" class="frame-background"/></g><g class="frame-children"><path d="M135 934.542v4a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-4" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M135 934.542v4a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-4" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape"/></g><path d="m121 929.542 5 5 5-5" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m121 929.542 5 5 5-5" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape"/></g><path d="M126 934.542v-12" style="fill:none" class="fills"/><g stroke-linejoin="round" stroke-linecap="round" class="strokes"><path d="M126 934.542v-12" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape"/></g></g></svg>
                                            <p style={{'font-weight' : '600'}}>Download</p>
                                        </div>

                                        <div className="download-game-info-box-container">
                                            <div id="info-box-repack-size" className="download-game-info-box">
                                                <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="313 919.316 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="313" y="919.316" width="24" height="24" class="frame-background"/></g><g class="frame-children"><path d="M317 941.316v-18c0-.5.2-1 .6-1.4s.9-.6 1.4-.6h8.5l5.5 5.5v12.5c0 .5-.2 1-.6 1.4s-.9.6-1.4.6h-2" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M317 941.316v-18c0-.5.2-1 .6-1.4s.9-.6 1.4-.6h8.5l5.5 5.5v12.5c0 .5-.2 1-.6 1.4s-.9.6-1.4.6h-2" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:.5" class="stroke-shape"/></g><path d="M327 921.316v6h6" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M327 921.316v6h6" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:.5" class="stroke-shape"/></g><circle cx="323" cy="939.316" style="fill:none" class="fills" r="2"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><circle cx="323" cy="939.316" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:.5" class="stroke-shape" r="2"/></g><path d="M323 926.316v-1" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M323 926.316v-1" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:.5" class="stroke-shape"/></g><path d="M323 931.316v-1" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M323 931.316v-1" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:.5" class="stroke-shape"/></g><path d="M323 937.316v-2" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M323 937.316v-2" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:.5" class="stroke-shape"/></g></g></svg>
                                                <div className="download-game-info-box-info-content">
                                                    <span>Repack Size :</span>
                                                    <p><b>{repackSize()}</b></p>
                                                </div>
                                            </div>
                                            <div id="info-box-disk-size" className="download-game-info-box">
                                                <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="531 919.316 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="531" y="919.316" width="24" height="24" class="frame-background"/></g><g class="frame-children"><path d="M545.5 921.316H537a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-12.5z" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M545.5 921.316H537a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-12.5z" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:.5" class="stroke-shape"/></g><path d="M545 921.316v6h6" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M545 921.316v6h6" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:.5" class="stroke-shape"/></g></g></svg>
                                                <div className="download-game-info-box-info-content">
                                                    <span>Disk Size :</span>
                                                    <p><b>{originalSize()}</b></p>
                                                </div>
                                            </div>
                                            <div id="info-box-companies" className="download-game-info-box">
                                                <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="393 1494 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="393" y="1494" width="24" height="24" class="frame-background"/></g><g class="frame-children"><path d="M399 1516v-18a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M399 1516v-18a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:.5" class="stroke-shape"/></g><path d="M399 1506h-2a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M399 1506h-2a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:.5" class="stroke-shape"/></g><path d="M411 1503h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M411 1503h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:.5" class="stroke-shape"/></g><path d="M403 1500h4" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M403 1500h4" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:.5" class="stroke-shape"/></g><path d="M403 1504h4" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M403 1504h4" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:.5" class="stroke-shape"/></g><path d="M403 1508h4" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M403 1508h4" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:.5" class="stroke-shape"/></g><path d="M403 1512h4" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M403 1512h4" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:.5" class="stroke-shape"/></g></g></svg>
                                                <div className="download-game-info-box-info-content">
                                                    <span>Companies :</span>
                                                    <p><i>{gameCompanies()}</i></p>
                                                </div>
                                            </div>
                                            <div id="info-box-languages" className="download-game-info-box">
                                                <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="930 919.316 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="930" y="919.316" width="24" height="24" class="frame-background"/></g><g class="frame-children"><path d="m935 927.316 6 6" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m935 927.316 6 6" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:.5" class="stroke-shape"/></g><path d="m934 933.316 6-6 2-3" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m934 933.316 6-6 2-3" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:.5" class="stroke-shape"/></g><path d="M932 924.316h12" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M932 924.316h12" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:.5" class="stroke-shape"/></g><path d="M937 921.316h1" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M937 921.316h1" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:.5" class="stroke-shape"/></g><path d="m952 941.316-5-10-5 10" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m952 941.316-5-10-5 10" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:.5" class="stroke-shape"/></g><path d="M944 937.316h6" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M944 937.316h6" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:.5" class="stroke-shape"/></g></g></svg>
                                                <div className="download-game-info-box-info-content">
                                                    <span>Languages :</span>
                                                    <p className="info-box-text">{gameLanguages()}</p>
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                    <div className="download-game-secondary-info">
                                        <div className="download-game-description-container">
                                            <p style={{'color' : 'var(--non-selected-text-color)', 'font-weight' : '800', 'font-size' : '36px', 'margin-bottom' : '0'}}>Game Description :</p>
                                            <p id="download-game-description-text">
                                                {cutTheDescription(gameInfo().desc)}
                                            </p>
                                        </div>
                                        <div className="download-game-miscellaneous-info">
                                            <p style={{'color' : 'var(--non-selected-text-color)', 'font-weight' : '800', 'font-size' : '36px', 'margin-bottom' : '0'}}>Miscellaneous Info :</p>
                                            <p><strong>Genres/Tags:</strong> {genreTags()}</p>
                                            <p><strong>Company/Companies:</strong> {gameCompanies()}</p>
                                            <p><strong>Languages:</strong> {gameLanguages()}</p>
                                            <p><strong>Original Size:</strong> {originalSize()}</p>
                                            <p><strong>Repack Size:</strong> {repackSize()}</p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div>No game info found.</div>
                        )}
                    </>

                )}
        </div>
    );
};

export default DownloadGameUUIDPage;
