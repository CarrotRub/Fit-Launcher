import { onMount, createSignal } from 'solid-js';
import { readTextFile } from '@tauri-apps/api/fs';
import { appDataDir } from '@tauri-apps/api/path';
import './Recently-Updated-Games.css'

const appDir = await appDataDir()
const popularRepacksPath = `${appDir}tempGames/recently_updated_games.json`;

import Slider from '../../../../components/Slider-01/Slider';

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

        return filteredGameData
    } catch (error) {
        console.error('Error parsing game data:', error)
        throw error
    }
}

function RecentlyUpdatedGames() {
    const [imagesObject, setImagesObject] = createSignal(null)
    const [imagesList, setImagesList] = createSignal([])
    const [titlesList, setTitlesList] = createSignal([])
    const [numberOfGames, setNumberOfGames] = createSignal(1);
    const [filteredImages, setFilteredImages] = createSignal([]) 

    const [sliderComponent, setSliderComponent] = createSignal(null)

    onMount( async () => {
        try {
            const popularGamesData = await parseNewGameData();
            setImagesObject(popularGamesData);

            const gameObj = popularGamesData;
            const imageUrls = gameObj.map(game => game.img);
            const titlesObjList = gameObj.map(game => game.title);

            setImagesList(imageUrls);
            setTitlesList(titlesObjList);

            setNumberOfGames(popularGamesData?.length)
    
            setFilteredImages(popularGamesData);
            setSliderComponent(
                filteredImages().length > 0 ? (
                    <Slider images={imagesList()} filePath={popularRepacksPath} titles={titlesList()}/>
                ) : (
                    null
                )
            )
            
        } catch (error) {
            console.error("Error parsing game data : ", error)
        }
    });

    return (
        <div className="recently-updated-games-container">
            <div className="text-category-gamehub">
                <p>Recently Updated Games :</p>
            </div>
            {sliderComponent()}
        </div>
        
    )
}

export default RecentlyUpdatedGames;