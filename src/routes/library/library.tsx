import { setDownloadGamePageInfo } from "@/store/global.store";
import {} from "@tauri-apps/api";
import { invoke } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import { message } from "@tauri-apps/plugin-dialog";
import * as fs from "@tauri-apps/plugin-fs";
import { mkdir, writeTextFile } from "@tauri-apps/plugin-fs";
import {
 type DragEvent,
 type Id,
 closestCenter,
 createSortable,
 DragDropProvider,
 DragDropSensors,
 DragOverlay,
 SortableProvider,
 useDragDropContext,
} from "@thisbeyond/solid-dnd";
import ArrowUpNarrowWide from "lucide-solid/icons/arrow-up-narrow-wide";
import BookmarkPlus from "lucide-solid/icons/bookmark-plus";
import CalendarClock from "lucide-solid/icons/calendar-clock";
import CalendarDays from "lucide-solid/icons/calendar-days";
import FileIcon from "lucide-solid/icons/file";
import GripVertical from "lucide-solid/icons/grip-vertical";
import ListPlus from "lucide-solid/icons/list-plus";
import ListX from "lucide-solid/icons/list-x";
import SettingsIcon from "lucide-solid/icons/settings";
import TrashIcon from "lucide-solid/icons/trash-2";
import { createEffect, createSignal, For, onMount } from "solid-js";
import { render } from "solid-js/web";
import AddLocalGamePopUp from "../../Pop-Ups/Add-Local-Game-PopUp/Add-Local-Game-PopUp";
import BasicAddToCollectionPopup from "../../Pop-Ups/Basic-AddToCollection-PopUp/Basic-AddToCollection-PopUp";
import BasicChoicePopup from "../../Pop-Ups/Basic-Choice-PopUp/Basic-Choice-PopUp";
import BasicPathInputPopup from "../../Pop-Ups/Basic-PathInput-PopUp/Basic-PathInput-PopUp";
import BasicTextInputPopup from "../../Pop-Ups/Basic-TextInput-PopUp/Basic-TextInput-PopUp";
import GameSettingsLibraryPopUp from "../../Pop-Ups/Library-Game-Settings-PopUp/Game-Settings";
import "./library.css";

const appDir = await appDataDir();
const dirPath = appDir;

// Global signal to store file contents

async function userToDownloadGamesPath() {
 return await join(dirPath, "library");
}

async function userCollectionPath() {
 return await join(dirPath, "library", "collections");
}

async function userDownloadedGamesPath() {
 return await join(dirPath, "library", "downloadedGames");
}

