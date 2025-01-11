import { Slider } from "@/components/slider";
import { path } from "@tauri-apps/api";
import { appDataDir } from "@tauri-apps/api/path";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { createSignal, onMount } from "solid-js";
import "./recently-updated-games.css";

const appDir = await appDataDir();

const popularRepacksPath = await path.join(
 appDir,
 "tempGames",
 "recently_updated_games.json",
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

function RecentlyUpdatedGames() {
 const [imagesObject, setImagesObject] = createSignal(null);
 const [imagesList, setImagesList] = createSignal<string[]>([]);
 const [titlesList, setTitlesList] = createSignal<string[]>([]);
 const [hrefsList, setHrefsList] = createSignal<string[]>([]);
 const [numberOfGames, setNumberOfGames] = createSignal<number>(1);
 const [filteredImages, setFilteredImages] = createSignal<any[]>([]);

 const [sliderComponent, setSliderComponent] = createSignal(null);

 onMount(async () => {
  try {
   const recentlyUpdatedGamesData = await parseNewGameData();
   setImagesObject(recentlyUpdatedGamesData);

   const gameObj = recentlyUpdatedGamesData;
   const imageUrls = gameObj.map((game: any) => game.img);
   const titlesObjList = gameObj.map((game: any) => game.title);
   const hrefsObjsList = gameObj.map((game: any) => game.href);

   setImagesList(imageUrls);
   setTitlesList(titlesObjList);
   setHrefsList(hrefsObjsList);

   setNumberOfGames(recentlyUpdatedGamesData?.length);

   setFilteredImages(recentlyUpdatedGamesData);
  } catch (error) {
   console.error("Error parsing game data : ", error);
  }
 });

 return (
  <div class="recently-updated-games-container">
   <div class="text-category-gamehub">
    <p>Recently Updated Games :</p>
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

export default RecentlyUpdatedGames;
