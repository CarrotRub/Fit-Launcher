import { createSignal, onMount } from 'solid-js';
import Slider from '../../../../components/Slider-01/Slider';
import type { Game } from '../../../../bindings';
import { GamesCacheApi } from '../../../../api/cache/api';

const gameCacheInst = new GamesCacheApi();
const gamePath = await gameCacheInst.getRecentlyUpdatedGamesPath();

async function parseRecentlyUpdatedGameData(): Promise<Game[]> {
    try {
        const resultGame = await gameCacheInst.getRecentlyUpdatedGames();
        if (resultGame.status === 'ok') {
            return await gameCacheInst.removeNSFW(resultGame.data);
        }
        return [];
    } catch (error) {
        console.error('Error parsing recently updated game data:', error);
        throw error;
    }
}

export default function RecentlyUpdatedGames() {
    const [imagesList, setImagesList] = createSignal<string[]>([]);
    const [titlesList, setTitlesList] = createSignal<string[]>([]);
    const [hrefsList, setHrefsList] = createSignal<string[]>([]);
    const [filteredImages, setFilteredImages] = createSignal<Game[]>([]);

    onMount(async () => {
        try {
            const updatedGames = await parseRecentlyUpdatedGameData();

            setImagesList(updatedGames.map(game => game.img));
            setTitlesList(updatedGames.map(game => game.title));
            setHrefsList(updatedGames.map(game => game.href));
            setFilteredImages(updatedGames);
        } catch (error) {
            console.error('Error loading recently updated games:', error);
        }
    });

    return (
        <div class="flex flex-col h-fit pb-4">
            <div class="text-2xl font-bold text-text text-center pl-3">
                <p>Recently Updated Games</p>
            </div>
            {filteredImages().length > 0 && (
                <Slider
                    images={imagesList()}
                    filePath={gamePath}
                    titles={titlesList()}
                    hrefs={hrefsList()}
                />
            )}
        </div>
    );
}
