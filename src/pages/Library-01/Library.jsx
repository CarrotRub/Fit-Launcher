import { appDataDir } from "@tauri-apps/api/path";
import { createSignal, onMount, createEffect, For } from "solid-js";
import './Library.css'
import { } from '@tauri-apps/api';
import { join } from '@tauri-apps/api/path';
import { render } from "solid-js/web";
import BasicTextInputPopup from "../../Pop-Ups/Basic-TextInput-PopUp/Basic-TextInput-PopUp";
import { mkdir, writeTextFile } from "@tauri-apps/plugin-fs";
import { setDownloadGamePageInfo } from "../../components/functions/dataStoreGlobal";
import { useNavigate } from "@solidjs/router";
import * as fs from "@tauri-apps/plugin-fs"
import { invoke } from "@tauri-apps/api/core";
import BasicPathInputPopup from "../../Pop-Ups/Basic-PathInput-PopUp/Basic-PathInput-PopUp";
import { confirm, message } from "@tauri-apps/plugin-dialog";
import BasicChoicePopup from "../../Pop-Ups/Basic-Choice-PopUp/Basic-Choice-PopUp";
import BasicAddToCollectionPopup from "../../Pop-Ups/Basic-AddToCollection-PopUp/Basic-AddToCollection-PopUp";
import { useDragDropContext } from "@thisbeyond/solid-dnd";
import {
    DragDropProvider,
    DragDropSensors,
    DragOverlay,
    SortableProvider,
    createSortable,
    closestCenter,
} from "@thisbeyond/solid-dnd";
import GameSettingsLibraryPopUp from "../../Pop-Ups/Library-Game-Settings-PopUp/Game-Settings";
import AddLocalGamePopUp from "../../Pop-Ups/Add-Local-Game-PopUp/Add-Local-Game-PopUp";
const appDir = await appDataDir();
const dirPath = appDir;


// Global signal to store file contents


async function userToDownloadGamesPath() {
    return await join(dirPath, 'library');
}

async function userCollectionPath() {
    return await join(dirPath, 'library', 'collections');
}

async function userDownloadedGamesPath() {
    return await join(dirPath, 'library', 'downloadedGames');
}

