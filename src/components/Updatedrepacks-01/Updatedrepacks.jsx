import './Updatedrepacks.css';
import { createSignal, onMount } from 'solid-js';

const recentlyUpdatedGamesPath = '../src/temp/recently_updated_games.json';
import readFile from '../functions/readFileRust';
import Slider from '../Slider-01/Slider';
import { translate } from '../../translation/translate';

/**
 * Get newly added games into the GameHub.
 */
async function parseNewGameData() {
    try {
        const fileContent = await readFile(recentlyUpdatedGamesPath);
        const gameData = JSON.parse(fileContent.content);
        return gameData;
    } catch (error) {
        console.error('Error parsing game data:', error);
        throw error;
    }
}



function UpdatedGames() {
    const [imagesObject, setImagesObject] = createSignal(null);

    onMount(async () => {
        try {
            const data = await parseNewGameData();
            setImagesObject(data);
        } catch (error) {
            // Handle error if needed
        }
    });

    // Return the Slider component once the container is created and data is fetched
    return (
        <>
          <h2 > {translate('recently_updated_games', {})}</h2>
          {imagesObject() && (
            <Slider
              containerClassName="recently-updated"
              imageContainerClassName="updated-games-container"
              slides={imagesObject()}
              filePath={recentlyUpdatedGamesPath}
              showPrevNextButtons={true} // Set to false if you don't want to show prev/next buttons
            />
          )}
        </>
      );
}

export default UpdatedGames;