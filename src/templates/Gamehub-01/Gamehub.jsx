import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { invoke } from '@tauri-apps/api/tauri';
import './Gamehub.css'
import Newgames from '../../components/Newgames-01/Newgames';
import Popularrepacks from '../../components/Popularrepacks-01/Popularrepacks';
import UpdatedGames from '../../components/Updatedrepacks-01/Updatedrepacks';
import clearFile from '../../components/functions/clearFileRust';
import { appConfigDir } from "@tauri-apps/api/path";
import { readTextFile, writeTextFile, exists } from "@tauri-apps/api/fs";
import { createDir } from "@tauri-apps/api/fs";

function Gamehub() {
    onMount(() => {

        // Define default settings
        const defaultSettings = {
            defaultDownloadPath: "",
            autoClean: true,
            hoverTitle: true,
            autoInstall: true,
            importPath: "",
            two_gb_limit: true
        };

        // Define a function to load settings from the JSON file
        async function loadSettings() {
          const configDir = await appConfigDir();
          const dirPath = `${configDir.replace(/\\/g, '/')}/fitgirlConfig`; // Define the directory path
          const settingsPath = `${dirPath}/settings.json`; // Define the settings file path
    
          try {
            // Check if the directory exists, and if not, create it
            const dirExists = await exists(dirPath);
            if (!dirExists) {
              await createDir(dirPath, { recursive: true });
              console.log("Directory created:", dirPath);
            }
        
            // Check if the settings file exists
            const fileExists = await exists(settingsPath);
            if (!fileExists) {
              // If the file does not exist, create it with default settings
              await writeTextFile(settingsPath, JSON.stringify(defaultSettings, null, 2));
              console.log("Settings file created with default settings.");
              return defaultSettings;
            }
        
            // If the file exists, read and parse it
            const json = await readTextFile(settingsPath);
            return JSON.parse(json);
          } catch (error) {
            console.error("Failed to load settings:", error);
            return defaultSettings;
          }
        }
  



        let gamehubDiv = document.querySelector('.gamehub-container');
        let libraryDiv = document.querySelectorAll('.launcher-container');
        let settingsDiv = document.querySelectorAll('.settings-page');

        if(gamehubDiv){
          console.log("findit")
          let gamehubLinkText = document.querySelector('#link-gamehub');
          gamehubLinkText.style.backgroundColor = '#ffffff0d';
          gamehubLinkText.style.borderRadius = '5px';
        }
        if(libraryDiv){
            console.log("findit")
            let libraryLinkText = document.querySelector('#link-library');
            libraryLinkText.style.backgroundColor = '';
        }

        if(settingsDiv){

            let gamehubLinkText = document.querySelector('#link-settings');
            gamehubLinkText.style.backgroundColor = '';
            
        }

      })
    const singularGamePath = '../src/temp/singular_games.json';
    
    createEffect(async () => {
        await clearFile(singularGamePath);
        invoke('stop_get_games_images');
    })

    function randomImageFinder() {
        const imageElements = document.querySelectorAll(".gamehub-container img");
        if (imageElements.length > 0) {
            const randomIndex = Math.floor(Math.random() * imageElements.length);
            const selectedImageSrc = imageElements[randomIndex].getAttribute('src');

            const fitgirlLauncher = document.querySelector('.gamehub-container');
            const scrollPosition = window.scrollY || document.documentElement.scrollTop;
    

            const docBlurOverlay = document.querySelector('.blur-overlay')
            if (docBlurOverlay != null) {
                docBlurOverlay.remove()
            }
            
            const docColorFilterOverlay = document.querySelector('.color-blur-overlay')
            if (docColorFilterOverlay === null){
                const colorFilterOverlay = document.createElement('div');
                colorFilterOverlay.className = 'color-blur-overlay';
                fitgirlLauncher.appendChild(colorFilterOverlay)
                console.log("colroe")

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
            clearInterval(interval)
            clearTimeout(timeOut);
        });
    })

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
    )
}

export default Gamehub;
