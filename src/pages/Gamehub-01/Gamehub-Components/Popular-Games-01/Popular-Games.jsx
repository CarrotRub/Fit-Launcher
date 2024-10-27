import { createEffect, onMount, createSignal } from 'solid-js';
import { readTextFile } from '@tauri-apps/api/fs';
import { appDataDir } from '@tauri-apps/api/path';
import './Popular-Games.css'

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
        const gameData = JSON.parse(fileContent.content)

        // Load the user's settings to check if NSFW content should be hidden
        const settingsPath = `${appDir}/fitgirlConfig/settings.json`
        const settingsContent = await readTextFile(settingsPath)
        const settings = JSON.parse(settingsContent.content)
        const hideNSFW = settings.hide_nsfw_content

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
    const regex = /^(.+?)([, -])/; // Captures everything up to the first comma or hyphen
    const match = title.match(regex);
    return match ? match[1].trim() : title; // Extracted main title or the original title if no match
}

function PopularGames() {
    const [imagesObject, setImagesObject] = createSignal(null)
    const [numberOfGames, setNumberOfGames] = createSignal(1);
    const [tags, setTags] = createSignal([]) // All unique tags
    const [selectedTags, setSelectedTags] = createSignal([]) // Selected tags
    const [filteredImages, setFilteredImages] = createSignal([]) // Images after filtering

    
    onMount( async () => {
        try {
            const popularGamesData = await parseNewGameData();
            setImagesObject(popularGamesData);

            const allTags = new Set();
            popularGamesData.forEach((game) => {
                const tagsArray = game.tag.split(',').map((tag) => tag.trim())
                tagsArray.forEach((tag) => allTags.add(tag))
            });
            setTags(Array.from(allTags));

            setFilteredImages(popularGamesData);
        } catch (error) {
            console.error("Error parsing game data : ", error)
        }
    })

    return (
        <div className="popular-games-grid">

        </div>
    )
}

export default PopularGames;