import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { invoke } from '@tauri-apps/api/tauri';
import './Gamehub.css'
import Newgames from '../../components/Newgames-01/Newgames';
import Popularrepacks from '../../components/Popularrepacks-01/Popularrepacks';
import UpdatedGames from '../../components/Updatedrepacks-01/Updatedrepacks';
import clearFile from '../../components/functions/clearFileRust';
import { appDataDir } from "@tauri-apps/api/path";
import { readTextFile, writeTextFile, exists } from "@tauri-apps/api/fs";
import { createDir } from "@tauri-apps/api/fs";
import { hide } from '@tauri-apps/api/app';

function Gamehub() {
    onMount(() => {
        
        // Load settings at startup
        loadSettings().then((settings) => {
            console.log("Loaded settings on startup:", settings);
        }).catch((error) => {
            console.error("Error loading settings on startup:", error);
        });

        let gamehubDiv = document.querySelector('.gamehub-container');
        let libraryDiv = document.querySelectorAll('.launcher-container');
        let settingsDiv = document.querySelectorAll('.settings-page');

        if (gamehubDiv) {
            console.log("findit");
            let gamehubLinkText = document.querySelector('#link-gamehub');
            gamehubLinkText.style.backgroundColor = '#ffffff0d';
            gamehubLinkText.style.borderRadius = '5px';
        }

        if (libraryDiv) {
            console.log("findit");
            let libraryLinkText = document.querySelector('#link-library');
            libraryLinkText.style.backgroundColor = '';
        }

        if (settingsDiv) {
            let gamehubLinkText = document.querySelector('#link-settings');
            gamehubLinkText.style.backgroundColor = '';
        }
    });

    // Moved outside the onMount, to allow reusability
    const defaultSettings = {
        defaultDownloadPath: "",
        autoClean: true,
        hoverTitle: true,
        autoInstall: true,
        importPath: "",
        two_gb_limit: true,
        hide_nsfw_content: false,
    };

    // Function to load settings from the JSON file, or create it if not present
    async function loadSettings() {
        const configDir = await appDataDir();
        const dirPath = `${configDir.replace(/\\/g, '/')}/fitgirlConfig`; // Directory path
        const settingsPath = `${dirPath}/settings.json`; // Settings file path

        try {
            console.log("Gamehub: Loading settings from:", settingsPath);

            // Check if the directory exists, and if not, create it
            const dirExists = await exists(dirPath);
            if (!dirExists) {
                console.log("Directory does not exist. Creating directory:", dirPath);
                await createDir(dirPath, { recursive: true });
                console.log("Directory created:", dirPath);
            }

            // Check if the settings file exists
            const fileExists = await exists(settingsPath);
            if (!fileExists) {
                console.log("Settings file does not exist. Creating settings file with default settings.");
                // If the file does not exist, create it with default settings
                await writeTextFile(settingsPath, JSON.stringify(defaultSettings, null, 2));
                console.log("Settings file created with default settings.");
                return defaultSettings;
            }

            // If the file exists, read and parse it
            const json = await readTextFile(settingsPath);
            console.log("Settings loaded from file.");
            return JSON.parse(json);
        } catch (error) {
            console.error("Failed to load settings:", error);
            return defaultSettings; // Return defaults in case of error
        }
    }

    const singularGamePath = '../src/temp/singular_games.json';

    createEffect(async () => {
        await clearFile(singularGamePath);
        invoke('stop_get_games_images');
    });

    function randomImageFinder() {
        const imageElements = document.querySelectorAll(".gamehub-container img");
        if (imageElements.length > 0) {
            const randomIndex = Math.floor(Math.random() * imageElements.length);
            const selectedImageSrc = imageElements[randomIndex].getAttribute('src');

            const fitgirlLauncher = document.querySelector('.gamehub-container');
            const scrollPosition = window.scrollY || document.documentElement.scrollTop;

            const docBlurOverlay = document.querySelector('.blur-overlay');
            if (docBlurOverlay != null) {
                docBlurOverlay.remove();
            }

            const docColorFilterOverlay = document.querySelector('.color-blur-overlay');
            if (docColorFilterOverlay === null) {
                const colorFilterOverlay = document.createElement('div');
                colorFilterOverlay.className = 'color-blur-overlay';
                fitgirlLauncher.appendChild(colorFilterOverlay);
                console.log("color filter overlay added");
            }

            const blurOverlay = document.createElement('div');
            blurOverlay.className = 'blur-overlay';
            fitgirlLauncher.appendChild(blurOverlay);
            blurOverlay.style.backgroundColor = `rgba(0, 0, 0, 0.4)`;
            blurOverlay.style.backgroundImage = `url(${selectedImageSrc})`;
            blurOverlay.style.filter = 'blur(15px)';
            blurOverlay.style.top = `-${scrollPosition}px`;
        }
    }

    createEffect(() => {
        const timeOut = setTimeout(randomImageFinder, 500);
        const interval = setInterval(randomImageFinder, 5000);
        onCleanup(() => {
            clearInterval(interval);
            clearTimeout(timeOut);
        });
    });

    return (
        <div className="gamehub-container">
            <div className="Popular-repacks">
                <Popularrepacks />
            </div>
            <div className="New-Games">
                <Newgames />
            </div>
            <div className="Recently-Updated">
                <UpdatedGames />
            </div>
        </div>
    );
}

export default Gamehub;
