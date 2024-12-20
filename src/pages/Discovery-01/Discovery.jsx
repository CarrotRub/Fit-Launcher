
import { createSignal, onMount, Show } from 'solid-js';
import './Discovery.css'
import { appDataDir, join } from '@tauri-apps/api/path';
import { readTextFile } from '@tauri-apps/plugin-fs';
import HorizontalImagesCarousel from './Discovery-Components/Horizontal-Image-Carousel-01/Image-Carousel';

const appDir = await appDataDir();

const discoveryGamesPath = await join(appDir, 'tempGames', 'discovery', 'games_list.json');

function DiscoveryPage() {
    const [gamesList, setGamesList] = createSignal({});

    async function parseNewGameData() {
        try {
            const fileContent = await readTextFile(discoveryGamesPath)
            const gameData = JSON.parse(fileContent)

            // Load the user's settings to check if NSFW content should be hidden
            const settingsPath = await join(appDir, 'fitgirlConfig', 'settings', 'gamehub', 'gamehub.json');
            const settingsContent = await readTextFile(settingsPath)
            const settings = JSON.parse(settingsContent)
            const hideNSFW = settings.nsfw_censorship;

            // Filter out NSFW games based on the "Adult" tag if the setting is enabled
            const filteredGameData = hideNSFW
                ? gameData.filter((game) => !game.game_tags.includes('Adult'))
                : gameData
            console.warn(filteredGameData)
            return filteredGameData
        } catch (error) {
            console.error('Error parsing game data:', error)
            throw error
        }
    }


    onMount(async () => {
        let games_list = await parseNewGameData();
        setGamesList(games_list)
    })

    return (
        <div className="discovery-page content-page">
            <div className="discovery-page-grid">
                <div className="discovery-games-list-flex">
                    <For each={gamesList()}>
                        {(game) => (
                            <GameObject gameItemObject={game} />
                        )}
                    </For>
                </div>
            </div>

        </div>
    )
}


function GameObject({ gameItemObject }) {


    return (
        <Show when={gameItemObject.game_secondary_images.length > 0}>
            {/* Tbh if there is no secondary images, it's kinda useless to have the item imo */}
            <div className="discovery-game-item">
                <HorizontalImagesCarousel gameItemObject={gameItemObject} />

            </div>
        </Show>
    )
}
export default DiscoveryPage;