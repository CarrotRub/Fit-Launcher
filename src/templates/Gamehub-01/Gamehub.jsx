import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { invoke } from '@tauri-apps/api/tauri';
import './Gamehub.css'
import Newgames from '../../components/Newgames-01/Newgames';
import Popularrepacks from '../../components/Popularrepacks-01/Popularrepacks';
import UpdatedGames from '../../components/Updatedrepacks-01/Updatedrepacks';
import clearFile from '../../components/functions/clearFileRust';


function Gamehub() {
    onMount(() => {
        let gamehubDiv = document.querySelector('.gamehub-container')
    
        if(gamehubDiv !== null){
          console.log("findit")
          let gamehubLinkText = document.querySelector('#link-gamehub');
          gamehubLinkText.style.backgroundColor = '#ffffff0d'
          gamehubLinkText.style.height = '20px'
          gamehubLinkText.style.borderRadius = '5px'
        }
        console.log("gamehub not found")
    
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
