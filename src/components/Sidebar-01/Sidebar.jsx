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
            
        <li id="link-gamehub" style="border-radius: 5px;display: inline-flex;position: relative;overflow: hidden;background-color: rgba(255, 255, 255, 0.05);">
            <A href="/" class="clickable-link active" link="" aria-current="page" style="position: absolute;top: 0px;display: flex;left: 0px;width: 100%;height: 100%;z-index: 10;text-decoration: none;align-items: center;align-content: center;"></A>
            <nav style="position:relative;z-index:5;display: flex;">
              <svg class="links-svgs" width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1.5 7.615V13.5" stroke="#fff" stroke-width="1.308" stroke-linecap="round"></path>
                <rect x="4.115" y="5.654" width="11.769" height="9.808" rx="1.962" stroke="#fff" stroke-width="1.308"></rect>
                <path d="M18.5 7.615V13.5" stroke="#fff" stroke-width="1.308" stroke-linecap="round"></path>
              </svg>
              <p class="links-texts">Game Hub</p>
            </nav>
        </li>

                <li id="link-library" style="border-radius: 5px;display: inline-flex;position: relative;overflow: hidden;background-color: rgba(255, 255, 255, 0.05);">

                    <A href="/my-library" link="" aria-current="page" style="position: absolute;top: 0px;display: flex;left: 0px;width: 100%;height: 100%;z-index: 10;text-decoration: none;align-items: center;align-content: center;"></A>
                    <nav style="position:relative;z-index:5;display: flex;">
                        <svg className="links-svgs" width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="3.58333" y="4.08333" width="4.66667" height="4.66667" rx="0.583333" stroke="white" strokeWidth="1.16667"/>
                            <rect x="11.75" y="4.08333" width="4.66667" height="4.66667" rx="0.583333" stroke="white" strokeWidth="1.16667"/>
                            <rect x="3.58333" y="12.25" width="4.66667" height="4.66667" rx="0.583333" stroke="white" strokeWidth="1.16667"/>
                            <rect x="11.75" y="12.25" width="4.66667" height="4.66667" rx="0.583333" stroke="white" strokeWidth="1.16667"/>
                        </svg>
                        <p className="links-texts">My Library</p>
                    </nav>


                </li>


          <li id="link-settings" style="border-radius: 5px;display: inline-flex;position: relative;overflow: hidden;background-color: rgba(255, 255, 255, 0.05);">
          <A href="/settings"  link="" aria-current="page" style="position: absolute;top: 0px;display: flex;left: 0px;width: 100%;height: 100%;z-index: 10;text-decoration: none;align-items: center;align-content: center;"></A>

            <nav style="position:relative;z-index:5;display: flex;">
                <svg className="links-svgs" width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9.99992 8C8.61921 8 7.49992 9.11929 7.49992 10.5C7.49992 11.8807 8.61921 13 9.99992 13C11.3806 13 12.4999 11.8807 12.4999 10.5C12.4999 9.11929 11.3806 8 9.99992 8ZM8.74992 10.5C8.74992 9.80964 9.30957 9.25 9.99992 9.25C10.6903 9.25 11.2499 9.80964 11.2499 10.5C11.2499 11.1904 10.6903 11.75 9.99992 11.75C9.30957 11.75 8.74992 11.1904 8.74992 10.5ZM13.2725 5.99792C12.7912 6.08532 12.3299 5.76766 12.2421 5.28842L11.9175 3.5187C11.8852 3.34284 11.7495 3.20376 11.5739 3.16657C11.0602 3.05777 10.5336 3.00244 10 3.00244C9.46611 3.00244 8.93913 3.05784 8.42516 3.16677C8.2495 3.204 8.1138 3.34316 8.08161 3.51908L7.75786 5.2885C7.74925 5.33554 7.73678 5.38189 7.72059 5.427C7.55595 5.88573 7.049 6.12472 6.58828 5.96079L4.88894 5.35578C4.72004 5.29565 4.53139 5.34288 4.41114 5.47541C3.70006 6.25911 3.16114 7.18386 2.834 8.19128C2.77881 8.36124 2.83203 8.54756 2.96878 8.66316L4.34618 9.82757C4.38283 9.85856 4.4169 9.89249 4.44804 9.929C4.76471 10.3003 4.7191 10.857 4.34616 11.1723L2.96878 12.3367C2.83203 12.4523 2.77881 12.6386 2.834 12.8086C3.16114 13.816 3.70006 14.7407 4.41114 15.5244C4.53139 15.657 4.72004 15.7042 4.88894 15.6441L6.58835 15.039C6.63358 15.0229 6.68013 15.0105 6.72746 15.0019C7.20877 14.9145 7.6701 15.2322 7.75788 15.7114L8.08161 17.4808C8.1138 17.6567 8.2495 17.7959 8.42516 17.8331C8.93913 17.942 9.46611 17.9974 10 17.9974C10.5336 17.9974 11.0602 17.9421 11.5739 17.8333C11.7495 17.7961 11.8852 17.657 11.9175 17.4811L12.2421 15.7115C12.2508 15.6643 12.2632 15.618 12.2794 15.5728C12.4441 15.1141 12.951 14.8751 13.4117 15.0391L15.1111 15.6441C15.28 15.7042 15.4686 15.657 15.5889 15.5244C16.2999 14.7407 16.8389 13.816 17.166 12.8086C17.2212 12.6386 17.168 12.4523 17.0312 12.3367L15.6538 11.1723C15.6172 11.1413 15.5831 11.1074 15.552 11.0708C15.2353 10.6995 15.2809 10.1429 15.6538 9.82756L17.0312 8.66316C17.168 8.54756 17.2212 8.36124 17.166 8.19128C16.8389 7.18386 16.2999 6.25911 15.5889 5.47541C15.4686 5.34288 15.28 5.29565 15.1111 5.35578L13.4116 5.96081C13.3664 5.97691 13.3199 5.98932 13.2725 5.99792ZM4.99829 6.72157L6.16903 7.13838C7.27521 7.53198 8.49839 6.96019 8.89711 5.84925C8.93629 5.74009 8.96655 5.62762 8.98745 5.51347L9.20922 4.30141C9.46963 4.2689 9.73355 4.25244 10 4.25244C10.2662 4.25244 10.53 4.26888 10.7902 4.30134L11.0126 5.51397C11.2257 6.676 12.3408 7.43754 13.4959 7.22781C13.6097 7.20714 13.7219 7.1772 13.8309 7.13841L15.0017 6.72157C15.3205 7.13855 15.5855 7.59345 15.7898 8.07579L14.8468 8.873C13.9457 9.63484 13.8343 10.9831 14.6008 11.8819C14.676 11.9701 14.7584 12.0521 14.8468 12.1269L15.7898 12.9241C15.5855 13.4064 15.3205 13.8613 15.0017 14.2783L13.8308 13.8614C12.7246 13.4678 11.5016 14.0397 11.1029 15.1506C11.0637 15.2598 11.0335 15.3723 11.0125 15.4864L10.7902 16.6985C10.53 16.731 10.2662 16.7474 10 16.7474C9.73355 16.7474 9.46963 16.7309 9.20922 16.6984L8.98743 15.4862C8.77456 14.324 7.65929 13.5623 6.50413 13.772C6.39033 13.7927 6.27812 13.8226 6.1691 13.8614L4.99829 14.2783C4.67946 13.8613 4.41451 13.4064 4.21018 12.9241L5.15321 12.1268C6.05429 11.365 6.16567 10.0167 5.39916 9.11791C5.32396 9.02973 5.24165 8.94778 5.15317 8.87297L4.21018 8.07579C4.41451 7.59345 4.67946 7.13855 4.99829 6.72157Z" fill="white"/>
                </svg>
                <p className="links-texts" >Settings </p>
            </nav>
              {/* {translate('settings_placeholder', {})} */}
          </li>
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