export default function LibraryPage() {
 const [collectionList, setCollectionList] = createSignal<Record<string, any>>(
  {},
 );
 const [downloadedGamesList, setDownloadedGamesList] = createSignal<
  Record<string, any>
 >({});

 onMount(async () => {
  try {
   const libraryPath = await userToDownloadGamesPath();
   const files = await fs.readDir(libraryPath);

   const contents: Record<string, any> = {};
   for (const file of files) {
    if (file.isFile) {
     const filePathToFile = await join(libraryPath, file.name);
     const fileContent = await fs.readTextFile(filePathToFile);
     const fileName = file.name.split(".")[0]; // Remove file extension
     contents[fileName] = JSON.parse(fileContent);
    }
   }

   setCollectionList(prevList => ({
    ...prevList,
    ...contents,
   }));
  } catch (error) {
   await message(error as any, { title: "FitLauncher", kind: "error" });
  }

  try {
   const collectionPath = await userCollectionPath();
   const files = await fs.readDir(collectionPath);

   const contents: Record<string, any> = {};
   for (const file of files) {
    if (file.isFile) {
     const filePathToFile = await join(collectionPath, file.name);
     const fileContent = await fs.readTextFile(filePathToFile);
     const fileName = file.name.split(".")[0]; // Remove file extension
     contents[fileName] = JSON.parse(fileContent);
    }
   }

   setCollectionList(prevList => ({
    ...prevList,
    ...contents,
   }));
  } catch (error) {
   await message(error as any, { title: "FitLauncher", kind: "error" });
  }

  try {
   const downloadedGamesPath = await userDownloadedGamesPath();
   const fullPath = await join(downloadedGamesPath, "downloaded_games.json");

   const fileContent = await fs.readTextFile(fullPath);
   const downloadedGames = JSON.parse(fileContent);

   setCollectionList(prevList => ({
    ...prevList,
    downloaded_games: downloadedGames,
   }));

   setDownloadedGamesList(downloadedGames);
  } catch (error) {
   await message(error as any, { title: "FitLauncher", kind: "error" });
  }
 });

 async function createNewColletion(collectionName: string) {
  console.log(collectionName);
  if (collectionName.length < 30 && collectionName.length > 2) {
   const libraryPath = await userCollectionPath();
   let cleanCollectionName =
    collectionName.toLowerCase().replace(/\s+/g, "_") + ".json";
   let cleanCollectioNameOnList = collectionName
    .toLowerCase()
    .replace(/\s+/g, "_");
   const collectionFilePath = `${libraryPath}/${cleanCollectionName}`;
   try {
    await mkdir(libraryPath, { recursive: true });
    await writeTextFile(collectionFilePath, "[]");
    setCollectionList(prevList => ({
     ...prevList,
     [cleanCollectioNameOnList]: { [cleanCollectioNameOnList]: {} },
    }));
    window.location.reload();
   } catch (error) {
    await message(`error creating collection: ${error})`, {
     title: "Collection Creation",
     kind: "error",
    });
   }
  } else {
   await message(
    `Name too long (Over 30 characters) or too small (2 characters or less)`,
    { title: "Collection Creation", kind: "error" },
   );
  }
 }

 function handleCreateNewCollection() {
  const pageContent = document.querySelector(".library");
  render(
   () => (
    <BasicTextInputPopup
     infoTitle={"Create a new collection !"}
     infoMessage={"How do you want to name your Collection ?"}
     infoPlaceholder={"Best Games 2024..."}
     infoFooter={""}
     action={createNewColletion}
    />
   ),
   pageContent!,
  );
 }
 async function handleAddLocalGame() {
  const pageContent = document.querySelector(".library");

  render(
   () => (
    <AddLocalGamePopUp
     infoTitle={"Are you sure you want to run this Game"}
     infoMessage={`Do you want to start playing ?`}
     infoFooter={""}
     action={null}
    />
   ),
   pageContent!,
  );
 }
 return (
  <div class="library content-page">
   <div class="library-sidebar">
    <button
     class="library-create-collection-button"
     onclick={handleCreateNewCollection}
    >
     <ListPlus stroke="var(--primary-color)" />

     <p>New Collection</p>
    </button>
    <For each={Object.keys(collectionList())}>
     {collectionKey => (
      <CollectionList
       collectionGamesList={collectionList()[collectionKey]}
       collectionName={collectionKey}
      />
     )}
    </For>
   </div>
   <div class="library-content-games">
    <div class="library-content-options-bar">
     {/* Here we will also add next update a second way to display the games. */}
     <svg
      onclick={async () => {
       await handleAddLocalGame();
      }}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--primary-color)"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="lucide lucide-diamond-plus"
     >
      <path d="M12 8v8m-9.3-5.7a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0zM8 12h8" />
     </svg>
    </div>
    {collectionList()["downloaded_games"]?.length > 0 ? (
     <GameDownloadedItem
      downloadedGamesList={collectionList()["downloaded_games"]}
      collectionsList={collectionList()}
     />
    ) : (
     <p>No Games Downloaded</p>
    )}
   </div>
  </div>
 );
}