function Library() {
    const [fileContents, setFileContents] = createSignal({});
    const [collectionList, setCollectionList] = createSignal({});
    const [downloadedGamesList, setDownloadedGamesList] = createSignal({});

    onMount(async () => {
        try {
            const libraryPath = await userToDownloadGamesPath();
            const files = await fs.readDir(libraryPath);

            const contents = {};
            for (const file of files) {
                if (file.isFile) {
                    const filePathToFile = await join(libraryPath, file.name);
                    const fileContent = await fs.readTextFile(filePathToFile);
                    const fileName = file.name.split('.')[0]; // Remove file extension
                    contents[fileName] = JSON.parse(fileContent);
                }
            }

            setCollectionList((prevList) => ({
                ...prevList,
                ...contents,
            }));
        } catch (error) {
            await message(error, { title: 'FitLauncher', kind: 'error' })
        }

        try {
            const collectionPath = await userCollectionPath();
            const files = await fs.readDir(collectionPath);

            const contents = {};
            for (const file of files) {
                if (file.isFile) {
                    const filePathToFile = await join(collectionPath, file.name);
                    const fileContent = await fs.readTextFile(filePathToFile);
                    const fileName = file.name.split('.')[0]; // Remove file extension
                    contents[fileName] = JSON.parse(fileContent);
                }
            }

            setCollectionList((prevList) => ({
                ...prevList,
                ...contents,
            }));
        } catch (error) {
            await message(error, { title: 'FitLauncher', kind: 'error' })
        }

        try {
            const downloadedGamesPath = await userDownloadedGamesPath();
            const fullPath = await join(downloadedGamesPath, "downloaded_games.json");

            const fileContent = await fs.readTextFile(fullPath);
            const downloadedGames = JSON.parse(fileContent);

            setCollectionList((prevList) => ({
                ...prevList,
                downloaded_games: downloadedGames,
            }));

            setDownloadedGamesList(downloadedGames);
        } catch (error) {
            await message(error, { title: 'FitLauncher', kind: 'error' })
        }
    });

    async function createNewColletion(collectionName) {

        console.log(collectionName)
        if (collectionName.length < 30 && collectionName.length > 2) {
            const libraryPath = await userCollectionPath();
            let cleanCollectionName = collectionName.toLowerCase().replace(/\s+/g, '_') + '.json';
            let cleanCollectioNameOnList = collectionName.toLowerCase().replace(/\s+/g, '_')
            const collectionFilePath = `${libraryPath}/${cleanCollectionName}`;
            try {
                await mkdir(libraryPath, { recursive: true });
                await writeTextFile(collectionFilePath, '[]');
                setCollectionList(prevList => ({
                    ...prevList,
                    [cleanCollectioNameOnList]: { [cleanCollectioNameOnList]: {} }
                }));
                window.location.reload()
            } catch (error) {
                await message(`error creating collection: ${error})`, { title: "Collection Creation", kind: 'error' })
            }
        } else {
            await message(`Name too long (Over 30 characters) or too small (2 characters or less)`, { title: "Collection Creation", kind: 'error' })
        }
    }

    function handleCreateNewCollection() {
        const pageContent = document.querySelector(".library")
        render(
            () => (
                <BasicTextInputPopup
                    infoTitle={"Create a new collection !"}
                    infoMessage={"How do you want to name your Collection ?"}
                    infoPlaceholder={"Best Games 2024..."}
                    infoFooter={''}
                    action={createNewColletion}
                />
            ),
            pageContent
        );
    }
    async function handleAddLocalGame() {
        const pageContent = document.querySelector(".library")

        render(
            () => <AddLocalGamePopUp
                infoTitle={"Are you sure you want to run this Game"}
                infoMessage={`Do you want to start playing ?`}
                infoFooter={''}
                
            />
            , pageContent
        )

    }
    return (
        <div className="library content-page">
            <div className="library-sidebar">
                <button className="library-create-collection-button" onClick={handleCreateNewCollection}>
                    <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="107 1538 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="107" y="1538" width="24" height="24" class="frame-background" /></g><g class="frame-children"><path d="M118 1550h-8" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M118 1550h-8" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="M123 1544h-13" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M123 1544h-13" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="M123 1556h-13" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M123 1556h-13" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="M125 1547v6" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M125 1547v6" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="M128 1550h-6" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M128 1550h-6" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g></g></svg>
                    <p>New Collection</p>
                </button>
                <For each={Object.keys(collectionList())}>

                    {(collectionKey) => (
                        <CollectionList
                            key={collectionKey} // Provide a unique key
                            collectionGamesList={collectionList()[collectionKey]}
                            collectionName={collectionKey}
                        />
                    )}
                </For>
            </div>
            <div className="library-content-games">
                <div className="library-content-options-bar">
                    {/* Here we will also add next update a second way to display the games. */}
                    <svg onClick={async() => {await handleAddLocalGame()}} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-diamond-plus"><path d="M12 8v8m-9.3-5.7a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0zM8 12h8"/></svg>
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

function GameDownloadedItem({ downloadedGamesList, collectionsList }) {
    const [dynamicDownloadedGamesList, setDynamicDownloadedGamesList] = createSignal(downloadedGamesList)
    const [executableGamePath, setExecutableGamePath] = createSignal("");
    const [gamesListContent, setGamesListContent] = createSignal([])
    const [installSettings, setInstallSettings] = createSignal(null);
    const [activeItem, setActiveItem] = createSignal(null);
    onMount(() => {
        console.log(collectionsList)
    })

    onMount(async () => {

        const userPath = await userDownloadedGamesPath();
        const downloadedGamesPath = await join(userPath, "downloaded_games.json");
        const settingsPath = await join(appDir, 'fitgirlConfig', 'settings', 'installation', 'installation.json');
        const settingsContent = await fs.readTextFile(settingsPath)
        const settings = JSON.parse(settingsContent)

        setInstallSettings(settings);
        let updatedGamesList = await Promise.all(
            downloadedGamesList.map(async (game, index) => {
                const executableInfo = game?.executableInfo;
                const executableInfoPath = game?.executableInfo?.executable_path;

                if (!executableInfo) {
                    console.warn("ExecutableInfo doesn't exist. Initializing...");
                    pushDefaultExecutableInfo(game);

                    try {
                        const fileContent = await fs.readTextFile(downloadedGamesPath);
                        const contents = JSON.parse(fileContent) || [];
                        contents[index] = game;
                        await fs.writeTextFile(downloadedGamesPath, JSON.stringify(contents, null, 2));
                    } catch (error) {
                        if (error?.message?.includes("File not found")) {
                            console.warn("File not found. Initializing a new one.");
                        } else {
                            await message(error, { title: 'FitLauncher', kind: 'error' })
                            throw error;
                        }
                    }
                    return game;
                } else if (executableInfoPath) {
                    try {
                        const gameInfo = await getExecutableInfo(executableInfoPath, game?.torrentOutputFolder);
                    } catch (error) {
                        await message(error, { title: 'FitLauncher', kind: 'error' })
                    }
                }

                return game;
            })
        );

        setDynamicDownloadedGamesList(updatedGamesList);
    });

    function pushDefaultExecutableInfo(game) {
        game.executableInfo = {
            executable_path: "",
            executable_last_opened_date: null,
            executable_play_time: 0,
            executable_installed_date: null,
            executable_disk_size: 0,
        };
    }

    async function getExecutableInfo(game_path, torrentFolder) {
        let strippedTorrentFolder = torrentFolder.replace(' [FitGirl Repack]', '')
        let executable_info = await invoke('executable_info_discovery', { pathToExe: game_path, pathToFolder: strippedTorrentFolder })
        return executable_info
    }

    /**
     * This is a specific version of the regex that allows Editions in the title.
     * @param {*} title 
     * @returns simplifiedTitle
     */
    function extractMainTitle(title) {
        const simplifiedTitle = title
            ?.replace(/\s*[:\-]\s*$/, '')
            ?.replace(/\(.*?\)/g, '')
            ?.replace(/\s*[:\–]\s*$/, '') // Clean up any trailing colons or hyphens THIS IS A FKCNG EN DASH AND NOT A HYPHEN WTF
            ?.replace(/[\–].*$/, '')

        return simplifiedTitle
    }

    async function writeExecutableInfo(gameObj, executableInfo) {
        const userPath = await userDownloadedGamesPath();
        const downloadedGamesPath = await join(userPath, "downloaded_games.json");

        try {
            // Read the existing downloaded games file
            const fileContent = await fs.readTextFile(downloadedGamesPath);
            const gamesList = JSON.parse(fileContent);

            // Update the specific game with the new executable info
            const gameIndex = gamesList.findIndex(game => game?.torrentExternInfo?.title === gameObj?.torrentExternInfo?.title);

            if (gameIndex !== -1) {
                gamesList[gameIndex].executableInfo = executableInfo;

                // Write the updated list back to the file
                await fs.writeTextFile(downloadedGamesPath, JSON.stringify(gamesList, null, 2));
                console.log("Executable info updated successfully!");
            } else {
                console.warn("Game not found in the downloaded games list.");
            }
        } catch (error) {
            await message(error, { title: 'FitLauncher', kind: 'error' })
        }
    }

    async function getexecutable_path(gameObj) {
        async function addNewPathToFile(path) {
            try {
                const executableInfo = await getExecutableInfo(path, gameObj?.torrentOutputFolder?.replace(' [FitGirl Repack]', '')); // Fetch executable info
                await writeExecutableInfo(gameObj, executableInfo); // Save to file
                if (installSettings()?.auto_clean) {
                    await message('The game installation folder is getting deleted automatically, if you want to disable that, go to settings.', { title: 'FitLauncher', kind: 'warning' });
                    try {
                        await invoke('delete_game_folder_recursively', { folderPath: gameObj?.torrentOutputFolder });
                        await message('The game installation folder has been deleted successfully.', { title: 'FitLauncher', kind: 'info' });
                        window.location.reload();
                    } catch (error) {
                        await message(error, { title: 'FitLauncher', kind: 'error' });
                    }
                }
                window.location.reload()
            } catch (error) {
                await message(error, { title: 'FitLauncher', kind: 'error' })
            }
        }
        const pageContent = document.querySelector(".library");

        render(
            () => (
                <BasicPathInputPopup
                    infoTitle={"Select your game's executable file !"}
                    infoMessage={"Here, you'll have to choose the file where your game has been installed.<br /> E.g : If you installed Elden Ring it will probably be in the Elden Ring file and there will be .exe file, just choose it :)"}
                    infoPlaceholder={"Executable Path"}
                    defaultPath={gameObj?.torrentOutputFolder?.replace(' [FitGirl Repack]', '')}
                    fileType={["exe"]}
                    multipleFiles={false}
                    isDirectory={false}
                    infoFooter={''}
                    action={addNewPathToFile}
                />
            ),
            pageContent
        );
    }

    async function handleStartGame(gameExePath) {

        const pageContent = document.querySelector(".library")
        try {
            async function runGame(gameExePath) {
                await invoke('start_executable', { path: gameExePath })
            };

            render(
                () => <BasicChoicePopup
                    infoTitle={"Are you sure you want to run this Game"}
                    infoMessage={`Do you want to start playing ?`}
                    infoFooter={''}
                    action={() => runGame(gameExePath)}
                />
                , pageContent
            )

        } catch (error) {
            await message(error, { title: 'FitLauncher', kind: 'error' })
        }
    }

    async function handleAddToCollections(gameObj) {
        const pageContent = document.querySelector(".library")
        function checkIfUserCreatedCollection(collectionName) {
            console.log(collectionName)
            return collectionName !== "downloaded_games" && collectionName !== "games_to_download";
        }
        let possible_collections = Object.entries(collectionsList)
            .filter(([key, value]) => checkIfUserCreatedCollection(key))
            .reduce((acc, [key, value]) => {
                acc[key] = value;
                return acc;
            }, {})
        if (Object.keys(possible_collections).length > 0) {
            try {
                render(
                    () => <BasicAddToCollectionPopup
                        infoTitle={"Where do you want to add this game ?"}
                        infoMessage={`Which collection do you think will be the one ?`}
                        collectionsList={collectionsList}
                        infoFooter={''}
                        gameObjectInfo={gameObj}
                    />
                    , pageContent
                )

            } catch (error) {
                await message(error, { title: 'FitLauncher', kind: 'error' })
            }
        } else {
            await message('You do not have any collections, please create one.', { title: 'FitLauncher', kind: 'warning' });
        }
    }

    async function handleChangeSettings(gameObj) {
        const pageContent = document.querySelector(".library")
        try {
            render(
                () => (
                    <GameSettingsLibraryPopUp
                        infoTitle={"Handle the settings of your game !"}
                        infoMessage={"Here, you'll be able to change the settings of your game, feel free to do it :)"}
                        infoPlaceholder={"Executable Path"}
                        defaultPath={gameObj?.torrentOutputFolder?.replace(' [FitGirl Repack]', '')}
                        fileType={["exe"]}
                        multipleFiles={false}
                        isDirectory={false}
                        infoFooter={''}
                        userGame={gameObj}
                    />
                ),
                pageContent
            );

        } catch (error) {
            await message(error, { title: 'FitLauncher', kind: 'error' })
        }
    }

    createEffect(() => {
        console.log(dynamicDownloadedGamesList())

        const syncDownloadedGames = async () => {
            const userPath = await userDownloadedGamesPath();
            const downloadedGamesPath = await join(userPath, "downloaded_games.json");
    
            // Write to the file
            await fs.writeTextFile(
                downloadedGamesPath,
                JSON.stringify(dynamicDownloadedGamesList(), null, 2)
            );
        };
    
        // Call the function inside createEffect
        syncDownloadedGames().catch((error) => {
            console.error("Error syncing downloaded games:", error);
        });
    })

    const ids = () => dynamicDownloadedGamesList().map(game => game.torrentExternInfo.title);

    const onDragStart = ({ draggable }) => setActiveItem(draggable.id);

    const onDragEnd = ({ draggable, droppable }) => {
        
        if (draggable && droppable) {
            const currentItems = dynamicDownloadedGamesList();
            const fromIndex = currentItems.findIndex(item => item.torrentExternInfo.title === draggable.id);
            const toIndex = currentItems.findIndex(item => item.torrentExternInfo.title === droppable.id);
            if (fromIndex !== toIndex) {
                const updatedItems = [...currentItems];
                updatedItems.splice(toIndex, 0, ...updatedItems.splice(fromIndex, 1));
                setDynamicDownloadedGamesList(updatedItems);
            }
        }
        setActiveItem(null);
    };

    const SortableGameItem = (props) => {
        const sortable = createSortable(props.itemId);
        const game = props.game;
        const [state] = useDragDropContext();
        return (
            <li
                use:sortable
                className="library-content-list-game-item"
                classList={{
                    "opacity-25": sortable.isActiveDraggable,
                    "transition-transform": !!state.active?.draggable,
                }}
            >
                <svg onMouseDown={(e) => e.stopPropagation()} className="draggable-svg" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-grip-vertical"><circle cx="9" cy="12" r="1" /><circle cx="9" cy="5" r="1" /><circle cx="9" cy="19" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="15" cy="19" r="1" /></svg>
                <img className="library-content-list-game-item-image" src={game?.torrentExternInfo?.img} alt="Game Cover" />
                <p className="library-content-list-game-item-title">{extractMainTitle(game?.torrentExternInfo?.title)}</p>
                {game?.executableInfo?.executable_path
                    ? (
                        <button className="library-content-list-game-item-button" style={`background-color: var(--accent-color)`} onClick={() => handleStartGame(game?.executableInfo?.executable_path)}>
                            <p>PLAY</p>
                        </button>
                    ) : (
                        <button className="library-content-list-game-item-button" style={`background-color: var(--warning-orange)`} onClick={async () => await getexecutable_path(game)}>
                            <p>ADD PATH</p>
                        </button>
                    )
                }

                <div className="library-content-list-game-item-game-options">
                    <button onClick={async () => { await handleAddToCollections(game) }}>
                        <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="1860.5 1552.16 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="1860.5" y="1552.16" width="24" height="24" class="frame-background" /></g><g class="frame-children"><path d="m1879.5 1573.16-7-4-7 4v-16a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m1879.5 1573.16-7-4-7 4v-16a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--accent-color);stroke-opacity:1" class="stroke-shape" /></g><path d="M1872.5 1559.16v6" style="fill:none" class="fills" /><g stroke-linejoin="round" stroke-linecap="round" class="strokes"><path d="M1872.5 1559.16v6" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--accent-color);stroke-opacity:1" class="stroke-shape" /></g><path d="M1875.5 1562.16h-6" style="fill:none" class="fills" /><g stroke-linejoin="round" stroke-linecap="round" class="strokes"><path d="M1875.5 1562.16h-6" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--accent-color);stroke-opacity:1" class="stroke-shape" /></g></g></svg>
                    </button>
                    <button onClick={async () => { await handleChangeSettings(game)}}>
                        <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="1913.5 1552.16 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="1913.5" y="1552.16" width="24" height="24" class="frame-background" /></g><g class="frame-children"><path d="M1925.72 1554.16h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73v.18a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73v-.18a2 2 0 0 0-2-2" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M1925.72 1554.16h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73v.18a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73v-.18a2 2 0 0 0-2-2" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--accent-color);stroke-opacity:1" class="stroke-shape" /></g><circle cx="1925.5" cy="1564.16" style="fill:none" class="fills" r="3" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><circle cx="1925.5" cy="1564.16" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--accent-color);stroke-opacity:1" class="stroke-shape" r="3" /></g></g></svg>
                    </button>
                </div>
                <ul className="library-content-list-game-item-executable-info">
                    <li className="library-content-list-game-item-executable-info-container">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" style="-webkit-print-color-adjust::exact" viewBox="995.5 1634.44 24 24"><g class="fills"><rect width="24" height="24" x="995.5" y="1634.44" class="frame-background" rx="0" ry="0" /></g><g class="frame-children"><rect width="18" height="18" x="998.5" y="1638.44" class="fills" rx="2" ry="2" style="fill:none" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><rect width="18" height="18" x="998.5" y="1638.44" class="stroke-shape" rx="2" ry="2" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--text-color);stroke-opacity:.5" /></g><path d="M1011.5 1636.44v4" class="fills" style="fill:none" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M1011.5 1636.44v4" class="stroke-shape" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--text-color);stroke-opacity:.5" /></g><path d="M1003.5 1636.44v4" class="fills" style="fill:none" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M1003.5 1636.44v4" class="stroke-shape" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--text-color);stroke-opacity:.5" /></g><path d="M998.5 1644.44h18" class="fills" style="fill:none" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M998.5 1644.44h18" class="stroke-shape" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--text-color);stroke-opacity:.5" /></g><path d="M1003.5 1648.44Z" class="fills" style="fill:none" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M1003.5 1648.44h0Z" class="stroke-shape" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--text-color);stroke-opacity:.5" /></g><path d="M1007.5 1648.44Z" class="fills" style="fill:none" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M1007.5 1648.44h0Z" class="stroke-shape" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--text-color);stroke-opacity:.5" /></g><path d="M1011.5 1648.44Z" class="fills" style="fill:none" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M1011.5 1648.44h0Z" class="stroke-shape" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--text-color);stroke-opacity:.5" /></g><path d="M1003.5 1652.44Z" class="fills" style="fill:none" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M1003.5 1652.44h0Z" class="stroke-shape" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--text-color);stroke-opacity:.5" /></g><path d="M1007.5 1652.44Z" class="fills" style="fill:none" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M1007.5 1652.44h0Z" class="stroke-shape" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--text-color);stroke-opacity:.5" /></g><path d="M1011.5 1652.44Z" class="fills" style="fill:none" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M1011.5 1652.44h0Z" class="stroke-shape" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--text-color);stroke-opacity:.5" /></g></g></svg>
                        <div className="library-content-list-game-item-executable-info-text">
                            <p className="library-content-list-game-item-executable-info-text-title">Last Played</p>
                            <p><b>{game?.executableInfo?.executable_last_opened_date?.replace(/-/g, '/') || "N/A"}</b></p>
                        </div>
                    </li>
                    <li className="library-content-list-game-item-executable-info-container">
                        <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="1263.381 1837.501 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="1263.381" y="1837.501" width="24" height="24" class="frame-background" /></g><g class="frame-children"><path d="M1284.381 1845.001v-1.5a2 2 0 0 0-2-2h-14a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M1284.381 1845.001v-1.5a2 2 0 0 0-2-2h-14a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--text-color);stroke-opacity:.5" class="stroke-shape" /></g><path d="M1279.381 1839.501v4" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M1279.381 1839.501v4" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--text-color);stroke-opacity:.5" class="stroke-shape" /></g><path d="M1271.381 1839.501v4" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M1271.381 1839.501v4" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--text-color);stroke-opacity:.5" class="stroke-shape" /></g><path d="M1266.381 1847.501h5" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M1266.381 1847.501h5" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--text-color);stroke-opacity:.5" class="stroke-shape" /></g><path d="m1280.881 1855.001-1.5-1.25v-2.25" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m1280.881 1855.001-1.5-1.25v-2.25" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--text-color);stroke-opacity:.5" class="stroke-shape" /></g><path d="M1285.381 1853.501a6 6 0 1 1-12 0 6 6 0 0 1 12 0" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M1285.381 1853.501a6 6 0 1 1-12 0 6 6 0 0 1 12 0" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--text-color);stroke-opacity:.5" class="stroke-shape" /></g></g></svg>
                        <div className="library-content-list-game-item-executable-info-text">
                            <p className="library-content-list-game-item-executable-info-text-title">Installed Date</p>
                            <p><b>{game?.executableInfo?.executable_installed_date?.replace(/-/g, '/') || "N/A"}</b></p>
                        </div>
                    </li>
                    <li className="library-content-list-game-item-executable-info-container">
                        <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="1508.381 1837.501 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="1508.381" y="1837.501" width="24" height="24" class="frame-background" /></g><g class="frame-children"><path d="M1522.881 1839.501h-8.5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-12.5z" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M1522.881 1839.501h-8.5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-12.5z" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--text-color);stroke-opacity:.5" class="stroke-shape" /></g><path d="M1522.381 1839.501v6h6" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M1522.381 1839.501v6h6" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--text-color);stroke-opacity:.5" class="stroke-shape" /></g></g></svg>
                        <div className="library-content-list-game-item-executable-info-text">
                            <p className="library-content-list-game-item-executable-info-text-title">Disk Size</p>
                            <p>
                                <b>
                                    {game?.executableInfo?.executable_disk_size
                                        ? game.executableInfo.executable_disk_size / (1024 ** 3) >= 1
                                            ? (game.executableInfo.executable_disk_size / (1024 ** 3)).toFixed(2) + " GB"
                                            : (game.executableInfo.executable_disk_size / (1024 ** 2)).toFixed(2) + " MB"
                                        : "N/A"}
                                </b>
                            </p>

                        </div>
                    </li>
                    <li className="library-content-list-game-item-executable-info-container">
                        <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="1753.381 1837.501 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="1753.381" y="1837.501" width="24" height="24" class="frame-background" /></g><g class="frame-children"><path d="M1763.381 1839.501h4" style="fill:none" class="fills" /><g stroke-linejoin="round" stroke-linecap="round" class="strokes"><path d="M1763.381 1839.501h4" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--text-color);stroke-opacity:.5" class="stroke-shape" /></g><path d="m1765.381 1851.501 3-3" style="fill:none" class="fills" /><g stroke-linejoin="round" stroke-linecap="round" class="strokes"><path d="m1765.381 1851.501 3-3" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--text-color);stroke-opacity:.5" class="stroke-shape" /></g><circle cx="1765.381" cy="1851.501" style="fill:none" class="fills" r="8" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><circle cx="1765.381" cy="1851.501" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--text-color);stroke-opacity:.5" class="stroke-shape" r="8" /></g></g></svg>
                        <div className="library-content-list-game-item-executable-info-text">
                            <p className="library-content-list-game-item-executable-info-text-title">Play Time</p>
                            <p><b>{game?.executableInfo?.executable_play_time || "N/A"}</b></p>
                        </div>
                    </li>
                </ul>
            </li>
        );
    };

    return (
        <DragDropProvider
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            collisionDetector={closestCenter}
        >
            <DragDropSensors />
            <SortableProvider ids={ids()}>
                <ul className="library-content-list-games self-stretch" >
                    <For each={dynamicDownloadedGamesList()}>
                        {(game) => (
                            <SortableGameItem itemId={game.torrentExternInfo.title} game={game} />
                        )}
                    </For>
                </ul>
            </SortableProvider>

            <DragOverlay>
            </DragOverlay>
        </DragDropProvider>
    );
}

