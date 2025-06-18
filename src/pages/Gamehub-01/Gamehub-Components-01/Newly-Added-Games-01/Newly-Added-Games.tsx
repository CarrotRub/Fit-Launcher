import { createSignal, onMount } from 'solid-js';
import Slider from '../../../../components/Slider-01/Slider';
import { Game } from '../../../../bindings';
import { GamesCacheAPI } from '../../../../api/cache/api';

const gameCacheInst = new GamesCacheAPI();
const gamePath = await gameCacheInst.getNewlyAddedGamesPath();

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
  const [imagesList, setImagesList] = createSignal<string[]>([]);
  const [titlesList, setTitlesList] = createSignal<string[]>([]);
  const [hrefsList, setHrefsList] = createSignal<string[]>([]);
  const [filteredImages, setFilteredImages] = createSignal<Game[]>([]);

  onMount(async () => {
    try {
      const newlyAddedGamesData = await parseNewGameData();
      const imageUrls = newlyAddedGamesData.map(game => game.img);
      const titlesObjList = newlyAddedGamesData.map(game => game.title);
      const hrefsObjsList = newlyAddedGamesData.map(game => game.href);

      setImagesList(imageUrls);
      setTitlesList(titlesObjList);
      setHrefsList(hrefsObjsList);
      setFilteredImages(newlyAddedGamesData);
    } catch (error) {
      console.error("Error parsing game data : ", error);
    }
  });

  return (
    <div class="flex flex-col h-fit pb-4">
      <div class="text-2xl text-text tex-bold text-categories pl-3 text-center">
        <p>Newly Added Games</p>
      </div>
      {filteredImages().length > 0 && (
        <Slider images={imagesList()} filePath={gamePath} titles={titlesList()} hrefs={hrefsList()} />
      )}
    </div>
  );
}