interface GameDownloadedItemProps {
 downloadedGamesList: any[];
 collectionsList: Record<string, any>;
}
function GameDownloadedItem({
 downloadedGamesList,
 collectionsList,
}: GameDownloadedItemProps) {
 const [dynamicDownloadedGamesList, setDynamicDownloadedGamesList] =
  createSignal<any[]>(downloadedGamesList);
 const [executableGamePath, setExecutableGamePath] = createSignal<string>("");
 const [gamesListContent, setGamesListContent] = createSignal<any[]>([]);
 const [installSettings, setInstallSettings] = createSignal<any | null>(null);
 const [activeItem, setActiveItem] = createSignal(null);
 onMount(() => {
  console.log(collectionsList);
 });

 onMount(async () => {
  const userPath = await userDownloadedGamesPath();
  const downloadedGamesPath = await join(userPath, "downloaded_games.json");
  const settingsPath = await join(
   appDir,
   "fitgirlConfig",
   "settings",
   "installation",
   "installation.json",
  );
  const settingsContent = await fs.readTextFile(settingsPath);
  const settings = JSON.parse(settingsContent);

  setInstallSettings(settings);
  let updatedGamesList = await Promise.all(
   downloadedGamesList.map(async (game: any, index: number) => {
    const executableInfo = game?.executableInfo;
    const executableInfoPath = game?.executableInfo?.executable_path;

    if (!executableInfo) {
     console.warn("ExecutableInfo doesn't exist. Initializing...");
     pushDefaultExecutableInfo(game);

     try {
      const fileContent = await fs.readTextFile(downloadedGamesPath);
      const contents = JSON.parse(fileContent) || [];
      contents[index] = game;
      await fs.writeTextFile(
       downloadedGamesPath,
       JSON.stringify(contents, null, 2),
      );
     } catch (error) {
      if (error instanceof Error && error.message.includes("File not found")) {
       console.warn("File not found. Initializing a new one.");
      } else {
       await message(error as any, { title: "FitLauncher", kind: "error" });
       throw error;
      }
     }
     return game;
    } else if (executableInfoPath?.length > 0) {
     try {
      await getExecutableInfo(executableInfoPath, game?.torrentOutputFolder);
     } catch (error) {
      await message(error as any, { title: "FitLauncher", kind: "error" });
     }
    }

    return game;
   }),
  );

  setDynamicDownloadedGamesList(updatedGamesList);
 });

 function pushDefaultExecutableInfo(game: any) {
  game.executableInfo = {
   executable_path: "",
   executable_last_opened_date: null,
   executable_play_time: 0,
   executable_installed_date: null,
   executable_disk_size: 0,
  };
 }

 async function getExecutableInfo(game_path: string, torrentFolder: string) {
  let strippedTorrentFolder = torrentFolder.replace(" [FitGirl Repack]", "");
  let executable_info = await invoke("executable_info_discovery", {
   pathToExe: game_path,
   pathToFolder: strippedTorrentFolder,
  });
  return executable_info;
 }

 /**
  * This is a specific version of the regex that allows Editions in the title.
  * @param {*} title
  * @returns simplifiedTitle
  */
 function extractMainTitle(title: string) {
  const simplifiedTitle = title
   ?.replace(/\s*[:\-]\s*$/, "")
   ?.replace(/\(.*?\)/g, "")
   ?.replace(/\s*[:\–]\s*$/, "") // Clean up any trailing colons or hyphens THIS IS A FKCNG EN DASH AND NOT A HYPHEN WTF
   ?.replace(/[\–].*$/, "");

  return simplifiedTitle;
 }

 async function writeExecutableInfo(gameObj: any, executableInfo: any) {
  const userPath = await userDownloadedGamesPath();
  const downloadedGamesPath = await join(userPath, "downloaded_games.json");

  try {
   // Read the existing downloaded games file
   const fileContent = await fs.readTextFile(downloadedGamesPath);
   const gamesList = JSON.parse(fileContent);

   // Update the specific game with the new executable info
   const gameIndex = gamesList.findIndex(
    (game: any) =>
     game?.torrentExternInfo?.title === gameObj?.torrentExternInfo?.title,
   );

   if (gameIndex !== -1) {
    gamesList[gameIndex].executableInfo = executableInfo;

    // Write the updated list back to the file
    await fs.writeTextFile(
     downloadedGamesPath,
     JSON.stringify(gamesList, null, 2),
    );
    console.log("Executable info updated successfully!");
   } else {
    console.warn("Game not found in the downloaded games list.");
   }
  } catch (error) {
   await message(error as any, { title: "FitLauncher", kind: "error" });
  }
 }

 async function getExecutablePath(gameObj: any) {
  async function addNewPathToFile(path: string) {
   try {
    const executableInfo = await getExecutableInfo(
     path,
     gameObj?.torrentOutputFolder?.replace(" [FitGirl Repack]", ""),
    ); // Fetch executable info
    await writeExecutableInfo(gameObj, executableInfo); // Save to file
    if (installSettings()?.auto_clean) {
     await message(
      "The game installation folder is getting deleted automatically, if you want to disable that, go to settings.",
      { title: "FitLauncher", kind: "warning" },
     );
     try {
      await invoke("delete_game_folder_recursively", {
       folderPath: gameObj?.torrentOutputFolder,
      });
      await message(
       "The game installation folder has been deleted successfully.",
       { title: "FitLauncher", kind: "info" },
      );
      window.location.reload();
     } catch (error) {
      await message(error as any, { title: "FitLauncher", kind: "error" });
     }
    }
    window.location.reload();
   } catch (error) {
    await message(error as any, { title: "FitLauncher", kind: "error" });
   }
  }
  const pageContent = document.querySelector(".library");

  render(
   () => (
    <BasicPathInputPopup
     infoTitle={"Select your game's executable file !"}
     infoMessage={
      "Here, you'll have to choose the file where your game has been installed.<br /> E.g : If you installed Elden Ring it will probably be in the Elden Ring file and there will be .exe file, just choose it :)"
     }
     infoPlaceholder={"Executable Path"}
     defaultPath={gameObj?.torrentOutputFolder?.replace(
      " [FitGirl Repack]",
      "",
     )}
     fileType={["exe"]}
     multipleFiles={false}
     isDirectory={false}
     infoFooter={""}
     action={addNewPathToFile}
    />
   ),
   pageContent!,
  );
 }

 async function handleStartGame(executablePath: string) {
  const pageContent = document.querySelector(".library");
  try {
   async function runGame(executablePath: string) {
    await invoke("start_executable", { path: executablePath });
   }

   render(
    () => (
     <BasicChoicePopup
      infoTitle={"Are you sure you want to run this Game"}
      infoMessage={`Do you want to start playing ?`}
      infoFooter={""}
      action={() => runGame(executablePath)}
     />
    ),
    pageContent!,
   );
  } catch (error) {
   await message(error as any, { title: "FitLauncher", kind: "error" });
  }
 }

 async function handleAddToCollections(gameObj: any) {
  const pageContent = document.querySelector(".library");
  function checkIfUserCreatedCollection(collectionName: string) {
   console.log(collectionName);
   return (
    collectionName !== "downloaded_games" &&
    collectionName !== "games_to_download"
   );
  }
  let possible_collections = Object.entries(collectionsList)
   .filter(([key, value]) => checkIfUserCreatedCollection(key))
   .reduce((acc: Record<string, any>, [key, value]) => {
    acc[key] = value;
    return acc;
   }, {});
  if (Object.keys(possible_collections).length > 0) {
   try {
    render(
     () => (
      <BasicAddToCollectionPopup
       infoTitle={"Where do you want to add this game ?"}
       infoMessage={`Which collection do you think will be the one ?`}
       collectionsList={collectionsList}
       gameObjectInfo={gameObj}
      />
     ),
     pageContent!,
    );
   } catch (error) {
    await message(error as any, { title: "FitLauncher", kind: "error" });
   }
  } else {
   await message("You do not have any collections, please create one.", {
    title: "FitLauncher",
    kind: "warning",
   });
  }
 }

 async function handleChangeSettings(gameObj: any) {
  const pageContent = document.querySelector(".library");
  try {
   render(
    () => (
     <GameSettingsLibraryPopUp
      infoTitle={"Handle the settings of your game !"}
      infoMessage={
       "Here, you'll be able to change the settings of your game, feel free to do it :)"
      }
      infoPlaceholder={"Executable Path"}
      defaultPath={gameObj?.torrentOutputFolder?.replace(
       " [FitGirl Repack]",
       "",
      )}
      fileType={["exe"]}
      multipleFiles={false}
      isDirectory={false}
      infoFooter={""}
      userGame={gameObj}
     />
    ),
    pageContent!,
   );
  } catch (error) {
   await message(error as any, { title: "FitLauncher", kind: "error" });
  }
 }

 createEffect(() => {
  console.log(dynamicDownloadedGamesList());

  const syncDownloadedGames = async () => {
   const userPath = await userDownloadedGamesPath();
   const downloadedGamesPath = await join(userPath, "downloaded_games.json");

   // Write to the file
   await fs.writeTextFile(
    downloadedGamesPath,
    JSON.stringify(dynamicDownloadedGamesList(), null, 2),
   );
  };

  // Call the function inside createEffect
  syncDownloadedGames().catch(error => {
   console.error("Error syncing downloaded games:", error);
  });
 });

 const ids = () =>
  dynamicDownloadedGamesList().map(game => game.torrentExternInfo.title);

 const onDragStart = ({ draggable }: { draggable: any }) =>
  setActiveItem(draggable.id);

 const onDragEnd = (event: DragEvent) => {
  if (event.draggable && event.droppable) {
   const currentItems = dynamicDownloadedGamesList();
   const fromIndex = currentItems.findIndex(
    item => item.torrentExternInfo.title == event.draggable.id,
   );
   const toIndex = currentItems.findIndex(
    item => item.torrentExternInfo.title == event.droppable!.id,
   );

   if (fromIndex != toIndex) {
    const updatedItems = [...currentItems];
    updatedItems.splice(toIndex, 0, ...updatedItems.splice(fromIndex, 1));
    setDynamicDownloadedGamesList(updatedItems);
   }
  }
  setActiveItem(null);
 };

 interface SortableGameItemProps {
  itemId: Id;
  game: any;
 }

 function SortableGameItem(props: SortableGameItemProps) {
  const sortable = createSortable(props.itemId);
  const game = props.game;
  const [state] = useDragDropContext()!;
  return (
   <li
    // @ts-ignore
    // Bellerof: Are you sure you have set up this correctly?
    use:sortable
    class="library-content-list-game-item"
    classList={{
     "opacity-25": sortable.isActiveDraggable,
     "transition-transform": !!state.active?.draggable,
    }}
   >
    <GripVertical
     class="draggable-svg"
     stroke="var(--primary-color)"
     onmousedown={event => event.stopPropagation()}
    />
    <img
     class="library-content-list-game-item-image"
     src={game?.torrentExternInfo?.img}
     alt="Game Cover"
    />
    <p class="library-content-list-game-item-title">
     {extractMainTitle(game?.torrentExternInfo?.title)}
    </p>
    {game?.executableInfo?.executable_path ? (
     <button
      class="library-content-list-game-item-button"
      style={`background-color: var(--accent-color)`}
      onclick={() => handleStartGame(game?.executableInfo?.executable_path)}
     >
      <p>PLAY</p>
     </button>
    ) : (
     <button
      class="library-content-list-game-item-button"
      style={`background-color: var(--warning-orange)`}
      onclick={async () => await getExecutablePath(game)}
     >
      <p>ADD PATH</p>
     </button>
    )}

    <div class="library-content-list-game-item-game-options">
     <button
      onclick={async () => {
       await handleAddToCollections(game);
      }}
     >
      <BookmarkPlus stroke="var(--accent-color)" />
     </button>
     <button
      onclick={async () => {
       await handleChangeSettings(game);
      }}
     >
      <SettingsIcon stroke="var(--accent-color)" />
     </button>
    </div>
    <ul class="library-content-list-game-item-executable-info">
     <li class="library-content-list-game-item-executable-info-container">
      <CalendarDays stroke="var(--text-color)" />
      <div class="library-content-list-game-item-executable-info-text">
       <p class="library-content-list-game-item-executable-info-text-title">
        Last Played
       </p>
       <p>
        <b>
         {game?.executableInfo?.executable_last_opened_date?.replace(
          /-/g,
          "/",
         ) || "N/A"}
        </b>
       </p>
      </div>
     </li>
     <li class="library-content-list-game-item-executable-info-container">
      <CalendarClock stroke="var(--text-color)" />
      <div class="library-content-list-game-item-executable-info-text">
       <p class="library-content-list-game-item-executable-info-text-title">
        Installed Date
       </p>
       <p>
        <b>
         {game?.executableInfo?.executable_installed_date?.replace(/-/g, "/") ||
          "N/A"}
        </b>
       </p>
      </div>
     </li>
     <li class="library-content-list-game-item-executable-info-container">
      <FileIcon stroke="var(--text-color)" />
      <div class="library-content-list-game-item-executable-info-text">
       <p class="library-content-list-game-item-executable-info-text-title">
        Disk Size
       </p>
       <p>
        <b>
         {game?.executableInfo?.executable_disk_size
          ? game.executableInfo.executable_disk_size / 1024 ** 3 >= 1
            ? (game.executableInfo.executable_disk_size / 1024 ** 3).toFixed(
               2,
              ) + " GB"
            : (game.executableInfo.executable_disk_size / 1024 ** 2).toFixed(
               2,
              ) + " MB"
          : "N/A"}
        </b>
       </p>
      </div>
     </li>
     <li class="library-content-list-game-item-executable-info-container">
      <div class="library-content-list-game-item-executable-info-text">
       <p class="library-content-list-game-item-executable-info-text-title">
        Play Time
       </p>
       <p>
        <b>{game?.executableInfo?.executable_play_time || "N/A"}</b>
       </p>
      </div>
     </li>
    </ul>
   </li>
  );
 }

 return (
  <DragDropProvider
   onDragStart={onDragStart}
   onDragEnd={onDragEnd}
   collisionDetector={closestCenter}
  >
   <DragDropSensors />
   <SortableProvider ids={ids()}>
    <ul class="library-content-list-games self-stretch">
     <For each={dynamicDownloadedGamesList()}>
      {game => (
       <SortableGameItem itemId={game.torrentExternInfo.title} game={game} />
      )}
     </For>
    </ul>
   </SortableProvider>
   <DragOverlay children={<></>} />
  </DragDropProvider>
 );
}