function CollectionList({ collectionGamesList, collectionName }) {
    const [gamesList, setGamesList] = createSignal({})
    const [clicked, setClicked] = createSignal(false);
    const [isExpanded, setIsExpanded] = createSignal(true);

    const toggleExpand = () => {
        setIsExpanded(!isExpanded());
    };

    const navigate = useNavigate();

    function extractMainTitle(title) {
        const simplifiedTitle = title
            ?.replace(/(?: - |, | )?(Digital Deluxe|Ultimate Edition|Deluxe Edition)\s*[:\-]?.*|(?: - |, ).*/, '')
            ?.replace(/\s*[:\-]\s*$/, '')
            ?.replace(/\(.*?\)/g, '')
            ?.replace(/\s*[:\–]\s*$/, '') // Clean up any trailing colons or hyphens THIS IS A FKCNG EN DASH AND NOT A HYPHEN WTF
            ?.replace(/[\–].*$/, '')

        return simplifiedTitle
    }
    function formatKeyName(key) {
        return key
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1) + ' ');
    }

    const handleGameClick = (title, filePath, href) => {
        console.log(collectionName)
        if (!clicked() && collectionName === "games_to_download") {
            console.log(href)
            setClicked(true);
            const uuid = crypto.randomUUID();
            console.log(href)
            //TODO: Here use createStore
            setDownloadGamePageInfo({
                gameTitle: title,
                gameHref: href,
                filePath: filePath
            })
            navigate(`/game/${uuid}`);
        }
    };

    onMount(() => {
        if (collectionGamesList) {
            //Array of Objects
            const games = Object.values(collectionGamesList) || [];
            setGamesList(games);
        }
    })

    async function handleGameRemove(originalGame) {
        console.warn(originalGame)
        if (collectionName === "games_to_download") {
            const libraryPath = await userToDownloadGamesPath();
            const libFilePath = await join(libraryPath, 'games_to_download.json');

            const fileContent = await fs.readTextFile(libFilePath);
            let gamesList = JSON.parse(fileContent);

            const updatedGamesList = gamesList.filter(game => game.title !== originalGame.title);
            try {
                console.warn(updatedGamesList);
                await writeTextFile(libFilePath, JSON.stringify(updatedGamesList, null, 2));  // Pretty-print with indentation
                await message('Game has been removed from collection', { title: 'FitLauncher', kind: 'info' })
                window.location.reload();
            } catch (error) {
                await message(error, { title: 'FitLauncher', kind: 'error' })
            }

        } else if (collectionName === "downloaded_games") {
            await message("Can't remove a downloaded game", { title: 'Game Removal', kind: 'warning' });
        } else {
            const libraryPath = await userCollectionPath();
            const specificName = collectionName + '.json'
            const libFilePath = await join(libraryPath, specificName);

            const fileContent = await fs.readTextFile(libFilePath);
            let gamesList = JSON.parse(fileContent);

            const updatedGamesList = gamesList.filter(game => game.title !== originalGame.title);
            try {
                console.warn(updatedGamesList);
                await writeTextFile(libFilePath, JSON.stringify(updatedGamesList, null, 2));  // Pretty-print with indentation
                await message('Game has been removed from collection', { title: 'FitLauncher', kind: 'info' })
                window.location.reload();
            } catch (error) {
                await message(error, { title: 'FitLauncher', kind: 'error' })
            }
        }
    }

    async function handleCollectionRemove() {
        if (collectionName === "games_to_download") {
            await message("Can't remove the games to download collection", { title: 'Collection Removal', kind: 'warning' });
        } else if (collectionName === "downloaded_games") {
            await message("Can't remove the downloaded games collection", { title: 'Collection Removal', kind: 'warning' });
        } else {
            const pageContent = document.querySelector(".library")
            async function collectionRemoval() {
                const libraryPath = await userCollectionPath();
                const specificName = collectionName + '.json'
                const libFilePath = await join(libraryPath, specificName);

                try {
                    await fs.remove(libFilePath);
                    await message('Collection has been removed', { title: 'Collection Removal', kind: 'info' })
                    window.location.reload();
                } catch (error) {
                    await message(error, { title: 'FitLauncher', kind: 'error' })
                }
            }

            render(
                () => <BasicChoicePopup
                    infoTitle={"Do you really want to remove this collection ?"}
                    infoMessage={`You are going to remove ${collectionName} are you sure about that ?`}
                    infoFooter={''}
                    action={async () => await collectionRemoval()}
                />
                , pageContent
            )


        }
    }

    return (
        <div className="library-collection-list">
            <div className="library-collection-list-title" >
                <svg style={{
                    transform: isExpanded() ? 'rotate(0deg)' : 'rotate(180deg)',
                    transition: 'transform 0.2s ease',
                }} onClick={toggleExpand} width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="103.5 287.8 24 24" fill="none" ><g class="fills"><rect rx="0" ry="0" x="103.5" y="287.8" width="24" height="24" class="frame-background" /></g><g class="frame-children"><path d="m106.5 295.8 4-4 4 4" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m106.5 295.8 4-4 4 4" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="M110.5 291.8v16" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M110.5 291.8v16" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="M114.5 299.8h4" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M114.5 299.8h4" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="M114.5 303.8h7" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M114.5 303.8h7" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g><path d="M114.5 307.8h10" style="fill:none" class="fills" /><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M114.5 307.8h10" style="fill:none;fill-opacity:none;stroke-width:2;stroke:var(--primary-color);stroke-opacity:1" class="stroke-shape" /></g></g></svg>
                <p onClick={toggleExpand}>{formatKeyName(collectionName)}</p>
                <svg className="remove-collection-svg" onClick={async () => await handleCollectionRemove()} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-list-x"><path color="" d="M11 12H3m13-6H3m13 12H3m16-8-4 4m0-4 4 4" /></svg>
            </div>
            {isExpanded() && (
                <ul className="library-collection-list-item">
                    {gamesList().length > 0 ? (
                        gamesList().map((game, index) => (
                            <li
                                key={index}
                                className="library-collection-list-game-item"

                            >
                                <img
                                    src={game?.img ?? game?.torrentExternInfo?.img}
                                    alt={extractMainTitle(
                                        game?.title ?? game?.torrentExternInfo?.title
                                    )}
                                    onClick={() =>
                                        handleGameClick(
                                            game?.title ?? game?.torrentExternInfo?.title,
                                            game?.filePath ?? game?.torrentExternInfo?.filePath,
                                            game?.href ?? game?.torrentExternInfo?.href
                                        )
                                    }
                                />
                                <span style={{ fontSize: '1.2em', fontWeight: 'bold' }} onClick={() =>
                                    handleGameClick(
                                        game?.title ?? game?.torrentExternInfo?.title,
                                        game?.filePath ?? game?.torrentExternInfo?.filePath,
                                        game?.href ?? game?.torrentExternInfo?.href
                                    )
                                }
                                >
                                    {extractMainTitle(
                                        game?.title ?? game?.torrentExternInfo?.title
                                    )}
                                </span>

                                <svg onClick={async () => { await handleGameRemove(game) }} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2m-6 5v6m4-6v6" /></svg>
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

export default Library;