import { createSignal, onMount, createEffect, onCleanup } from "solid-js";
import { appConfigDir } from "@tauri-apps/api/path";
import readFile from "../../components/functions/readFileRust";
import Slider from "../../components/Slider-01/Slider";
import "./Mylibrary.css";

function Mylibrary() {
    const [imagesObject, setImagesObject] = createSignal([]);
    const [downloadedGamePath, setDownloadedGamePath] = createSignal("");
    const [isDataReady, setIsDataReady] = createSignal(false); // Track if data is ready

    async function parseDownloadedGameData() {
        try {
            // Get the app config directory
            const appDir = await appConfigDir();
            const dirPath = appDir.replace(/\\/g, "/");
            const filePath = `${dirPath}downloaded_games.json`;
            setDownloadedGamePath(filePath);
            const fileContent = await readFile(filePath); // Use filePath directly
            const gameData = JSON.parse(fileContent.content);
            let gameGrid = document.querySelector('.game-grid');
            let gamesContainer = document.querySelector('.game-container');
            // Maybe I copied it from my last repo I don't know
            gameData.forEach((game, i) => {
                console.log("Searching Data...");
                const title = game.title;
                const img = game.img;
                const magnetlink = game.magnetlink;

                // Create elements for displaying game information
                const imageOption = document.createElement('div');
                imageOption.className = 'image-option';
                const imgElement = document.createElement('img');
                imgElement.src = img;
                console.log(title);
                console.log(img);
                imgElement.alt = title;

                // Append image to imageOption
                imageOption.appendChild(imgElement);

                imageOption.addEventListener('mouseover', () => {
                    const scrollPosition = window.scrollY || document.documentElement.scrollTop;
                    const blurOverlay = document.createElement('div');
                    blurOverlay.classList.add('blur-overlay');
                    gamesContainer.appendChild(blurOverlay);
                    blurOverlay.style.backgroundColor = `rgb(0,0,0)`;
                    blurOverlay.style.backgroundImage = `url(${img})`;
                    blurOverlay.style.filter = 'blur(15px)';
                    blurOverlay.style.top = `-${scrollPosition}px`;
                })

                // TODO : Add event listener for context menu
                
                // Add event listener for mouseout
                imageOption.addEventListener('mouseout', () => {
                    const blurOverlay = gamesContainer.querySelector('.blur-overlay');
                    if (blurOverlay) {
                        blurOverlay.remove();
                    }
                });

                // Add event listener for click
                imageOption.addEventListener('click', () => {
                    console.log("Selected image link: " + img);
                });
                gameGrid.appendChild(imageOption);
                
            })
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
        // Remove the gamehub container if it exists
        let myGamehubDiv = document.querySelector(".gamehub-container");
        if (myGamehubDiv !== null) {
            myGamehubDiv.remove();
        }
        
        try {
            await parseDownloadedGameData();
            setIsDataReady(true); // Set data as ready
        } catch (error) {
            // Handle error if needed
            setIsDataReady(false);
        }
    });

    createEffect( () => {
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