interface CollectionListProps {
 collectionGamesList: Record<string, any>;
 collectionName: string;
}

function CollectionList({
 collectionGamesList,
 collectionName,
}: CollectionListProps) {
 const [gamesList, setGamesList] = createSignal<any[]>();
 const [clicked, setClicked] = createSignal(false);
 const [isExpanded, setIsExpanded] = createSignal(true);

 const toggleExpand = () => {
  setIsExpanded(!isExpanded());
 };

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
 function formatKeyName(key: string) {
  return key
   .split("_")
   .map(word => word.charAt(0).toUpperCase() + word.slice(1) + " ");
 }

 const handleGameClick = (title: string, filePath: string, href: string) => {
  console.log(collectionName);
  if (!clicked() && collectionName === "games_to_download") {
   console.log(href);
   setClicked(true);
   const uuid = crypto.randomUUID();
   console.log(href);
   //TODO: Here use createStore
   setDownloadGamePageInfo({
    gameTitle: title,
    gameHref: href,
    filePath: filePath,
   });
   window.location.href = `/game/${uuid}`;
  }
 };

 onMount(() => {
  if (collectionGamesList) {
   //Array of Objects
   const games = Object.values(collectionGamesList) || [];
   setGamesList(games);
  }
 });

 async function handleGameRemove(originalGame: any) {
  console.warn(originalGame);
  if (collectionName === "games_to_download") {
   const libraryPath = await userToDownloadGamesPath();
   const libFilePath = await join(libraryPath, "games_to_download.json");

   const fileContent = await fs.readTextFile(libFilePath);
   let gamesList = JSON.parse(fileContent);

   const updatedGamesList = gamesList.filter(
    (game: any) => game.title !== originalGame.title,
   );
   try {
    console.warn(updatedGamesList);
    await writeTextFile(libFilePath, JSON.stringify(updatedGamesList, null, 2)); // Pretty-print with indentation
    await message("Game has been removed from collection", {
     title: "FitLauncher",
     kind: "info",
    });
    window.location.reload();
   } catch (error) {
    await message(error as any, {
     title: "FitLauncher",
     kind: "error",
    });
   }
  } else if (collectionName === "downloaded_games") {
   await message("Can't remove a downloaded game", {
    title: "Game Removal",
    kind: "warning",
   });
  } else {
   const libraryPath = await userCollectionPath();
   const specificName = collectionName + ".json";
   const libFilePath = await join(libraryPath, specificName);

   const fileContent = await fs.readTextFile(libFilePath);
   let gamesList = JSON.parse(fileContent);

   const updatedGamesList = gamesList.filter(
    (game: any) => game.title !== originalGame.title,
   );
   try {
    console.warn(updatedGamesList);
    await writeTextFile(libFilePath, JSON.stringify(updatedGamesList, null, 2)); // Pretty-print with indentation
    await message("Game has been removed from collection", {
     title: "FitLauncher",
     kind: "info",
    });
    window.location.reload();
   } catch (error) {
    await message(error as any, {
     title: "FitLauncher",
     kind: "error",
    });
   }
  }
 }

 async function handleCollectionRemove() {
  if (collectionName === "games_to_download") {
   await message("Can't remove the games to download collection", {
    title: "Collection Removal",
    kind: "warning",
   });
  } else if (collectionName === "downloaded_games") {
   await message("Can't remove the downloaded games collection", {
    title: "Collection Removal",
    kind: "warning",
   });
  } else {
   const pageContent = document.querySelector(".library");
   async function collectionRemoval() {
    const libraryPath = await userCollectionPath();
    const specificName = collectionName + ".json";
    const libFilePath = await join(libraryPath, specificName);

    try {
     await fs.remove(libFilePath);
     await message("Collection has been removed", {
      title: "Collection Removal",
      kind: "info",
     });
     window.location.reload();
    } catch (error) {
     await message(error as any, {
      title: "FitLauncher",
      kind: "error",
     });
    }
   }

   render(
    () => (
     <BasicChoicePopup
      infoTitle={"Do you really want to remove this collection ?"}
      infoMessage={`You are going to remove ${collectionName} are you sure about that ?`}
      infoFooter={""}
      action={async () => await collectionRemoval()}
     />
    ),
    pageContent!,
   );
  }
 }

 return (
  <div class="library-collection-list">
   <div class="library-collection-list-title">
    <ArrowUpNarrowWide
     onclick={toggleExpand}
     style={{
      transform: isExpanded() ? "rotate(0deg)" : "rotate(180deg)",
      transition: "transform 0.2s ease",
     }}
     stroke="var(--primary-color)"
    />
    <p onclick={toggleExpand}>{formatKeyName(collectionName)}</p>

    <ListX
     stroke="var(--primary-color)"
     onclick={async () => await handleCollectionRemove()}
    />
   </div>
   {isExpanded() && (
    <ul class="library-collection-list-item">
     {gamesList()!.length > 0 ? (
      gamesList()!.map((game: any) => (
       <li class="library-collection-list-game-item">
        <img
         src={game?.img ?? game?.torrentExternInfo?.img}
         alt={extractMainTitle(game?.title ?? game?.torrentExternInfo?.title)}
         onclick={() =>
          handleGameClick(
           game?.title ?? game?.torrentExternInfo?.title,
           game?.filePath ?? game?.torrentExternInfo?.filePath,
           game?.href ?? game?.torrentExternInfo?.href,
          )
         }
        />
        <span
         style={{ "font-size": "1.2em", "font-weight": "bold" }}
         onclick={() =>
          handleGameClick(
           game?.title ?? game?.torrentExternInfo?.title,
           game?.filePath ?? game?.torrentExternInfo?.filePath,
           game?.href ?? game?.torrentExternInfo?.href,
          )
         }
        >
         {extractMainTitle(game?.title ?? game?.torrentExternInfo?.title)}
        </span>

        <TrashIcon
         stroke="var(--accent-color)"
         onclick={async () => {
          await handleGameRemove(game);
         }}
        />
       </li>
      ))
     ) : (
      <p>No games found</p>
     )}
    </ul>
   )}
  </div>
 );
}
