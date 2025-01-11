import { appDataDir, join } from "@tauri-apps/api/path";
import { message } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { createSignal, For, onMount, Show } from "solid-js";
import "./discovery.css";
import HorizontalImagesCarousel from "./image-carousel";

const appDir = await appDataDir();
const discoveryGamesPath = await join(
 appDir,
 "tempGames",
 "discovery",
 "games_list.json",
);

export default function DiscoveryPage() {
 const [gamesList, setGamesList] = createSignal<any[]>([]);
 const [visibleGames, setVisibleGames] = createSignal<any[]>([]); // Track the currently visible games
 const [currentPage, setCurrentPage] = createSignal<number>(0); // Track the current page

 async function parseNewGameData() {
  try {
   const fileContent = await readTextFile(discoveryGamesPath);
   const gameData = JSON.parse(fileContent);

   // Load the user's settings to check if NSFW content should be hidden
   const settingsPath = await join(
    appDir,
    "fitgirlConfig",
    "settings",
    "gamehub",
    "gamehub.json",
   );
   const settingsContent = await readTextFile(settingsPath);
   const settings = JSON.parse(settingsContent);
   const hideNSFW = settings.nsfw_censorship;

   // Filter out NSFW games based on the "Adult" tag if the setting is enabled
   const filteredGameData = hideNSFW
    ? gameData.filter(
       (game: { game_tags: string[] }) => !game.game_tags.includes("Adult"),
      )
    : gameData;
   return filteredGameData;
  } catch (error) {
   await message(error as any, {
    title: "FitLauncher",
    kind: "error",
   });
   throw error;
  }
 }

 //TODO: Fix that soon.
 /*  
 function updateVisibleGames() {
  const start = currentPage() * 25;
  const end = start + 25;
  setVisibleGames(gamesList().slice(start, end));
 }
 */

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
  setVisibleGames(games_list.slice(0, 100)); // Initialize the first page
 });

 return (
  <div class="discovery-page content-page">
   <div class="discovery-page-grid">
    <div class="discovery-games-list-flex">
     <For each={visibleGames()}>
      {game => (
       <Show when={game.game_secondary_images.length > 0}>
        <div class="discovery-game-item">
         <HorizontalImagesCarousel gameObject={game} />
        </div>
       </Show>
      )}
     </For>
    </div>
   </div>
   <div class="pagination-controls">
    <button onclick={prevPage} disabled={currentPage() == 0}>
     Previous
    </button>
    <span>Page {currentPage() + 1}</span>
    <button
     onclick={nextPage}
     disabled={(currentPage() + 1) * 25 >= gamesList().length}
    >
     Next
    </button>
   </div>
  </div>
 );
}
