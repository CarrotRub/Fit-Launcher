import { createSignal, onMount, Show, For } from 'solid-js';
import './Discovery.css';
import { appDataDir, join } from '@tauri-apps/api/path';
import { readTextFile } from '@tauri-apps/plugin-fs';
import HorizontalImagesCarousel from './Discovery-Components/Horizontal-Image-Carousel-01/Image-Carousel';
import { message } from '@tauri-apps/plugin-dialog';

const appDir = await appDataDir();
const discoveryGamesPath = await join(appDir, 'tempGames', 'discovery', 'games_list.json');

function DiscoveryPage() {
    const [gamesList, setGamesList] = createSignal([]);
    const [visibleGames, setVisibleGames] = createSignal([]); // Track the currently visible games
    const [currentPage, setCurrentPage] = createSignal(0); // Track the current page

    async function parseNewGameData() {
        try {
            const fileContent = await readTextFile(discoveryGamesPath);
            const gameData = JSON.parse(fileContent);

            // Load the user's settings to check if NSFW content should be hidden
            const settingsPath = await join(appDir, 'fitgirlConfig', 'settings', 'gamehub', 'gamehub.json');
            const settingsContent = await readTextFile(settingsPath);
            const settings = JSON.parse(settingsContent);
            const hideNSFW = settings.nsfw_censorship;

            // Filter out NSFW games based on the "Adult" tag if the setting is enabled
            const filteredGameData = hideNSFW
                ? gameData.filter((game) => !game.game_tags.includes('Adult'))
                : gameData;
            return filteredGameData;
        } catch (error) {
            await message(error, { title: 'FitLauncher', kind: 'error' });
            throw error;
        }
    }

    function updateVisibleGames() {
        const start = currentPage() * 25;
        const end = start + 25;
        setVisibleGames(gamesList().slice(start, end));
    }

    function nextPage() {
        if ((currentPage() + 1) * 25 < gamesList().length) {
            setCurrentPage(currentPage() + 1);
        }
    }

    function prevPage() {
        if (currentPage() > 0) {
            setCurrentPage(currentPage() - 1);
        }
    }

    onMount(async () => {
        const games_list = await parseNewGameData();
        setGamesList(games_list);
        setVisibleGames(games_list.slice(0, 25)); // Initialize the first page
    });

    return (
        <div className="discovery-page content-page">
            <div className="discovery-page-grid">
                <div className="discovery-games-list-flex">
                    <For each={visibleGames()}>
                        {(game) => <GameObject gameItemObject={game} />}
                    </For>
                </div>
            </div>
            <div className="pagination-controls">
                <button onClick={prevPage} disabled={currentPage() === 0}>
                    Previous
                </button>
                <span>Page {currentPage() + 1}</span>
                <button
                    onClick={nextPage}
                    disabled={(currentPage() + 1) * 25 >= gamesList().length}
                >
                    Next
                </button>
            </div>
        </div>
    );
}

function GameObject({ gameItemObject }) {
    return (
        <Show when={gameItemObject.game_secondary_images.length > 0}>
            <div className="discovery-game-item">
                <HorizontalImagesCarousel gameItemObject={gameItemObject} />
            </div>
        </Show>
    );
}

export default DiscoveryPage;
