import { appDataDir } from "@tauri-apps/api/path";
import { createSignal, onMount, createEffect } from "solid-js";
import './Library.css'
import { fs } from '@tauri-apps/api';
import { join } from '@tauri-apps/api/path';
import { render } from "solid-js/web";
import BasicTextInputPopup from "../../Pop-Ups/Basic-TextInput-PopUp/Basic-TextInput-PopUp";
import { createDir, writeTextFile } from "@tauri-apps/api/fs";
import { setDownloadGamePageInfo } from "../../components/functions/dataStoreGlobal";
import { useNavigate } from "@solidjs/router";

const appDir =  await appDataDir();
const dirPath = appDir;


// Global signal to store file contents


async function userToDownloadGamesPath() {
    return await join(dirPath, 'library');
}

async function userCollectionPath() {
    return await join(dirPath, 'library', 'collections');
}

function Library() {
    const [fileContents, setFileContents] = createSignal({});
    const [collectionList, setCollectionList] = createSignal({})
    onMount(async () => {
        try {
            // Get the path to the library folder
            const libraryPath = await userToDownloadGamesPath();

            // Read all files in the folder
            const files = await fs.readDir(libraryPath);

            // Create an object to store file contents
            const contents = {};

            for (const file of files) {
                if (file.children === undefined) {
                    // Read the file content if it's a file
                    const fileContent = await fs.readTextFile(file.path);
                    const fileName = file.name.split('.')[0]; // Remove file extension
                    contents[fileName] = JSON.parse(fileContent);
                }
            }

            // Update the signal
            const firstKey = Object.keys(contents)[0];
            const firstValue = contents[firstKey];
            setFileContents(firstValue);
            setCollectionList(prevList => ({
                ...prevList,
                games_to_download: contents
            }));
        } catch (error) {
            console.error('Error reading files:', error);
        }
    });

    onMount(async() => {
        const collectionPath = await userCollectionPath();

        const files = await fs.readDir(collectionPath);

        // Create an object to store file contents
        const contents = {};

        for (const file of files) {
            if (file.children === undefined) {
                // Read the file content if it's a file
                const fileContent = await fs.readTextFile(file.path);
                const fileName = file.name.split('.')[0]; // Remove file extension
                console.log(fileName)
                contents[fileName] = JSON.parse(fileContent);
                const firstKey = Object.keys(contents)[0];
                const firstValue = contents[firstKey];
                setCollectionList(prevList => ({
                    ...prevList,
                    [firstKey]: contents
                }));
                console.warn(collectionList())
            }
        }
        console.log(collectionList())


    })
    // {Object.keys(fileContents()).map((key) => (
    //     <li>
    //         <strong>{key}</strong>: {fileContents()[key]}
    //     </li>
    // ))}

    async function createNewColletion(collectionName) {
        console.warn("creation", collectionName)

        const libraryPath = await userCollectionPath();
        let cleanCollectionName = collectionName.toLowerCase().replace(/\s+/g, '_') + '.json';
        let cleanCollectioNameOnList = collectionName.toLowerCase().replace(/\s+/g, '_')
        const collectionFilePath = `${libraryPath}/${cleanCollectionName}`;
        try {
            await createDir(libraryPath, { recursive: true }); // Create the directory
            await writeTextFile(collectionFilePath, '[]');
            setCollectionList(prevList => ({
                ...prevList,
                [cleanCollectioNameOnList]: {[cleanCollectioNameOnList]: {}}
            }));
            console.log(collectionList())
        } catch(error) {
            console.error("error creating collection: ", error)
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
    return (
        <div className="library content-page">
            <div className="library-sidebar">
                <button className="library-create-collection-button" onClick={handleCreateNewCollection}>
                    <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="107 1538 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="107" y="1538" width="24" height="24" class="frame-background"/></g><g class="frame-children"><path d="M118 1550h-8" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M118 1550h-8" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape"/></g><path d="M123 1544h-13" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M123 1544h-13" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape"/></g><path d="M123 1556h-13" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M123 1556h-13" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape"/></g><path d="M125 1547v6" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M125 1547v6" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape"/></g><path d="M128 1550h-6" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M128 1550h-6" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape"/></g></g></svg>
                    <p>New Collection</p>
                </button>
                {/* {collectionList().map((collection) => {
                    return collection.games.map((game, index) => (
                        
                        <CollectionList key={index} gameInfo={game} />
                    ));
                })} */}

                {Object.keys(collectionList()).map((collectionKey) => (
                        <CollectionList
                            key={collectionKey}
                            collectionGamesList={collectionList()[collectionKey]}
                        />
                ))}

                
            </div>
        </div>
    );
}

function CollectionList({ collectionGamesList }) {
    const [gamesList, setGamesList] = createSignal({})
    const [clicked, setClicked] = createSignal(false);
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
        if (!clicked()) {
            console.log(href)
            setClicked(true);
            const uuid = crypto.randomUUID();
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
            const games = Object.values(collectionGamesList)[0]?.games || [];
            setGamesList(games);
        }
    })

    return (
        <div className="library-collection-list">
            
            <div className="library-collection-list-title">
                <svg width="24" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="103.5 287.8 24 24" style="-webkit-print-color-adjust::exact" fill="none"><g class="fills"><rect rx="0" ry="0" x="103.5" y="287.8" width="24" height="24" class="frame-background"/></g><g class="frame-children"><path d="m106.5 295.8 4-4 4 4" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="m106.5 295.8 4-4 4 4" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape"/></g><path d="M110.5 291.8v16" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M110.5 291.8v16" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape"/></g><path d="M114.5 299.8h4" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M114.5 299.8h4" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape"/></g><path d="M114.5 303.8h7" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M114.5 303.8h7" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape"/></g><path d="M114.5 307.8h10" style="fill:none" class="fills"/><g stroke-linecap="round" stroke-linejoin="round" class="strokes"><path d="M114.5 307.8h10" style="fill:none;fill-opacity:none;stroke-width:2;stroke:#ece0f0;stroke-opacity:1" class="stroke-shape"/></g></g></svg>
                <p>{formatKeyName(Object.keys(collectionGamesList)[0])}</p>
                
            </div>
            <ul className="library-collection-list-item">
                {gamesList().length > 0 ? (
                    gamesList().map((game, index) => (
                        <li key={index} className="library-collection-list-game-item" onClick={() => handleGameClick(game.title, game.filePath, game.href)}>
                            <img
                                src={game.img}
                                alt={extractMainTitle(game.title)}
                            />
                            <span style={{ fontSize: '1.2em', fontWeight: 'bold' }}>
                                {extractMainTitle(game.title)}
                            </span>
                        </li>
                    ))
                ): (
                    <p>No games found</p>
                )}
            </ul>
        </div>
    );
}

export default Library;