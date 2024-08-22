import { createSignal, onMount, createEffect, onCleanup } from "solid-js";
import { appConfigDir } from "@tauri-apps/api/path";
import { writeFile } from "@tauri-apps/api/fs";
import { open } from "@tauri-apps/api/dialog";
import { invoke } from "@tauri-apps/api";
import Swal from "sweetalert2";
import readFile from "../../components/functions/readFileRust";
import "./Mylibrary.css";

function Mylibrary() {
    const [imagesObject, setImagesObject] = createSignal([]);
    const [downloadedGamePath, setDownloadedGamePath] = createSignal("");
    const [isDataReady, setIsDataReady] = createSignal(false); // Track if data is ready

    async function updateGamePathInFile(gameTitle, newPath, filePath) {
        try {
            const data = await readFile(filePath);
            const gameData = JSON.parse(data.content);
    
            // Step 2: Find the game by title and update the path
            const game = gameData.find(g => g.title === gameTitle);
            if (game) {
                game.path = newPath;
            } else {
                console.error('Game not found!');
                return;
            }
    
            // Step 3: Write the updated JSON back to the file
            const updatedJsonString = JSON.stringify(gameData, null, 2);
            await writeFile(filePath, updatedJsonString);
            console.log('Game path successfully updated and saved!');
        } catch (error) {
            console.error('Error updating game path:', error);
        }
    }

    async function parseDownloadedGameData() {
        try {
            // Get the app config directory
            const appDir = await appConfigDir();
            const dirPath = appDir.replace(/\\/g, "/");
            const filePath = `${dirPath}data/downloaded_games.json`;
            setDownloadedGamePath(filePath);
            const fileContent = await readFile(filePath); // Use filePath directly
            const gameData = JSON.parse(fileContent.content);
            let gameGrid = document.querySelector('.game-grid');
            let gamesContainer = document.querySelector('.game-container');
    
            // SVG for the warning icon
            const warningSvg = `
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#de4005">
                <g stroke-width="0"/>
                <g stroke-linecap="round" stroke-linejoin="round"/>
                <path fill="none" d="M0 0h24v24H0z"/>
                <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10m-1-7v2h2v-2zm0-8v6h2V7z"/></svg>

            `;
    
            // Iterate over the game data
            gameData.forEach((game, i) => {
                console.log("Searching Data...");
                const title = game.title;
                const img = game.img;
                const magnetlink = game.magnetlink;
                const path = game.path;
    
                // Create elements for displaying game information
                const imageOption = document.createElement('div');
                imageOption.className = 'image-option';
                const imgElement = document.createElement('img');
                imgElement.src = img;
                imgElement.alt = title;
    
                // Append image to imageOption
                imageOption.appendChild(imgElement);
    
                // Check if the path is empty and add the warning icon
                if (!path) {
                    const warningIcon = document.createElement('div');
                    warningIcon.className = 'warning-icon';
                    warningIcon.innerHTML = warningSvg;
                    warningIcon.style.position = 'absolute';
                    warningIcon.style.top = '5px';
                    warningIcon.style.right = '5px';
                    warningIcon.style.zIndex = '10'; // Ensure the warning icon is above the image
                    imageOption.appendChild(warningIcon);

                    imageOption.addEventListener('click', async () => {
                        let game_executable_path = await open({
                            multiple: false,
                            filters: [{
                                name: 'Executable',
                                extensions: ['exe']
                              }]
                        });

                        if (game_executable_path) {
                            updateGamePathInFile(title, game_executable_path, filePath);
                            warningIcon.remove();
                        }
                    })
                }
    
                imageOption.addEventListener('mouseover', () => {
                    const scrollPosition = window.scrollY || document.documentElement.scrollTop;
                    const blurOverlay = document.createElement('div');
                    blurOverlay.classList.add('blur-overlay');
                    gamesContainer.appendChild(blurOverlay);
                    blurOverlay.style.backgroundColor = `rgb(0,0,0)`;
                    blurOverlay.style.backgroundImage = `url(${img})`;
                    blurOverlay.style.filter = 'blur(15px)';
                    blurOverlay.style.top = `-${scrollPosition}px`;
                });
    
                // Add event listener for mouseout
                imageOption.addEventListener('mouseout', () => {
                    const blurOverlay = gamesContainer.querySelector('.blur-overlay');
                    if (blurOverlay) {
                        blurOverlay.remove();
                    }
                });
    
                // Add event listener for click
                imageOption.addEventListener('click', async () => {
                    console.log("Selected image link: ", img);
                    if (game.path) {
                        console.log("Should run the executable at :", game.path)
                        let correctTitle = game.title.replace(/\s*\+.*$/, '')
                        Swal.fire({
                            title: `Launch ${correctTitle}`,
                            text: `Do you want launch the game ${correctTitle}? \n`,
                            
                            icon: 'info',
                            showCancelButton: true,
                            confirmButtonText: 'Yes, launch it!',
                            cancelButtonText: 'Cancel'
                        }).then(async (result) => {
                            if(result.isConfirmed) {
                                await invoke('start_executable', { path: game.path });
                            }
                        });
                    }
                });
    
                gameGrid.appendChild(imageOption);
            });
            return gameData;
        } catch (error) {
            console.error("Error parsing game data:", error);
            throw error;
        }
    }

    function randomImageFinder() {
        const imageElements = document.querySelectorAll(".launcher-container img");
        if (imageElements.length > 0) {
            const randomIndex = Math.floor(Math.random() * imageElements.length);
            const selectedImageSrc = imageElements[randomIndex].getAttribute('src');

            const fitgirlLauncher = document.querySelector('.launcher-container');
            const scrollPosition = window.scrollY || document.documentElement.scrollTop;
    

            const docBlurOverlay = document.querySelector('.blur-overlay')
            if (docBlurOverlay != null) {
                docBlurOverlay.remove()
            }
            
            const docColorFilterOverlay = document.querySelector('.color-blur-overlay')
            if (docColorFilterOverlay === null){
                const colorFilterOverlay = document.createElement('div');
                colorFilterOverlay.className = 'color-blur-overlay';
                fitgirlLauncher.appendChild(colorFilterOverlay)
                console.log("colroe")

            } 

            const blurOverlay = document.createElement('div');
            blurOverlay.className = 'blur-overlay';

            fitgirlLauncher.appendChild(blurOverlay);
            blurOverlay.style.backgroundColor = `rgba(0, 0, 0, 0.4)`;
            blurOverlay.style.backgroundImage = `url(${selectedImageSrc})`;
            blurOverlay.style.filter = 'blur(15px)';
            blurOverlay.style.top = `-${scrollPosition}px`;
            
          }

    }

    onMount(async () => {

    
        try {
            await parseDownloadedGameData();
            setIsDataReady(true); // Set data as ready
        } catch (error) {
            // Handle error if needed
            setIsDataReady(false);
        }
    });

    createEffect( () => {
        let myGamehubDiv = document.querySelector(".gamehub-container");
        if (myGamehubDiv !== null) {
            let gamehubLinkText = document.querySelector('#link-gamehub');
            gamehubLinkText.style.backgroundColor = ''
            myGamehubDiv.remove();
        }

        console.log("finding...")
        const timeOut = setTimeout(randomImageFinder, 500);
        const interval = setInterval(randomImageFinder, 5000); 
        onCleanup(() => {
            clearInterval(interval)
            clearTimeout(timeOut);
        });
    })

    return ( 
        <>
            <div class="launcher-container">

                <div class="game-container">

                  <div class="game-container-title">
                    <h1> My Library</h1>
                  </div>

                  <div class="game-grid">

                  </div>
                </div>
                
            </div>
        </>
    );
}

export default Mylibrary;
