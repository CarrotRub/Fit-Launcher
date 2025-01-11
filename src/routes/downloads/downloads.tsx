import {
 globalTorrentsInfo,
 setGlobalTorrentsInfo,
} from "@/store/global.store";
import type { GlobalState } from "@/types";
import { makePersisted } from "@solid-primitives/storage";
import { invoke } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import { message } from "@tauri-apps/plugin-dialog";
import { mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import PauseIcon from "lucide-solid/icons/pause";
import PlayIcon from "lucide-solid/icons/play";
import {
 type Accessor,
 createEffect,
 createSignal,
 For,
 onMount,
} from "solid-js";
import { Dynamic, render } from "solid-js/web";
import BasicChoicePopup from "../../Pop-Ups/Basic-Choice-PopUp/Basic-Choice-PopUp";
import "./downloads.css";

const appDir = await appDataDir();

export default function DownloadsPage() {
 const [downloadingTorrents, setDownloadingTorrents] = createSignal<any[]>([]);
 const [torrentStats, setTorrentStats] = createSignal<Record<string, any>>({});
 const [toDeleteTorrentIdxList, setToDeleteTorrentIdxList] = createSignal<
  any[]
 >([]);

 function handleCheckboxChange(torrentIdx: any, isChecked: boolean) {
  setToDeleteTorrentIdxList((prevList: any[]) =>
   isChecked
    ? [...prevList, torrentIdx]
    : prevList.filter(idx => idx != torrentIdx),
  );

  console.warn(toDeleteTorrentIdxList(), torrentIdx);
 }

 function deleteSelectedGames() {
  const torrentIdxList = toDeleteTorrentIdxList();
  if (!torrentIdxList.length) {
   console.log("No torrents selected for deletion.");
   return;
  }

  const { torrents } = globalTorrentsInfo;

  torrents.forEach(async torrent => {
   const { torrentIdx } = torrent;
   if (torrentIdxList.includes(torrentIdx)) {
    await invoke("torrent_action_delete", { id: torrentIdx })
     .then(() => {
      console.log(`Deleted torrent with idx: ${torrentIdx}`);
     })
     .catch(error => {
      console.error(`Failed to delete torrent with idx: ${torrentIdx}`, error);
     });
   }
  });

  setGlobalTorrentsInfo(
   "torrents",
   torrents.filter(
    (torrent: any) => !torrentIdxList.includes(torrent.torrentIdx),
   ),
  );
  setDownloadingTorrents(
   torrents.filter(
    (torrent: any) => !torrentIdxList.includes(torrent.torrentIdx),
   ),
  );
  setToDeleteTorrentIdxList([]);
 }

 // Duplicate function `extractMainTitle`, which i removed because unused
 // src/routes/discovery/image-carousel.tsx
 // src/routes/download-game/download-game.tsx
 // src/routes/downloads/downloads.tsx
 // src/routes/gamehub/popular-games.tsx
 // src/routes/library/library.tsx

 function handleDeleteTorrents() {
  const torrentIdxList = toDeleteTorrentIdxList();
  const pageContent = document.querySelector(".downloads-page");

  if (!torrentIdxList.length) {
   render(
    () => (
     <BasicChoicePopup
      infoTitle={"Nothing to download"}
      infoMessage={"Nothing there"} // Pass the generated message
      infoFooter={""}
      action={null}
     />
    ),
    pageContent!,
   );
   return;
  }

  const gameTitles: string[] = [];

  downloadingTorrents().forEach(torrent => {
   const { torrentIdx } = torrent;
   if (torrentIdxList.includes(torrentIdx)) {
    gameTitles.push(
     torrent.torrentExternInfo?.title || `Unknown Title \n(idx: ${torrentIdx})`,
    );
   }
  });

  // const torrent = torrents.find((t) => t.torrentIdx === torrentIdx);
  // if (torrent) {
  //     gameTitles.push(torrent.torrentExternInfo?.gameTitle || `Unknown Title \n(idx: ${torrentIdx})`);
  // }

  // Create the message string
  const infoMessage = `The following games will be deleted:<br />${gameTitles.join("<br />- ")}`;

  render(
   () => (
    <BasicChoicePopup
     infoTitle={"Are you sure about that?"}
     infoMessage={infoMessage} // Pass the generated message
     infoFooter={""}
     action={deleteSelectedGames}
    />
   ),
   pageContent!,
  );
 }

 onMount(async () => {
  // try {
  //     // Read and parse the session.json file
  //     const sessionData = JSON.parse(await readTextFile(sessionJSON));
  //     const sessionInfoHashes = Object.values(sessionData.torrents).map(
  //         (torrent) => torrent.info_hash
  //     );

  //     // Filter globalTorrentsInfo to retain only torrents with matching info_hash
  //     const filteredTorrents = globalTorrentsInfo.torrents.filter((torrent) =>
  //         sessionInfoHashes.includes(torrent.torrentIdx)
  //     );

  //     // Update globalTorrentsInfo with the filtered torrents
  //     setGlobalTorrentsInfo((prev) => ({
  //         ...prev,
  //         torrents: filteredTorrents,
  //     }));

  //     // Update downloadingTorrents signal
  //     setDownloadingTorrents(filteredTorrents);
  // } catch (error) {
  //     console.error("Error during initialization:", error);
  // }

  setDownloadingTorrents(globalTorrentsInfo.torrents);
  // Fetch stats for each torrent
 });

 async function addGameToDownloadedGames(gameData: any) {
  // Removed unused variable `currentData`
  const userDownloadedGames = await join(
   appDir,
   "library",
   "downloadedGames",
   "downloaded_games.json",
  );

  // Ensure the directory exists
  try {
   let toDownloadDirPath = await join(appDir, "library", "downloadedGames");
   await mkdir(toDownloadDirPath, { recursive: true });
  } catch (error) {
   console.error("Error creating directory:", error);
  }

  // Read and parse the current file contents
  let fileContent = [];
  try {
   const existingData = await readTextFile(userDownloadedGames);
   fileContent = JSON.parse(existingData) || [];
  } catch (error) {
   console.warn("File does not exist or is empty. Creating a new one.");
  }

  // Ensure the content is an array
  if (!Array.isArray(fileContent)) {
   throw new Error("File content is not an array, cannot append.");
  }

  // CHECK FOR DUPLICATES HERE
  // Use a unique property to identify if the game is already in the file.
  const alreadyInIndex = fileContent.findIndex(
   item => item.torrentIdx === gameData.torrentIdx,
  );

  if (alreadyInIndex === -1) {
   // Only push to the array if it's not already there
   fileContent.push(gameData);

   // Write the updated array back to the file
   await writeTextFile(
    userDownloadedGames,
    JSON.stringify(fileContent, null, 2),
   );
   console.log("New data appended successfully!");
  } else {
   console.log(
    `Game with torrentIdx "${gameData.torrentIdx}" already in downloaded_games.json`,
   );
  }
 }

 onMount(async () => {
  const intervals = new Map(); // Map to keep track of intervals for each torrentIdx
  console.log(intervals);
  // Iterate over downloading torrents
  downloadingTorrents().forEach(torrent => {
   const { torrentIdx } = torrent;
   // Avoid creating multiple intervals for the same torrentIdx
   if (!intervals.has(torrentIdx)) {
    const intervalId = setInterval(async () => {
     try {
      // Fetch stats and update reactively
      if (torrentIdx) {
       const stats = await invoke<any>("torrent_stats", { id: torrentIdx });

       // Update stats reactively
       setTorrentStats(prevStats => {
        return {
         ...prevStats,
         [torrentIdx]: {
          ...prevStats[torrentIdx],
          ...stats,
         },
        };
       });

       if (stats.finished) {
        try {
         await addGameToDownloadedGames(torrent);
        } catch (error) {
         console.error("Error adding games to downloaded games :", error);
        }

        // Clear the interval for the finished torrent
        clearInterval(intervalId);
        intervals.delete(torrentIdx);

        console.log("This torrent is done:", torrentIdx);

        // Remove the finished torrent
        setGlobalTorrentsInfo("torrents", (prevTorrents: any) =>
         prevTorrents.filter(
          (torrent: any) => torrent.torrentIdx !== torrentIdx,
         ),
        );

        setDownloadingTorrents(prevTorrents =>
         prevTorrents.filter(torrent => torrent.torrentIdx !== torrentIdx),
        );

        let install_settings = await invoke<Record<string, any>>(
         "get_installation_settings",
        );

        if (install_settings.auto_install) {
         await invoke("run_automate_setup_install", { id: torrentIdx });
         await invoke("torrent_action_forget", { id: torrentIdx });
        }
       }
      }
     } catch (error) {
      console.error(`Error fetching stats for torrent ${torrentIdx}:`, error);
     }
    }, 500); // Fetch stats every 500ms

    intervals.set(torrentIdx, intervalId);
   }
  });
 });

 createEffect(() => {
  console.warn(downloadingTorrents());
 });

 return (
  <div class="downloads-page content-page">
   <div class="downloads-page-action-bar">
    <button
     class="downloads-page-delete-all"
     onclick={handleDeleteTorrents}
    ></button>
   </div>
   {downloadingTorrents().length > 0 &&
   Object.keys(torrentStats()).length > 0 ? (
    <For each={downloadingTorrents()}>
     {torrent => (
      <Dynamic
       component={DownloadingGameItem}
       torrent={torrent}
       stats={torrentStats}
       onCheckboxChange={handleCheckboxChange}
      />
     )}
    </For>
   ) : (
    <div class="no-downloads">Nothing is currently downloading...</div>
   )}
  </div>
 );
}

interface DownloadingGameItemProps {
 torrent: Record<string, any>;
 stats: Accessor<Record<string, any>>;
 onCheckboxChange: (torrentIdx: any, isChecked: boolean) => void;
}

function DownloadingGameItem({
 torrent,
 stats,
 onCheckboxChange,
}: DownloadingGameItemProps) {
 const torrentStats = () => stats()[torrent.torrentIdx] || {};
 const [gamePercentage, setGamePercentage] = makePersisted(
  createSignal<string>("0.5%"),
 );
 const [torrentState, setTorrentState] =
  createSignal<GlobalState>("initializing");

 createEffect(async () => {
  let percentage =
   (torrentStats().progress_bytes / torrentStats().total_bytes) * 100;

  setGamePercentage(percentage.toFixed(1) + "%");
  setTorrentState(torrentStats().state);

  if (torrentStats().error) {
   await message(torrentStats().error, { title: "FitLauncher", kind: "error" });
  }
 }, torrentStats());

 return (
  <div class="downloading-game-item" data-torrent-idx={torrent.torrentIdx}>
   <div class="downloading-main-info-game">
    <img
     class="downloading-game-image"
     src={torrent.torrentExternInfo.img}
     alt={torrent.torrentExternInfo.title}
    />
    <div class="downloading-game-title">
     <p style={`max-width: 30ch;`}>{torrent.torrentExternInfo.title}</p>
    </div>
   </div>
   <div class="downloading-secondary-info-game">
    <div class="downloading-download-info">
     <div class="downloading-download-info-upload-speed">
      <p
       style={{ color: "var(--non-selected-text-color)", "font-size": "14px" }}
      >
       UPLOAD
      </p>
      <p style={{ "font-size": "16px" }}>
       <b>{torrentStats()?.live?.upload_speed?.human_readable}</b>
      </p>
     </div>
     <div class="downloading-download-info-download-speed">
      <p
       style={{ color: "var(--non-selected-text-color)", "font-size": "14px" }}
      >
       DOWNLOAD
      </p>
      <p style={{ "font-size": "16px", margin: 0, padding: 0 }}>
       <b>{torrentStats()?.live?.download_speed?.human_readable}</b>
      </p>
     </div>
    </div>
    <div class="downloading-download-bar-container">
     <div class="downloading-download-bar-info-container">
      <p>
       {torrentStats()?.finished ? (
        "Done"
       ) : torrentStats()?.live?.time_remaining ? (
        <>
         <b>{torrentStats().live.time_remaining.human_readable}</b>
         <span style={{ color: "var(--non-selected-text-color)" }}>
          {" "}
          remaining
         </span>
        </>
       ) : (
        "Nothing"
       )}
      </p>
      <p class="downloading-download-bar-download-percentage">
       {gamePercentage()} DOWNLOADED
      </p>
     </div>
     <div class="downloading-download-bar">
      <div
       class="downloading-download-bar-active"
       style={{
        width: gamePercentage(),
       }}
      ></div>
     </div>
    </div>
    <Dynamic
     component={ActionButtonDownload}
     gameState={torrentState}
     torrentStats={torrentStats}
     torrentIdx={torrent.torrentIdx}
    />
    <label class="custom-checkbox-download">
     <input
      type="checkbox"
      onchange={event =>
       onCheckboxChange(torrent.torrentIdx, event.target.checked)
      }
     />
     <span class="checkbox-mark-download"></span>
    </label>
   </div>
  </div>
 );
}

interface ActionButtonDownloadProps {
 gameState: () => GlobalState;
 torrentStats: Accessor<Record<string, any>>;
 torrentIdx: Accessor<number>;
}

function ActionButtonDownload({
 gameState,
 torrentStats,
 torrentIdx,
}: ActionButtonDownloadProps) {
 const [buttonColor, setButtonColor] = createSignal<string>(
  "var(--secondary-color)",
 );
 // Bellerof: What's this for?
 const [globalState, setGlobalState] = createSignal<GlobalState>(gameState());
 const [gameDone, setGameDone] = createSignal<boolean>(false);

 async function handleTorrentAction() {
  try {
   if (globalState() === "live" && !gameDone()) {
    await invoke("torrent_action_pause", { id: torrentIdx });
   } else if (globalState() === "paused" && !gameDone()) {
    await invoke("torrent_action_start", { id: torrentIdx });
   } else if (globalState() === "initializing" && !gameDone()) {
    console.log("nothing");
   } else if (gameDone()) {
    console.log("already done");
   } else {
    await message(torrentStats()?.error, {
     title: "FitLauncher",
     kind: "error",
    });
   }
  } catch (error) {
   console.error(`Failed to pause/resume torrent ${torrentIdx()}:`, error);
  }
 }

 // React to changes in gameState
 createEffect(() => {
  const state = gameState();
  setGlobalState(state);

  switch (state) {
   case "live":
    setButtonColor("var(--secondary-color)");
    break;
   case "paused":
    setButtonColor("var(--resume-button-accent-color)");
    break;
   case "initializing":
    setButtonColor("var(--non-selected-text-color)");
    break;
   default:
    setButtonColor("red");
  }
 });

 createEffect(() => {
  const gameStats = torrentStats();
  setGameDone(gameStats.finished);
  if (gameStats.finished) {
   console.log("done");
   setButtonColor("var(--primary-color)");
  }
 });

 return (
  <button
   class="downloading-action-button"
   onclick={() => handleTorrentAction()}
   style={{
    "background-color": buttonColor(),
   }}
  >
   {globalState() === "paused" && !gameDone() ? (
    <>
     <PlayIcon />
     <p>RESUME</p>
    </>
   ) : globalState() === "live" && !gameDone() ? (
    <>
     <PauseIcon />
     <p>PAUSE</p>
    </>
   ) : globalState() === "initializing" && !gameDone() ? (
    "INITIALIZING..."
   ) : gameDone() ? (
    "DONE"
   ) : (
    "ERROR"
   )}
  </button>
 );
}
