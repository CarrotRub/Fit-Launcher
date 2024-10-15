import './Newgames.css';
import { createSignal, onMount } from 'solid-js';
import { appDataDir } from '@tauri-apps/api/path';
import { readTextFile, BaseDirectory } from '@tauri-apps/api/fs';

const appDir =  await appDataDir();
const dirPath = appDir;

const newlyAddedGamesPath = `${dirPath}tempGames/newly_added_games.json`;

import readFile from '../functions/readFileRust';
import Slider from '../Slider-01/Slider';
import { translate } from '../../translation/translate';
import Swal from 'sweetalert2';

/**
 * Get newly added games into the GameHub.
 */
async function parseNewGameData() {
    try {
        const fileContent = await readFile(newlyAddedGamesPath);
        const gameData = JSON.parse(fileContent.content);

        // Load the user's settings to check if NSFW content should be hidden
        const settingsPath = `${dirPath}/fitgirlConfig/settings.json`;
        const settingsContent = await readFile(settingsPath);
        const settings = JSON.parse(settingsContent.content);
        const hideNSFW = settings.hide_nsfw_content;

        //Filter out NSFw games based on the "Adult" tag if the setting is enabled
        const filteredGameData = hideNSFW
            ? gameData.filter(game => !game.tag.includes('Adult'))
            : gameData;

        console.log(filteredGameData);
        return filteredGameData;
    } catch (error) {
        console.error('Error parsing game data:', error);
        throw error;
    }
}



function Newgames() {
    const [imagesObject, setImagesObject] = createSignal(null);

    onMount(async () => {
        try {
            const data = await parseNewGameData();
            setImagesObject(data);
        } catch (error) {
            Swal.fire({
                title: 'Error',
                html: `
                    <p>Error parsing game data, please close the app and open it again. If it still doesn't work, try a VPN.</p>
                    <p>This is a list of countries and/or ISPs that are known to block access to fitgirl-repacks:</p>
                    <ul>
                        <li><strong>Italy</strong></li>
                        <li><strong>Verizon</strong></li>
                        <li><strong>Germany</strong> (<em>ALWAYS USE A VPN IN GERMANY !</em>)</li>
                        <li><strong><em>Free Proton VPN may block P2P</em></strong></li>
                    </ul>
                    <p>If you know any more countries or ISP that blocks fitgirls repack website or P2P, please contact us on Discord, link in the settings.</p>
                `,
                footer: `Error: ${error}`,
                icon: 'error',
                confirmButtonText: 'Ok'
            });
        }
    });

    // Return the Slider component once the container is created and data is fetched
    return (
        <>
        {/* {translate('newly_added_games', {})} */}
          <h2 >Newly Added Games</h2>
          {imagesObject() && (
            <Slider
              containerClassName="newly-added"
              imageContainerClassName="games-container"
              slides={imagesObject()}
              filePath={newlyAddedGamesPath}
              showPrevNextButtons={true} // Set to false if you don't want to show prev/next buttons
            />
          )}
        </>
      );
}

export default Newgames;