import { setDownloadGamePageInfo } from "@/store/global.store";
import { appDataDir, join } from "@tauri-apps/api/path";
import { mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import CircleArrowLeft from "lucide-solid/icons/circle-arrow-left";
import CircleArrowRight from "lucide-solid/icons/circle-arrow-right";
import Star from "lucide-solid/icons/star";
import { createSignal, onMount, Show } from "solid-js";
import "./image-carousel.css";

const appDir = await appDataDir();

const userToDownloadGamesPath = await join(
 appDir,
 "library",
 "games_to_download.json",
);
const defaultPath = await join(appDir, "tempGames", "newly_added_games.json");

function HorizontalImageCarousel({ gameObject }: { gameObject: any }) {
 const [clicked, setClicked] = createSignal<boolean>(false);
 const [imagesList, setImagesList] = createSignal<string[]>([]);
 const [currentImage, setCurrentImage] = createSignal<number>(0); // Start with the first image
 const [isThrottled, setIsThrottled] = createSignal<boolean>(false); // Throttle state
 const [isToDownloadLater, setIsToDownloadLater] = createSignal<boolean>(false);

 const [gameCompanies, setCompanies] = createSignal<string>("N/A");
 const [gameLanguages, setLanguage] = createSignal<string>("N/A");
 const [originalSize, setOriginalSize] = createSignal<string>("N/A");
 const [repackSize, setRepackSize] = createSignal<string>("N/A");

 onMount(async () => {
  setImagesList(gameObject.game_secondary_images);

  extractDetails(gameObject.game_description);

  try {
   const fileContent = await readTextFile(userToDownloadGamesPath);
   let currentData = JSON.parse(fileContent);
   const gameExists = currentData.some(
    (game: any) => game.title === gameObject.game_title,
   );

   if (gameExists) {
    setIsToDownloadLater(true);
   } else {
    setIsToDownloadLater(false);
   }
  } catch (error) {
   // Handle case where the file does not exist yet (initialize with an empty array)
   setIsToDownloadLater(false);
  }
 });

 const throttle = (callback: () => void, delay: number) => {
  if (isThrottled()) return; // Ignore if already throttled
  setIsThrottled(true);
  callback(); // Execute the navigation callback
  setTimeout(() => setIsThrottled(false), delay); // Reset throttle after delay
 };

 function prevSlide() {
  throttle(() => {
   setCurrentImage(
    current => (current - 1 + imagesList().length) % imagesList().length,
   );
  }, 400);
 }

 function nextSlide() {
  throttle(() => {
   setCurrentImage(current => (current + 1) % imagesList().length);
  }, 400);
 }

 function getSlideClass(index: number) {
  const total = imagesList().length;

  if (index == currentImage()) return "active";
  if (index == (currentImage() - 1 + total) % total) return "left";
  if (index == (currentImage() + 1) % total) return "right";

  return "hidden";
 }

 function extractMainTitle(title: string) {
  const simplifiedTitle = title
   ?.replace(/\s*[:\-]\s*$/, "")
   ?.replace(/\(.*?\)/g, "")
   ?.replace(/\s*[:\–]\s*$/, "") // Clean up any trailing colons or hyphens THIS IS A FKCNG EN DASH AND NOT A HYPHEN WTF
   ?.replace(/[\–].*$/, "");

  return simplifiedTitle;
 }

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

  setCompanies(companiesMatch ? companiesMatch[1]?.trim() : "N/A");
  setLanguage(languageMatch ? languageMatch[1]?.trim() : "N/A");
  setOriginalSize(originalSizeMatch ? originalSizeMatch[1]?.trim() : "N/A");
  setRepackSize(repackSizeMatch ? repackSizeMatch[1]?.trim() : "N/A");
 }

 //**
 // Helper function to transform the data from this pretty formatting and structuring to the other weird disgusting shit, but this will be useless anyways when I'll change (yet again) the whole scraping system.
 //
 // */
 function transformGameData(gameData: any) {
  return {
   title: gameData.game_title,
   img: gameData.game_main_image,
   desc: gameData.game_description,
   magnetlink: gameData.game_magnetlink,
   href: gameData.game_href,
   tag: gameData.game_tags,
  };
 }

 async function handleAddToDownloadLater(gameData: any, isChecked: any) {
  let currentData = [];
  gameData = transformGameData(gameData);
  try {
   let toDownloadDirPath = await join(appDir, "library");
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
   gameData.filePath = defaultPath;
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
  } catch (error) {
   console.error("Error writing to file", error);
  }
 }

 return (
  <Show when={imagesList().length > 0}>
   <div class="horizontal-images-slider-container">
    <label class="container-star-horizontal-image-slider">
     <input
      type="checkbox"
      checked={isToDownloadLater()}
      onchange={async event => {
       const isChecked = event.target.checked;
       setIsToDownloadLater(isChecked);

       await handleAddToDownloadLater(gameObject, isChecked);
      }}
     />
     <Star />
    </label>
    <div class="images-wrapper">
     {imagesList().map((image, index) => (
      <div class={`slide ${getSlideClass(index)}`}>
       <img
        src={image}
        data-src={image}
        alt={`Slide ${index}`}
        loading="lazy"
        onclick={() => {
         if (!clicked()) {
          setClicked(true);
          const uuid = crypto.randomUUID();
          setDownloadGamePageInfo({
           gameTitle: gameObject.game_title,
           gameHref: gameObject.game_href,
           filePath: defaultPath,
          });
          window.location.href = `/game/${uuid}`;
         }
        }}
       />
      </div>
     ))}
    </div>
    <div class="carousel-skipper-slider-container">
     <div class="carousel-skipper left" role="button" onclick={prevSlide}>
      <CircleArrowLeft />
     </div>
     <div class="carousel-skipper right" role="button" onclick={nextSlide}>
      <CircleArrowRight />
     </div>
    </div>

    <div class="discovery-game-item-info-container">
     <div class="discovery-game-item-main-info">
      <p class="discovery-game-main-title">
       {extractMainTitle(gameObject.game_title)}
      </p>
      <p class="discovery-game-secondary-title">{gameObject.game_title}</p>
      <p class="discovery-game-tags">
       <b>Tags : </b>
       <span>{gameObject.game_tags}</span>
      </p>
     </div>
     <div class="discovery-game-item-secondary-info">
      <p class="discovery-game-tags">
       <b>Repack Size : </b>
       <span>{repackSize()}</span>
      </p>
      <p class="discovery-game-tags">
       <b>Original Size : </b>
       <span>{originalSize()}</span>
      </p>
     </div>
    </div>
   </div>
  </Show>
 );
}

export default HorizontalImageCarousel;
