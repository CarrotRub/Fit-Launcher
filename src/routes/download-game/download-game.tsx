import { downloadGamePageInfo } from "@/store/global.store";
import { useNavigate } from "@solidjs/router";
import { path } from "@tauri-apps/api";
import { invoke } from "@tauri-apps/api/core";
import { appCacheDir, appDataDir } from "@tauri-apps/api/path";
import { mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import BookmarkIcon from "lucide-solid/icons/bookmark";
import CompanyIcon from "lucide-solid/icons/building-2";
import DownloadIcon from "lucide-solid/icons/download";
import FileIcon from "lucide-solid/icons/file";
import FileArchiveIcon from "lucide-solid/icons/file-archive";
import ForwardIcon from "lucide-solid/icons/forward";
import LanguagesIcon from "lucide-solid/icons/languages";
import LoaderCircle from "lucide-solid/icons/loader-circle";
import { createSignal, onCleanup, onMount } from "solid-js";
import DownloadPopup from "../../Pop-Ups/Download-PopUp/Download-PopUp";
import "./download-game.css";

const appDir = await appDataDir();
const dirPath = appDir;

const userToDownloadGamesPath = await path.join(
 dirPath,
 "library",
 "games_to_download.json",
);
const singularGameInfoPath = await path.join(
 dirPath,
 "tempGames",
 "singular_game_temp.json",
);

export default function DownloadGamePage() {
 const [gameInfo, setGameInfo] = createSignal<Record<string, any>>({});
 const gameHref = downloadGamePageInfo.gameHref;
 const gameTitle = downloadGamePageInfo.gameTitle;
 const gameFilePath = downloadGamePageInfo.filePath;
 const [currentImageIndex, setCurrentImageIndex] = createSignal<number>(0);
 const [loading, setLoading] = createSignal<boolean>(true);
 const [additionalImages, setAdditionalImages] = createSignal<any[]>([]);
 const [cacheDirPath, setCacheDirPath] = createSignal<string>("");
 const [dirPath, setDirPath] = createSignal<string>("");
 const navigate = useNavigate();

 const [genreTags, setGenreTags] = createSignal<string>("N/A");
 const [gameCompanies, setCompanies] = createSignal<string>("N/A");
 const [gameLanguages, setLanguage] = createSignal<string>("N/A");
 const [originalSize, setOriginalSize] = createSignal<string>("N/A");
 const [repackSize, setRepackSize] = createSignal<string>("N/A");

 const [showPopup, setShowPopup] = createSignal<boolean>(false);
 const [isToDownloadLater, setToDownloadLater] = createSignal<boolean>(false);

 let imageCheckingTimeout: NodeJS.Timeout | undefined;
 let backgroundCycleInterval: NodeJS.Timeout | undefined;

 function startBackgroundCycle() {
  backgroundCycleInterval = setInterval(() => {
   setCurrentImageIndex(
    prevIndex => (prevIndex + 1) % additionalImages().length,
   );
  }, 5000);
 }

 function extractMainTitle(title: string) {
  const simplifiedTitle = title
   ?.replace(
    /(?: - |, | )?(Digital Deluxe|Ultimate Edition|Deluxe Edition)\s*[:\-]?.*|(?: - |, ).*/,
    "",
   )
   ?.replace(/\s*[:\-]\s*$/, "")
   ?.replace(/\(.*?\)/g, "")
   ?.replace(/\s*[:\–]\s*$/, "") // Clean up any trailing colons or hyphens THIS IS A FKCNG EN DASH AND NOT A HYPHEN WTF
   ?.replace(/[\–].*$/, "");

  return simplifiedTitle;
 }

 function cutDescription(description: string) {
  if (!description) {
   return "Description not available";
  }

  const gameDescriptionIndex = description.indexOf("\nGame Description\n");

  if (gameDescriptionIndex !== -1) {
   return description
    .substring(gameDescriptionIndex + "\nGame Description\n".length)
    .trim();
  } else {
   return description.trim();
  }
 }

 async function fetchGameInfo(title: string, filePath: string) {
  setLoading(true);
  if (filePath.length > 5 && title.length > 5) {
   try {
    const fileContent = await readTextFile(filePath);
    const gameData = JSON.parse(fileContent);
    let game = gameData.find((game: any) => game.title === title);

    console.log(game);
    if (!game) {
     console.warn("getting info singular");
     await invoke("get_singular_game_info", { gameLink: gameHref });
     const fileContent = await readTextFile(singularGameInfoPath);
     const gameData = JSON.parse(fileContent);
     let game = gameData.find((game: any) => game.title === title);
     if (game.img) {
      const commaIndex = game.img.indexOf(",");
      if (commaIndex !== -1) {
       game.img = game.img.substring(commaIndex + 1).trim();
      }
     }
     setGameInfo(game);
    } else {
     if (game.img) {
      const commaIndex = game.img.indexOf(",");
      if (commaIndex !== -1) {
       game.img = game.img.substring(commaIndex + 1).trim();
      }
     }
     setGameInfo(game);
    }
   } catch (error) {
    console.error("Error fetching game info:", error);
   } finally {
    setLoading(false);
   }
  } else {
   try {
    console.warn("getting info singular");
    await invoke("get_singular_game_info", { gameLink: gameHref });
    const fileContent = await readTextFile(singularGameInfoPath);
    const gameData = JSON.parse(fileContent);
    console.log(gameData[0]);
    setGameInfo(gameData[0]);
   } catch (error) {
    console.error("Error fetching game info:", error);
   } finally {
    setLoading(false);
   }
  }

  try {
   const fileContent = await readTextFile(userToDownloadGamesPath);
   let currentData = JSON.parse(fileContent);
   console.log("tt", currentData, gameInfo().title);
   const gameExists = currentData.games.some(
    (game: any) => game.title === gameInfo().title,
   );

   if (gameExists) {
    setToDownloadLater(true);
    console.log("Game exists");
   } else {
    setToDownloadLater(false);
    console.log("Game does not exist");
   }
  } catch (error) {
   console.log("No existing file found, starting fresh...");
   setToDownloadLater(false);
  }
 }

 onMount(async () => {
  setLoading(true);
  const cacheDir = await appCacheDir();
  setCacheDirPath(cacheDir);

  const appDir = await appDataDir();
  setDirPath(appDir);

  await fetchGameInfo(gameTitle, gameFilePath);
  extractDetails(gameInfo().desc);

  async function loadFromCache() {
   try {
    const cacheFileContent = await readTextFile(`${cacheDir}/image_cache.json`);
    const imagesCache = JSON.parse(cacheFileContent);

    if (imagesCache[gameHref]) {
     setAdditionalImages(imagesCache[gameHref]);
     setLoading(false);
     startBackgroundCycle();
     return true;
    } else {
     return false;
    }
   } catch (error) {
    console.log("Error accessing or processing image cache:", error);
    return false;
   }
  }

  async function retryLoadFromCache() {
   let cacheLoaded = await loadFromCache();
   if (!cacheLoaded) {
    console.log("reloading");
    await invoke("get_games_images", { gameLink: gameHref });

    const retryInterval = setInterval(async () => {
     cacheLoaded = await loadFromCache();
     if (cacheLoaded) {
      clearInterval(retryInterval);
     }
    }, 50);
   }
  }

  // Start the cache load with retry logic
  await retryLoadFromCache();
 });

 onCleanup(() => {
  clearInterval(backgroundCycleInterval);
  clearTimeout(imageCheckingTimeout);
 });

 // Duplicate function
 // src/routes/download-game/download-game.tsx
 // src/routes/gamehub/gamehub.tsx
 // src/routes/gamehub/popular-games.tsx

 function extractDetails(description: string) {
  let genresTagsMatch = description?.match(/Genres\/Tags:\s*([^\n]+)/);
  let companiesMatch = description?.match(/Company:\s*([^\n]+)/);
  if (companiesMatch === null) {
   companiesMatch = description?.match(/Companies:\s*([^\n]+)/);
  }
  const languageMatch = description?.match(/Languages:\s*([^\n]+)/);
  const originalSizeMatch = description?.match(/Original Size:\s*([^\n]+)/);
  const repackSizeMatch = description?.match(/Repack Size:\s*([^\n]+)/);

  setGenreTags(genresTagsMatch ? genresTagsMatch[1]?.trim() : "N/A");
  setCompanies(companiesMatch ? companiesMatch[1]?.trim() : "N/A");
  setLanguage(languageMatch ? languageMatch[1]?.trim() : "N/A");
  setOriginalSize(originalSizeMatch ? originalSizeMatch[1]?.trim() : "N/A");
  setRepackSize(repackSizeMatch ? repackSizeMatch[1]?.trim() : "N/A");
 }

 function goToPreviousPage() {
  let latestGlobalHref = localStorage.getItem("latestGlobalHref")!;
  navigate(latestGlobalHref);
 }

 const handleDownloadClick = () => {
  setShowPopup(true);
 };

 const closePopup = () => {
  setShowPopup(false);
 };

 async function handleAddToDownloadLater(gameData: any, isChecked: boolean) {
  let currentData = [];

  try {
   let toDownloadDirPath = await path.join(appDir, "library");
   await mkdir(toDownloadDirPath, { recursive: true });
  } catch (error) {
   console.error("Error creating directory:", error);
  }

  try {
   const fileContent = await readTextFile(userToDownloadGamesPath);
   currentData = JSON.parse(fileContent);
  } catch (error) {
   console.log("No existing file found, starting fresh...");
  }

  const gameExists = currentData.some(
   (game: any) => game.title === gameData.title,
  );

  if (isChecked && !gameExists) {
   gameData.filePath = gameFilePath;
   console.log(gameData.filePath);
   currentData.push(gameData);
  } else if (!isChecked && gameExists) {
   currentData = currentData.filter(
    (game: any) => game.title !== gameData.title,
   );
  }

  try {
   await writeTextFile(
    userToDownloadGamesPath,
    JSON.stringify(currentData, null, 2),
   );
   console.log(
    isChecked ? "Game added successfully" : "Game removed successfully",
   );
  } catch (error) {
   console.error("Error writing to file", error);
  }
 }

 return (
  <div class="download-game content-page">
   {showPopup() && (
    <DownloadPopup
     badClosePopup={closePopup}
     gameTitle={extractMainTitle(gameTitle)}
     gameMagnet={gameInfo().magnetlink}
     externFullGameInfo={gameInfo()}
    />
   )}
   {loading() ? (
    <div class="loading-icon">
     <LoaderCircle />
    </div>
   ) : (
    <>
     {gameInfo() ? (
      <>
       <div
        class="download-game-background"
        style={{
         "background-image": `linear-gradient(0deg, var(--background-color) 0%, rgba(0, 0, 0, 0) 150%), url(${additionalImages()[currentImageIndex()]})`,
         "background-size": "cover",
         "background-position": "center",
        }}
       >
        <div id="download-game-return-button" onclick={goToPreviousPage}>
         <ForwardIcon />
        </div>

        <div id="download-game-favorite-button">
         <label class="container">
          <input
           type="checkbox"
           checked={isToDownloadLater()}
           onchange={async event => {
            const isChecked = event.target.checked;
            setToDownloadLater(isChecked);

            await handleAddToDownloadLater(gameInfo(), isChecked);
           }}
          />
          <BookmarkIcon />
          <BookmarkIcon fill="black" />
         </label>
        </div>
       </div>
       <div class="download-game-info">
        <div class="download-game-main-info">
         <div class="download-game-title">
          <p id="download-game-main-title">
           {extractMainTitle(gameInfo().title)}
          </p>
          <p id="download-game-secondary-title">{gameInfo().title}</p>
         </div>
         <div
          class="download-game-download-button"
          onclick={handleDownloadClick}
         >
          <DownloadIcon />
          <p style={{ "font-weight": "600" }}>Download</p>
         </div>

         <div class="download-game-info-box-container">
          <div id="info-box-repack-size" class="download-game-info-box">
           <FileArchiveIcon />
           <div class="download-game-info-box-info-content">
            <span>Repack Size :</span>
            <p>
             <b>{repackSize()}</b>
            </p>
           </div>
          </div>
          <div id="info-box-disk-size" class="download-game-info-box">
           <FileIcon />
           <div class="download-game-info-box-info-content">
            <span>Disk Size :</span>
            <p>
             <b>{originalSize()}</b>
            </p>
           </div>
          </div>
          <div id="info-box-companies" class="download-game-info-box">
           <CompanyIcon />
           <div class="download-game-info-box-info-content">
            <span>Companies :</span>
            <p>
             <i>{gameCompanies()}</i>
            </p>
           </div>
          </div>
          <div id="info-box-languages" class="download-game-info-box">
           <LanguagesIcon />
           <div class="download-game-info-box-info-content">
            <span>Languages :</span>
            <p class="info-box-text">{gameLanguages()}</p>
           </div>
          </div>
         </div>
        </div>
        <div class="download-game-secondary-info">
         <div class="download-game-description-container">
          <p
           style={{
            color: "var(--non-selected-text-color)",
            "font-weight": "800",
            "font-size": "36px",
            "margin-bottom": "0",
           }}
          >
           Game Description :
          </p>
          <p id="download-game-description-text">
           {cutDescription(gameInfo()?.desc)}
          </p>
         </div>
         <div class="download-game-miscellaneous-info">
          <p
           style={{
            color: "var(--non-selected-text-color)",
            "font-weight": "800",
            "font-size": "36px",
            "margin-bottom": "0",
           }}
          >
           Miscellaneous Info :
          </p>
          <p>
           <strong>Genres/Tags:</strong> {genreTags()}
          </p>
          <p>
           <strong>Company/Companies:</strong> {gameCompanies()}
          </p>
          <p>
           <strong>Languages:</strong> {gameLanguages()}
          </p>
          <p>
           <strong>Original Size:</strong> {originalSize()}
          </p>
          <p>
           <strong>Repack Size:</strong> {repackSize()}
          </p>
         </div>
        </div>
       </div>
      </>
     ) : (
      <div>No game info found.</div>
     )}
    </>
   )}
  </div>
 );
}
