import { createSignal, onMount, For } from "solid-js";
import { render } from "solid-js/web";
import { appDataDir, join } from "@tauri-apps/api/path";
import { mkdir, writeTextFile, readDir, readTextFile } from "@tauri-apps/plugin-fs";
import { message } from "@tauri-apps/plugin-dialog";
import BasicTextInputPopup from "../../Pop-Ups/Basic-TextInput-PopUp/Basic-TextInput-PopUp";
import AddLocalGamePopUp from "../../Pop-Ups/Add-Local-Game-PopUp/Add-Local-Game-PopUp";
import CollectionList from './CollectionList/CollectionList';
import GameDownloadedItem from "./GameDownloadedItem/GameDownloadedItem";
import {
  Plus,
  Gamepad2,
  LibraryBig,
  FolderPlus,
  PackagePlus,
  PackageCheck,
  ListCollapse
} from 'lucide-solid';
import Button from "../../components/UI/Button/Button";

function Library() {
  const [collectionList, setCollectionList] = createSignal<Record<string, any>>({});
  const [downloadedGamesList, setDownloadedGamesList] = createSignal<any[]>([]);

  const userToDownloadGamesPath = async () => join(await appDataDir(), "library");
  const userCollectionPath = async () => join(await appDataDir(), "library", "collections");
  const userDownloadedGamesPath = async () => join(await appDataDir(), "library", "downloadedGames");

  onMount(async () => {
    try {
      const paths = await Promise.all([
        userToDownloadGamesPath(),
        userCollectionPath(),
        userDownloadedGamesPath()
      ]);

      const [libraryPath, collectionPath, downloadedPath] = paths;

      // Read from library
      const libFiles = await readDir(libraryPath);
      const libContents: Record<string, any> = {};
      for (const file of libFiles) {
        if (file.isFile) {
          const path = await join(libraryPath, file.name);
          const content = await readTextFile(path);
          const name = file.name.split(".")[0];
          libContents[name] = JSON.parse(content);
        }
      }

      // Read from collections
      const colFiles = await readDir(collectionPath);
      for (const file of colFiles) {
        if (file.isFile) {
          const path = await join(collectionPath, file.name);
          const content = await readTextFile(path);
          const name = file.name.split(".")[0];
          libContents[name] = JSON.parse(content);
        }
      }

      setCollectionList(libContents);

      // Read downloaded games
      const downloadedFile = await join(downloadedPath, "downloaded_games.json");
      const downloadedContent = await readTextFile(downloadedFile);
      const downloadedGames = JSON.parse(downloadedContent);

      setCollectionList(prev => ({ ...prev, downloaded_games: downloadedGames }));
      setDownloadedGamesList(downloadedGames);
    } catch (err) {
      await message(`${err}`, { title: "FitLauncher", kind: "error" });
    }
  });

  async function createNewCollection(collectionName: string) {
    if (collectionName.length < 30 && collectionName.length > 2) {
      const path = await userCollectionPath();
      const cleanName = collectionName.toLowerCase().replace(/\s+/g, "_") + ".json";
      const cleanKey = collectionName.toLowerCase().replace(/\s+/g, "_");
      const fullPath = `${path}/${cleanName}`;
      try {
        await mkdir(path, { recursive: true });
        await writeTextFile(fullPath, "[]");
        setCollectionList(prev => ({
          ...prev,
          [cleanKey]: { [cleanKey]: {} },
        }));
        window.location.reload();
      } catch (err) {
        await message(`Error creating collection: ${err}`, { title: "Collection Creation", kind: "error" });
      }
    } else {
      await message("Name too long or too short", { title: "Collection Creation", kind: "error" });
    }
  }

  function handleCreateNewCollection() {
    const page = document.querySelector(".library")!;
    render(() => (
      <BasicTextInputPopup
        infoTitle="Create a new collection !"
        infoMessage="How do you want to name your Collection ?"
        infoPlaceholder="Best Games 2024..."
        infoFooter=""
        action={createNewCollection}
      />
    ), page);
  }

  async function handleAddLocalGame() {
    const page = document.querySelector(".library")!;
    render(() => (
      <AddLocalGamePopUp
        infoTitle="Are you sure you want to run this Game"
        infoMessage="Do you want to start playing ?"
        infoFooter=""
      />
    ), page);
  }

  return (
    <div class="flex h-screen bg-gradient-to-br from-background to-background-70 text-text">
      {/* Sidebar */}
      <div class="w-72 bg-popup/95 backdrop-blur-sm border-r border-secondary-30 p-5 flex flex-col space-y-5">
        <div class="flex items-center space-x-3 mb-6 px-2">
          <LibraryBig class="w-6 h-6 text-accent" />
          <h2 class="text-xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent font-titles">
            Game Library
          </h2>
        </div>


        <Button label="New Collection" onClick={handleCreateNewCollection} icon={<Plus class="w-5 h-5 transition-transform group-hover:rotate-90" />} />
        <div class="overflow-y-auto flex-1 custom-scrollbar">
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
            <For each={Object.keys(collectionList())}>
              {(key) => (
                <CollectionList
                  collectionGamesList={collectionList()[key]}
                  collectionName={key}
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
          <div class="flex items-center space-x-2 font-titles">
            <Gamepad2 class="w-5 h-5 text-primary" />
            <h2 class="font-medium">My Games</h2>
          </div>
          <button
            onClick={handleAddLocalGame}
            class="group flex items-center space-x-1.5 bg-secondary-20 hover:bg-secondary-30 text-primary px-3.5 py-1.5 rounded-lg transition-all duration-200"
            title="Add Local Game"
          >
            <FolderPlus class="w-4 h-4 group-hover:text-accent transition-colors font-titles" />
            <span class="text-sm">Add Game</span>
          </button>
        </div>

        {/* Games Grid */}
        <div class="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {collectionList()["downloaded_games"]?.length > 0 ? (
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              <GameDownloadedItem
                downloadedGamesList={collectionList()["downloaded_games"]}
                collectionsList={collectionList()}
              />
            </div>
          ) : (
            <div class="flex flex-col items-center justify-center h-full text-muted/80">
              <div class="relative mb-6">
                <PackageCheck class="w-16 h-16 opacity-30" />
                <PackagePlus class="w-8 h-8 text-accent absolute -top-2 -right-2 animate-pulse" />
              </div>
              <p class="text-xl font-medium mb-1">Your Library is Empty</p>
              <p class="text-sm max-w-md text-center mb-6">
                Add your favorite games to build your personalized collection
              </p>
              <button
                onClick={handleAddLocalGame}
                class="flex items-center space-x-2 bg-accent hover:bg-accent/90 text-background font-medium py-2 px-4 rounded-lg transition-all"
              >
                <Plus class="w-4 h-4" />
                <span>Add Your First Game</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Library;