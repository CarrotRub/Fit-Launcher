import { Slider } from "@/components/slider";
import { path } from "@tauri-apps/api";
import { appDataDir } from "@tauri-apps/api/path";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { createSignal, onMount } from "solid-js";
import "./newly-added-games.css";

const appDir = await appDataDir();

const popularRepacksPath = await path.join(
 appDir,
 "tempGames",
 "newly_added_games.json",
);

/**
 * Get newly added games into the GameHub.
 *
 * Returns Object
 */
async function parseNewGameData() {
 try {
  const fileContent = await readTextFile(popularRepacksPath);
  const gameData = JSON.parse(fileContent);

  // Load the user's settings to check if NSFW content should be hidden
  const settingsPath = await path.join(
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
   ? gameData.filter((game: any) => !game.tag.includes("Adult"))
   : gameData;

  return filteredGameData;
 } catch (error) {
  console.error("Error parsing game data:", error);
  throw error;
 }
}

function NewlyAddedGames() {
 const [imagesObject, setImagesObject] = createSignal(null);
 const [imagesList, setImagesList] = createSignal([]);
 const [titlesList, setTitlesList] = createSignal([]);
 const [hrefsList, setHrefsList] = createSignal([]);
 const [numberOfGames, setNumberOfGames] = createSignal(1);
 const [filteredImages, setFilteredImages] = createSignal([]);

 onMount(async () => {
  try {
   const newlyAddedGamesData = await parseNewGameData();
   setImagesObject(newlyAddedGamesData);

   const gameObj = newlyAddedGamesData;
   const imageUrls = gameObj.map((game: any) => game.img);
   const titlesObjList = gameObj.map((game: any) => game.title);
   const hrefsObjsList = gameObj.map((game: any) => game.href);

   setImagesList(imageUrls);
   setTitlesList(titlesObjList);
   setHrefsList(hrefsObjsList);

   setNumberOfGames(newlyAddedGamesData?.length);

   setFilteredImages(newlyAddedGamesData);
  } catch (error) {
   console.error("Error parsing game data : ", error);
  }
 });

 return (
  <div class="newly-added-games-container">
   <div class="text-category-gamehub">
    <p>Newly Added Games :</p>
   </div>
   {filteredImages().length > 0 ? (
    <Slider
     images={imagesList()}
     filePath={popularRepacksPath}
     titles={titlesList()}
     hrefs={hrefsList()}
    />
   ) : null}
  </div>
 );
}

export default NewlyAddedGames;
