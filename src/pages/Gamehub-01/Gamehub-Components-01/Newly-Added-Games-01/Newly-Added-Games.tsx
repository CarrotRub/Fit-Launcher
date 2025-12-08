import { createSignal, onMount, createMemo, Show } from 'solid-js';
import Slider from '../../../../components/Slider-01/Slider';
import { Game } from '../../../../bindings';
import { GamesCacheApi } from '../../../../api/cache/api';
import { useGamehubFilters } from '../../GamehubContext';
import { filterGames, getAllGenres, getSizeRange } from '../../../../helpers/gameFilters';

const gameCacheInst = new GamesCacheApi();
const gamePath = "";

async function parseNewGameData(): Promise<Game[]> {
  try {
    let gameData: Game[] = [];
    const resultGame = await gameCacheInst.getNewlyAddedGames();
    if (resultGame.status === "ok") {
      gameData = resultGame.data
    }

    return gameCacheInst.removeNSFW(gameData);
  } catch (error) {
    console.error('Error parsing game data:', error);
    throw error;
  }
}

export default function NewlyAddedGames() {
  const [allGames, setAllGames] = createSignal<Game[]>([]);
  const { filters, setAvailableGenres, setRepackSizeRange, setOriginalSizeRange } = useGamehubFilters();

  // Apply filters to games
  const filteredGames = createMemo(() => filterGames(allGames(), filters()));

  // Derive display data from filtered games
  const imagesList = createMemo(() => filteredGames().map(game => game.img));
  const titlesList = createMemo(() => filteredGames().map(game => game.title));
  const hrefsList = createMemo(() => filteredGames().map(game => game.href));

  onMount(async () => {
    try {
      const newlyAddedGamesData = await parseNewGameData();
      setAllGames(newlyAddedGamesData);

      // Merge genres and size ranges with existing context data
      const genres = getAllGenres(newlyAddedGamesData);
      const repackRange = getSizeRange(newlyAddedGamesData, 'repack');
      const originalRange = getSizeRange(newlyAddedGamesData, 'original');

      // Update context (will be merged with other components' data)
      setAvailableGenres((prev: string[]) => [...new Set([...prev, ...genres])].sort());
      setRepackSizeRange((prev) => ({
        min: Math.min(prev.min, repackRange.min),
        max: Math.max(prev.max, repackRange.max),
      }));
      setOriginalSizeRange((prev) => ({
        min: Math.min(prev.min, originalRange.min),
        max: Math.max(prev.max, originalRange.max),
      }));
    } catch (error) {
      console.error("Error parsing game data : ", error);
    }
  });

  return (
    <div class="flex flex-col h-fit pb-4">
      <div class="text-2xl text-text tex-bold text-categories pl-3 text-center">
        <p>Newly Added Games</p>
      </div>
      <Show when={filteredGames().length > 0}>
        <Slider images={imagesList()} filePath={gamePath} titles={titlesList()} hrefs={hrefsList()} />
      </Show>
    </div>
  );
}
