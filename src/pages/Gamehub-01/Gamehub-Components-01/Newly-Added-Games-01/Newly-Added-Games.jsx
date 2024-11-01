import { createEffect, onMount, createSignal, onCleanup } from 'solid-js';
import { readTextFile } from '@tauri-apps/api/fs';
import { invoke } from '@tauri-apps/api';
import { createWorker } from '@solid-primitives/workers';
import { appDataDir } from '@tauri-apps/api/path';
import './Newly-Added-Games.css'


import { colorCache, setColorCache } from '../../../../components/functions/dataStoreGlobal';
import { makePersisted } from '@solid-primitives/storage';

const appDir = await appDataDir()
const popularRepacksPath = `${appDir}tempGames/newly_added_games.json`;


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

function NewlyAddedGames() {
    const [imagesObject, setImagesObject] = createSignal(null)
    const [numberOfGames, setNumberOfGames] = createSignal(1);
    const [filteredImages, setFilteredImages] = createSignal([]) 

    onMount( async () => {
        try {
            const popularGamesData = await parseNewGameData();
            setImagesObject(popularGamesData);

            setNumberOfGames(popularGamesData?.length)
    
            setFilteredImages(popularGamesData);
            
        } catch (error) {
            console.error("Error parsing game data : ", error)
        }
    });

    return (
        {/* More to be added later... */}
    )
}

