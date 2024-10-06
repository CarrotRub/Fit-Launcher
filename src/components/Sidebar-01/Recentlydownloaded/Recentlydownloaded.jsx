import { createSignal, onMount } from "solid-js";
import { appDataDir } from "@tauri-apps/api/path";
import readFile from "../../functions/readFileRust";

import './Recentlydownloaded.css';

function Recentlydownloadedgames() {

    onMount( async () => {
        const appDir =  await appDataDir();
        const dirPath = appDir.replace(/\\/g, '/');

        let downloadedGamesPath = `${dirPath}data/downloaded_games.json`;

        const fileContent = await readFile(downloadedGamesPath);
        let gamesData = JSON.parse(fileContent.content);
        
        const sidebarGamesContainer = document.querySelector(".sidebar-games-container");
        
        let gameCount = 0;
        gamesData = gamesData.sort(function(x, y){
            return  y.timestamp - x.timestamp ;
        })
        gamesData.forEach(game => {

            if(gameCount >= 2) {
                return;
            }
            console.log("Searching Data...");
            const title = game.title;
            const img = game.img;

            const uniqueGameDiv = document.createElement('div');
            uniqueGameDiv.className = "sidebar-unique-game";

            const imgElement = document.createElement('img');
            imgElement.src = img;
            console.log(title);
            console.log(img);
            imgElement.alt = title;

            // Append image to uniqueGameDiv
            uniqueGameDiv.appendChild(imgElement);

            const titleElement = document.createElement('p');
            titleElement.className = 'sidebar-unique-game-title';
            titleElement.textContent = title;
            uniqueGameDiv.appendChild(titleElement);

            sidebarGamesContainer.appendChild(uniqueGameDiv);
            gameCount += 1;
        });
    })


    return (

        <div className="sidebar-games-container">
          {/* Here should be all recent games played, displayed in a grid. */}
        </div>
        

    )
}

export default Recentlydownloadedgames;