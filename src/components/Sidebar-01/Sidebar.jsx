import { createEffect, onMount } from "solid-js";
import { translate } from "../../translation/translate";
import './Sidebar.css'
import Downloadingpartsidebar from "./Downloadingpartsidebar-01/Downloadingpartsidebar";
import Recentlydownloadedgames from "./Recentlydownloaded/Recentlydownloaded";
import { A } from "@solidjs/router";

function Sidebar() {

  return (
    // Sidebar container is a grid.
    <div className="sidebar-container">
      {/* Sidebar's links, such as gamehub and all what will be before the recent games. */}
      <div className="sidebar-links">
        {/* Logo and title always first element. */}
        <div className="app-logo-title">
          <img src="./Square310x310Logo.png" alt="fitgirl repack logo" id="fit-launcher-title-logo"></img>
          <p id="fit-launcher-title">Fit Launcher</p>
        </div>
        {/* Just below the app-logo-title */}
        <ul className="useful-links">
            
        <A href="/" class="clickable-link active" link="" aria-current="page">
            <li id="link-gamehub">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-house">
                  <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/>
                  <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                </svg>

                <p class="links-texts">Game Hub</p>
            </li>
        </A>



        <A href="/my-library" link="" aria-current="page">
            <li id="link-library">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-layout-grid">
                      <rect width="7" height="7" x="3" y="3" rx="1"/>
                      <rect width="7" height="7" x="14" y="3" rx="1"/>
                      <rect width="7" height="7" x="14" y="14" rx="1"/>
                      <rect width="7" height="7" x="3" y="14" rx="1"/>
                    </svg>

                    <p className="links-texts">My Library</p>
            </li>
        </A>


            <A href="/settings"  link="" aria-current="page">
                <li id="link-settings">
        
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bolt">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16"/>
                  <circle cx="12" cy="12" r="4"/>
                </svg>
                <p className="links-texts" >Settings </p>
                {/* {translate('settings_placeholder', {})} */}
                </li>

            </A>
        </ul>
      </div>
      
      {/* Sidebar's recent games, lastly opened. Before the, currently downloading part. */}
      <div className="sidebar-games">
        <p className="sidebar-heading"></p>
        <span className="sidebar-heading-text">
          <br type="text" />RECENTLY DOWNLOADED GAMES<br/>
          {/* {translate('recently_downloaded_games_placeholder', {})} */}
        </span>

        <Recentlydownloadedgames/>

      </div>
      {/* Sidebar's downloading games, currently downloading, one at a time. Last part.*/}
      <div className="sidebar-downloading-game">
        <p className="sidebar-heading">
          <span className="sidebar-heading-text">
            <br/>DOWNLOADING GAMES<br/>
            {/* {translate('downloading_games_placeholder', {})} */}
          </span>
        </p>
        <div className="sidebar-downloading-game-container">
          <Downloadingpartsidebar></Downloadingpartsidebar>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
