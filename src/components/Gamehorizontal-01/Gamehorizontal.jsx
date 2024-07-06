import { createSignal, createEffect, onCleanup } from 'solid-js';
import { Show } from "solid-js";
import Swal from 'sweetalert2';
import readFile from '../functions/readFileRust';
import clearFile from '../functions/clearFileRust';
import Carousel from '../Carousel-01/Carousel';
import { invoke } from '@tauri-apps/api/tauri';
import { translate } from '../../translation/translate';
import { open } from '@tauri-apps/api/dialog';

import './GameHorizontal.css';

const GameHorizontalSlide = ({ gameTitlePromise, filePathPromise }) => {
    const [gameInfo, setGameInfo] = createSignal(null);
    const [loading, setLoading] = createSignal(true);
    const [isDescOpen, setDescOpen] = createSignal(false);
    const [additionalImages, setAdditionalImages] = createSignal([]);
    const [showPlaceholder, setShowPlaceholder] = createSignal(true);

    const singularGamePath = '../src/temp/singular_games.json';
    
    var jsonCheckingTimeoutID;
    var imagesCheckingTimeoutID;
    var errorCheckingTimeoutID;
    var placeholderTimeoutID;


    let searchResultsDiv = document.getElementById('search-results');
    searchResultsDiv.style.display = 'none';



    async function torrentDownloadPopup(cdgGameMagnet, cdgGameTitle, cdgGameImage) {
        const lastInputPath = localStorage.getItem('LUP');
        const currentCDG = JSON.parse(localStorage.getItem('CDG'));
        const currentCDGStats = JSON.parse(localStorage.getItem('CDG_Stats'));
        console.log(currentCDGStats)
        const infoSingleCDG = {
            gameMagnet: cdgGameMagnet,
            gameTitle: cdgGameTitle,
            gameImage: cdgGameImage
        };
    
        if (currentCDG) {
            // If there's already a game in CDG
            if (currentCDG[0].gameMagnet === cdgGameMagnet && currentCDGStats.state != "paused" ) {
                // If it's the same game
                Swal.fire({
                    title: "Information",
                    text: "This game is already downloading.",
                    icon: "info"
                });
                return;
            } else if( currentCDG[0].gameMagnet === cdgGameMagnet && currentCDGStats.state === "paused" ) {

                Swal.fire({
                    title: 'Resume your download ?',
                    text: "Do you want to resume the current download?",
                    icon: 'info',
                    showCancelButton: true,
                    confirmButtonText: 'Yes, resume it!',
                    cancelButtonText: 'Cancel'
                }).then(async (result) => {
                    if(result.isConfirmed) {
                        // const inputPathGame = localStorage.getItem('LUP');
                        // invoke('start_torrent_command', { magnetLink: cdgGameMagnet, downloadPath: inputPathGame });
                        // // Notify the Downloadingpartsidebar component to start showing stats
                        // window.dispatchEvent(new Event('start-download'));
                        // console.log(cdgGameMagnet, inputPathGame)
                        startDownloadProcess();
                    }
                }) 

                
            } else {
                // If it's a different game
                Swal.fire({
                    title: "Error",
                    text: "A different game is already downloading.",
                    icon: "error",
                    showCancelButton: true,
                    confirmButtonText: 'Delete Current Download',
                    cancelButtonText: 'Cancel'
                }).then(async (result) => {
                    if (result.isConfirmed) {
                        Swal.fire({
                            title: 'Are you sure?',
                            text: "Do you really want to delete the current download?\nIt will stop the current download but you can still start it later.",
                            icon: 'warning',
                            showCancelButton: true,
                            confirmButtonText: 'Yes, delete it!',
                            cancelButtonText: 'Cancel'
                        }).then((result) => {
                            if (result.isConfirmed) {
                                localStorage.removeItem('CDG');
                                Swal.fire({
                                    title: "Deleted",
                                    text: "The current download has been deleted.",
                                    icon: "success"
                                }).then(() => {
                                    startDownloadProcess();
                                });
                            }
                        });
                    }
                });
                return;
            }
        } else {
            startDownloadProcess();
        }
    
        function startDownloadProcess() {
            Swal.fire({
                title: 'Where do you want to download this game?',
                icon: 'question',
                html: `
                    <input type="text" id="gamePathInput" class="swal2-input" placeholder="Game Path">
                    <button id="selectPathButton" class="swal2-confirm swal2-styled">Select Path</button>
                `,
                showCancelButton: true,
                confirmButtonText: 'Download!',
                didOpen: () => {
                    if (lastInputPath) {
                        document.getElementById('gamePathInput').value = lastInputPath;
                    }
    
                    document.getElementById('selectPathButton').addEventListener('click', async (event) => {
                        event.preventDefault();
                        const selected = await open({
                            directory: true,
                            multiple: false,
                            defaultPath: lastInputPath || '',
                        });
                        if (selected) {
                            document.getElementById('gamePathInput').value = selected;
                        }
                    });
                }
            }).then(async (result) => {
                if (result.isConfirmed) {
                    const inputPath = document.getElementById('gamePathInput').value;
                    if (inputPath) {
                        try {
                            const exists = await invoke('check_folder_path', { path: inputPath });
                            if (exists) {
                                localStorage.setItem('LUP', inputPath);
                                localStorage.setItem('CDG', JSON.stringify([infoSingleCDG]));  // Store only the current game
        
                                await invoke('start_torrent_command', { magnetLink: cdgGameMagnet, downloadPath: inputPath });
                                console.log(cdgGameMagnet, inputPath)
                                Swal.fire({
                                    title: "Starting Download!",
                                    text: "The game is downloading.",
                                    icon: "success"
                                });
        
                                // Notify the Downloadingpartsidebar component to start showing stats
                                window.dispatchEvent(new Event('start-download'));
                                
                            } else {
                                Swal.fire({
                                    title: "ERROR: PATH DOES NOT EXIST",
                                    text: "Your path does not exist, please use the 'Select Path' button to be sure you are using the right path.",
                                    icon: "error"
                                });
                            }
                        } catch (error) {
                            console.error('Error:', error);
                            Swal.fire({
                                title: "ERROR: INVALID PATH",
                                text: "There was an error checking the path, please try again.",
                                icon: "error"
                            });
                        }
                    } else {
                        Swal.fire({
                            title: "ERROR: EMPTY PATH",
                            text: "Your path is empty, please use the dialog button to be sure you are using a path.",
                            icon: "error"
                        });
                    }
                }
            });
        }
    }
    
    
    async function fetchGameInfo(title, filePath) {
        try {
            const fileContentObj = await readFile(filePath);
            const fileContent = fileContentObj.content;
            const gameData = JSON.parse(fileContent);
            const game = gameData.find(game => game.title === title);
            setGameInfo(game);
            setLoading(false);
            const horizontalSlide = document.querySelector('.horizontal-slide');
            horizontalSlide.style.transform = 'translateY(0)';
        } catch (error) {
            console.error('Error fetching game info:', error);
            setLoading(false);
        }
    }

    async function fetchAdditionalImages() {
        async function checkImages() {
            try {
                const fileContentObj = await readFile(singularGamePath);
                const fileContent = fileContentObj.content;
    
                let imageSingleGameData;
                try {
                    imageSingleGameData = JSON.parse(fileContent);
                } catch (parseError) {
                    console.log("Invalid JSON, rechecking in 0.5 seconds...");
                    jsonCheckingTimeoutID = setTimeout(checkImages, 500);
                    return;
                }
    
                if (!imageSingleGameData.my_all_images || imageSingleGameData.my_all_images.length === 0) {
                    console.log("No images found, rechecking in 0.5 seconds...");
                    imagesCheckingTimeoutID = setTimeout(checkImages, 500);
                } else {
                    setAdditionalImages(imageSingleGameData.my_all_images);
                    setShowPlaceholder(false); // Hide the placeholder when images are found
                }
            } catch (error) {
                console.error('Error checking images:', error);
                errorCheckingTimeoutID = setTimeout(checkImages, 2000);
            }
        }
    
        try {
            await checkImages();
        } catch (error) {
            console.error('Error fetching additional images:', error);
        }
    }

    createEffect(async () => {
        const gameTitle = await gameTitlePromise;
        const filePath = await filePathPromise;
        if (gameTitle && filePath) {
            fetchGameInfo(gameTitle, filePath);
            try {
                fetchAdditionalImages();
            } catch (error) {
                throw new Error(error);
            }
        }
    });

    // Set a timeout to remove the placeholder after 30 seconds
    placeholderTimeoutID = setTimeout(() => {
        setShowPlaceholder(false);
    }, 20000);

    onCleanup(() => {
        clearTimeout(jsonCheckingTimeoutID);
        clearTimeout(errorCheckingTimeoutID);
        clearTimeout(imagesCheckingTimeoutID);
        clearTimeout(placeholderTimeoutID);
    });

    function cutTheDescription(description) {
        if (!description) {
            return { repackDescription: 'Description not available', officialDescription: 'Description not available' };
        }

        const repackIndex = description.indexOf('Repack Features');
        const gameDescriptionIndex = description.indexOf('\nGame Description\n');

        if (repackIndex !== -1 && gameDescriptionIndex !== -1) {

            const repackDescription = description.substring(repackIndex, gameDescriptionIndex).trim();
            const officialDescription = description.substring(gameDescriptionIndex + '\nGame Description\n'.length).trim();
            return { repackDescription, officialDescription };

        } else {
            return { repackDescription: description.trim(), officialDescription: '' };
        }
    }

    function extractDetails(description) {
        let genresTagsMatch = description.match(/Genres\/Tags:\s*([^\n]+)/);
        let companiesMatch = description.match(/Company:\s*([^\n]+)/);
        if (companiesMatch === null) {
            companiesMatch = description.match(/Companies:\s*([^\n]+)/);
        }
        const languageMatch = description.match(/Languages:\s*([^\n]+)/);
        const originalSizeMatch = description.match(/Original Size:\s*([^\n]+)/);
        const repackSizeMatch = description.match(/Repack Size:\s*([^\n]+)/);

        return {
            'Genre/Tags:': genresTagsMatch ? genresTagsMatch[1].trim() : 'N/A',
            Companies: companiesMatch ? companiesMatch[1].trim() : 'N/A',
            Language: languageMatch ? languageMatch[1].trim() : 'N/A',
            OriginalSize: originalSizeMatch ? originalSizeMatch[1].trim() : 'N/A',
            RepackSize: repackSizeMatch ? repackSizeMatch[1].trim() : 'N/A',
        };
    }

    function toggleDescription() {
        setDescOpen(!isDescOpen());
    }

    function clearAllTimeoutsID() {
        clearTimeout(jsonCheckingTimeoutID);
        clearTimeout(errorCheckingTimeoutID);
        clearTimeout(imagesCheckingTimeoutID);
    }

    async function slideDown() {
        const horizontalSlide = document.querySelector('.horizontal-slide');
        horizontalSlide.style.transform = 'translateY(100%)';
        invoke(`stop_get_games_images`);
        clearAllTimeoutsID();
            document.getElementById('search-results').style.display = 'flex';
        setTimeout(async () => {
            await clearFile(singularGamePath);
            horizontalSlide.remove();
        }, 500);
    }

    return (
        <div class={`horizontal-slide`}>
            {loading() ? (
                <p>Loading...</p>
            ) : (
                gameInfo() && (
                    <div class="game-info">
                        <div class="header-horizontal-game-info">
                            <div class="header-horizontal-game-info-logo-title" onClick={slideDown}>
                                <img src={gameInfo().img} alt={`${gameInfo().title} logo`} class="game-logo" />
                                <h1 class="game-title">{gameInfo().title.toUpperCase()}</h1>
                            </div>
                            <button class="download-btn" onClick={() => torrentDownloadPopup(gameInfo().magnetlink, gameInfo().title, gameInfo().img)}>Download Game</button>
                        </div>
                        <div class="body-horizontal-game-info">
                            <div class="description-section">
                                <div class={`game-description ${isDescOpen() ? 'open' : ''}`}>
                                    {cutTheDescription(gameInfo().desc).officialDescription}
                                </div>
                                <span class="read-more" onClick={toggleDescription}>
                                    {isDescOpen() ? 'Read less...' : 'Read more...'}
                                </span>
                                <div class="repack-description">
                                    {Object.entries(extractDetails(gameInfo().desc)).map(([title, description], index) => (
                                        <DescriptionSection
                                            key={title}
                                            title={index === 0 ? title : title.replace(/(?!^)([A-Z])/g, ' $1') + ':'}
                                            description={description}
                                        />
                                    ))}
                                </div>
                            </div>
                            <Show when={showPlaceholder() && additionalImages().length === 0}>
                                <div class="image-placeholder">
                                    {/* Placeholder content */}
                                </div>
                            </Show>
                            <div class="images-section">
                                {additionalImages().length > 0 && (
                                    <Carousel images={additionalImages()} />
                                )}
                            </div>
                        </div>
                    </div>
                )
            )}
        </div>
    );
};

const DescriptionSection = ({ title, description }) => (
    <div class="description-box">
        <p>
            <span class="descriptionUniqueTitle">{title} </span>
            <span class="descriptionUniqueContent">{description}</span>
        </p>
    </div>
);

export default GameHorizontalSlide;
