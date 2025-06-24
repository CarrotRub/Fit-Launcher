import { createSignal, onMount, For, Show } from "solid-js";
import { render } from "solid-js/web";
import { appDataDir, join } from "@tauri-apps/api/path";
import { mkdir, writeTextFile, readDir, readTextFile } from "@tauri-apps/plugin-fs";
import { message } from "@tauri-apps/plugin-dialog";

import AddLocalGamePopUp from "../../Pop-Ups/Add-Local-Game-PopUp/Add-Local-Game-PopUp";
import CollectionList from './CollectionList/CollectionList';
import GameDownloadedItem, { LayoutType } from "./GameDownloadedItem/GameDownloadedItem";
import {
  Plus,
  Gamepad2,
  LibraryBig,
  FolderPlus,
  PackagePlus,
  PackageCheck,
  ListCollapse,
  Grid2X2Plus
} from 'lucide-solid';
import Button from "../../components/UI/Button/Button";
import CreateBasicTextInputPopup from "../../Pop-Ups/Basic-TextInput-PopUp/Basic-TextInput-PopUp";
import { LibraryApi } from "../../api/library/api";
import { DownloadedGame, Game, GameCollection } from "../../bindings";
import createAddLocalGamePopup from "../../Pop-Ups/Add-Local-Game-PopUp/Add-Local-Game-PopUp";
import { GamesCacheApi } from "../../api/cache/api";

const libraryAPI = new LibraryApi();
const cacheAPI = new GamesCacheApi();

