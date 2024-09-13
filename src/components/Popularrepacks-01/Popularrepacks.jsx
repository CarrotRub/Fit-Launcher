import './Popularrepacks.css';
import { createSignal, onMount } from 'solid-js';
import { appConfigDir } from '@tauri-apps/api/path';

const appDir = await appConfigDir();
const dirPath = appDir.replace(/\\/g, '/');

const popularRepacksPath = `${dirPath}tempGames/popular_games.json`;

import readFile from '../functions/readFileRust';
import Slider from '../Slider-01/Slider';
import { translate } from '../../translation/translate';

/**
 * Get newly added games into the GameHub.
 */
async function parseNewGameData() {
    try {
        const fileContent = await readFile(popularRepacksPath);
        const gameData = JSON.parse(fileContent.content);

        // Load the user's settings to check if NSFW content should be hidden
        const settingsPath = `${dirPath}/fitgirlConfig/settings.json`;
        const settingsContent = await readFile(settingsPath);
        const settings = JSON.parse(settingsContent.content);
        const hideNSFW = settings.hide_nsfw_content;

        // Filter out NSFW games based on the "Adult" tag if the setting is enabled
        const filteredGameData = hideNSFW 
            ? gameData.filter(game => !game.tag.includes('Adult')) 
            : gameData;

        console.log(filteredGameData);
        return filteredGameData;
    } catch (error) {
        console.error('Error parsing game data:', error);
        throw error;
    }
}

function extractMainTitle(title) {
    const regex = /^(.+?)(?=[:,-])/; // Regular expression to match text before the first colon, comma, or hyphen
    const match = title.match(regex);
    return match ? match[0].trim() : title; // Extracted main title or the original title if no match
}

function extractSecondaryTitle(title) {
    const regex = /[:,-](.+)/; // Regular expression to match text after the first colon, comma, or hyphen
    const match = title.match(regex);
    return match ? match[1].trim() : title; // Extracted secondary title or the original title if no match
}


function Popularrepacks() {
    const [imagesObject, setImagesObject] = createSignal(null);
    const [firstGameTitle, setFirstGameTitle] = createSignal('');

    onMount(async () => {
        try {
            const data = await parseNewGameData();
            setImagesObject(data);
            const titles = data.map(game => extractMainTitle(game.title));
            setFirstGameTitle(titles[0] || ''); // Set the title of the first game
            const firstSlide = document.querySelector(`.games-container-pop .slide:first-child`);
            if (firstSlide) {
                const titlesNo = data.map(game => extractSecondaryTitle(game.title));
                const firstGameTitleElement = document.createElement('h4');
                firstGameTitleElement.id = 'first-game-title';
                firstGameTitleElement.textContent = titles[0] || '';
                const firstLongGameTitleElement = document.createElement('h5');
                firstLongGameTitleElement.id = 'first-long-game-title';
                firstLongGameTitleElement.textContent = titlesNo[0];
                firstSlide.appendChild(firstGameTitleElement);
                firstSlide.appendChild(firstLongGameTitleElement);
            }

            const slide0 = document.querySelector(`.games-container-pop .slide:first-child img`);
            const slide1 = document.querySelector(`.games-container-pop .slide:nth-child(2) img`);

            if (slide0) {
                const imgSrc0 = data.map(game => game.img);
                console.log(imgSrc0)
                const srcParts0 = imgSrc0[0].split(','); 
                slide0.src = srcParts0[0].trim();
            }
    
            if (slide1) {
                const imgSrc1 = data.map(game => game.img);
                const srcParts1 = imgSrc1[1].split(','); 
            
                // Check if the string contains a comma
                if (srcParts1.length > 1) {
                    // If there is a comma, use the part after the comma
                    slide1.src = srcParts1[1].trim();
                } else {
                    // If there is no comma, use the whole string
                    slide1.src = srcParts1[0].trim();
                }
            }
        } catch (error) {
            // Handle error if needed
            console.error('Error during component mount:', error);
        }
    });

    return (
        <>
            <h2>Popular Repacks</h2>
            {imagesObject() && (
                <Slider
                    containerClassName="popular-games"
                    imageContainerClassName="games-container-pop"
                    slides={imagesObject()}
                    filePath={popularRepacksPath}
                    showPrevNextButtons={true} // Set to false if you don't want to show prev/next buttons
                />
            )}
        </>
    );
}

export default Popularrepacks;