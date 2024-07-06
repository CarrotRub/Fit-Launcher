import './Popularrepacks.css';
import { createSignal, onMount } from 'solid-js';

const popularRepacksPath = '../src/temp/popular_games.json';

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
        return gameData;
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
                const data = await parseNewGameData();
                setImagesObject(data);
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
        } catch (error) {
            // Handle error if needed
        }
    });

    return (
        <>
            <h2>{translate('popular_repacks_placeholder', {})}</h2>
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