function Library() {
  const [collectionList, setCollectionList] = createSignal<Record<string, Game[]>>({});
  const [downloadedGamesList, setDownloadedGamesList] = createSignal<DownloadedGame[]>([]);
  const [layoutType, setLayoutType] = createSignal<LayoutType>("column");

  onMount(async () => {
    try {
      const [collections, downloadedGames, gamesToDownload] = await Promise.all([
        libraryAPI.getCollectionsList(),
        libraryAPI.getDownloadedGames(),
        libraryAPI.getGamesToDownload(), // ← Fetch it
      ]);

      const normalizedCollections: Record<string, Game[]> = {};

      for (const col of collections) {
        normalizedCollections[col.name] = col.games_list;
      }

      // Convert downloadedGames (DownloadedGame[]) → Game[]

      normalizedCollections["games_to_download"] = gamesToDownload;
      normalizedCollections["downloaded_games"] = downloadedGames;

      setCollectionList(normalizedCollections);
      setDownloadedGamesList(downloadedGames);
    } catch (err) {
      await message(`${err}`, { title: "FitLauncher", kind: "error" });
    }
  });




  async function createNewCollection(collectionName: string) {
    if (collectionName.length < 30 && collectionName.length > 2) {
      const cleanKey = collectionName.toLowerCase().replace(/\s+/g, "_");
      try {
        const res = await libraryAPI.createCollection(cleanKey, null);

        if (res.status === "ok") {
          setCollectionList(prev => ({
            ...prev,
            [cleanKey]: [],
          }));
        } else {
          throw res.error;
        }
      } catch (err) {
        await message(`Error creating collection: ${err}`, {
          title: "Collection Creation",
          kind: "error",
        });
      }
    } else {
      await message("Name too long or too short", {
        title: "Collection Creation",
        kind: "error",
      });
    }
  }




  function handleCreateNewCollection() {
    CreateBasicTextInputPopup({
      infoTitle: "Create a new collection !",
      infoMessage: "How do you want to name your Collection ?",
      value: "Best Games 2024...",
      infoFooter: "",
      action: createNewCollection,
    })
  }

  async function handleAddLocalGame() {
    createAddLocalGamePopup({
      infoTitle: "Which game do you want to add",
      infoMessage: "Choose your game here ! ?",
      infoFooter: "Beware, only Fitgirl Repack's games are supported !",
      action: async (game: DownloadedGame) => {
        const newGame = libraryAPI.gameToDownloadedGame(game);
        setDownloadedGamesList(prev =>
          prev.some(g => g.title === newGame.title) ? prev : [...prev, newGame]
        );
        setCollectionList(prev => {
          const existing = prev.downloaded_games ?? [];
          if (existing.some(g => g.title === newGame.title)) return prev;

          return {
            ...prev,
            downloaded_games: [...existing, newGame],
          };
        });
      },
    })
  }

  function getSortedCollections(): string[] {
    const keys = Object.keys(collectionList());

    const priority = ["downloaded_games", "games_to_download"];

    const sorted = [
      ...priority.filter(key => keys.includes(key)),
      ...keys.filter(key => !priority.includes(key)).sort(),
    ];

    return sorted;
  }

  return (
    <div class="library flex bg-gradient-to-br from-background to-background-70 text-text h-full">
      {/* Sidebar */}
      <div class="w-72 bg-popup/95 backdrop-blur-sm border-r border-secondary-30 p-5 flex flex-col space-y-5">
        <div class="flex items-center space-x-3 mb-6 px-2">
          <LibraryBig class="w-6 h-6 text-accent" />
          <h2 class="text-xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent font-titles">
            Game Library
          </h2>
        </div>

        {/* Collections */}
        <Button label="New Collection" onClick={handleCreateNewCollection} icon={<Plus class="w-5 h-5 transition-transform group-hover:rotate-90" />} />
        <div class="overflow-y-auto flex-1 custom-scrollbar border-secondary-20/50 border-t-1 py-2 pb-10 no-scrollbar">
          <div class="flex items-center justify-between text-muted/80 mb-3 px-2">
            <h3 class="text-xs uppercase tracking-wider font-semibold flex items-center font-titles">
              <ListCollapse class="w-4 h-4 mr-2" />
              Your Collections
            </h3>
            <span class="text-xs bg-secondary-20 px-2 py-1 rounded-full">
              {Object.keys(collectionList()).length}
            </span>
          </div>
          <div class="space-y-2">
            <For each={getSortedCollections()}>
              {(key) => (
                <CollectionList
                  collectionGamesList={() => collectionList()[key] ?? []}
                  collectionName={key}
                  onCollectionRemove={(name) => {
                    setCollectionList(prev => {
                      const copy = { ...prev };
                      delete copy[name];
                      return copy;
                    });
                  }}
                />
              )}
            </For>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div class="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div class="bg-popup/80 backdrop-blur-sm border-b border-secondary-20 p-4 flex justify-between items-center">
          <div class="flex items-center gap-1">
            <div class="relative flex items-center bg-secondary-20/30 rounded-lg p-1">
              <button
                title="Detailed Column View"
                class={`relative z-10 p-2 rounded-md transition-all duration-300 ${layoutType() === "column"
                  ? "text-accent"
                  : "text-muted hover:text-text"
                  }`}
                onClick={() => setLayoutType("column")}
              >
                <ListCollapse class="size-5" />
                <Show when={layoutType() === "column"}>
                  <div class="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-3/4 h-0.5 bg-accent rounded-full" />
                </Show>
              </button>

              <div class="h-5 w-px bg-secondary-20 mx-1" />

              <button
                title="Compact Grid View"
                class={`relative z-10 p-2 rounded-md transition-all duration-300 ${layoutType() === "row"
                  ? "text-accent"
                  : "text-muted hover:text-text"
                  }`}
                onClick={() => setLayoutType("row")}
              >
                <Grid2X2Plus class="size-5" />
                <Show when={layoutType() === "row"}>
                  <div class="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-3/4 h-0.5 bg-accent rounded-full" />
                </Show>
              </button>

              <div
                class={`absolute inset-0 bg-accent/10 rounded-md transition-all duration-300 ${layoutType() === "column" ? "left-0" : "left-1/2"
                  }`}
                style={{ width: "50%" }}
              />
            </div>
          </div>
          <div class="flex items-center space-x-2 font-titles">
            <Gamepad2 class="w-5 h-5 text-primary" />
            <h2 class="font-medium">My Games</h2>
          </div>
          <Button label="Add Game" icon={<FolderPlus class="w-4 h-4 group-hover:text-accent transition-colors" />} onClick={handleAddLocalGame} variant="bordered" size="sm" />
        </div>


        {/* Downloaded Games List */}
        <div class="flex-1 overflow-y-auto p-8 no-scrollbar h-full">
          {collectionList()["downloaded_games"]?.length > 0 ? (
            <div>
              <GameDownloadedItem
                downloadedGamesList={downloadedGamesList}
                onGameInfoUpdate={(title, info) => {
                  setDownloadedGamesList(prev =>
                    prev.map(g => g.title === title ? { ...g, executable_info: info } : g)
                  );
                }}
                onGameDelete={(title) => {
                  setDownloadedGamesList(prev => prev.filter(g => g.title !== title));
                  setCollectionList(prev => {
                    const updated = { ...prev };
                    const downloaded = updated["downloaded_games"] ?? [];
                    updated["downloaded_games"] = downloaded.filter(game => game.title !== title);
                    return updated;
                  });
                }}
                onGameAddToCollection={(collectionKey, game) => {
                  setCollectionList(prev => ({
                    ...prev,
                    [collectionKey]: [...(prev[collectionKey] ?? []), game],
                  }));
                }}
                layoutType={layoutType}
              />
            </div>
          ) : (
            <div class="flex flex-col items-center justify-center h-full text-muted/80">
              <div class="relative mb-4">
                <PackagePlus class="w-16 h-16 opacity-30 animate-pulse" stroke-width={1} />
              </div>
              <p class="text-xl font-medium mb-1">Your Library is Empty</p>
              <p class="text-sm max-w-md text-center mb-6">
                Add your favorite games to build your personalized collection
              </p>

              <Button class="items-center" label="Add your first game !" onClick={handleAddLocalGame} icon={<Plus class="w-4 h-4" />} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Library;