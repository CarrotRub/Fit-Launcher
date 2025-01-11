import { createSignal, onMount } from "solid-js";
import "./changelog.css";

export function Changelog() {
 const [isVisible, setIsVisible] = createSignal(true);
 const [isHidden, setIsHidden] = createSignal(false);

 // Check localStorage on mount to see if the changelog should be shown
 onMount(() => {
  const hideChangelog = localStorage.getItem("hideChangelog") == "true";
  setIsHidden(hideChangelog);
  setIsVisible(!hideChangelog);
 });

 return (
  <>
   {isVisible() && (
    <div class="popup-container">
     <div class="changelog-content">
      <h1>Changelog</h1>
      <p class="subheading">
       Discover the latest features, improvements, and fixes.
      </p>

      <div class="changelog-item">
       <div class="date">Oct 21, 2024 - v1.0.4</div>
       <ul class="bullet-list">
        <li>
         <span class="label new">New Features:</span>
         <ul>
          <li>Added auto-updater functionality</li>
          <li>
           Introduced StopTorrent feature to delete downloaded files alongside
           stopping torrents
          </li>
          <li>Implemented a dropdown filter for game genres selection</li>
          <li>
           Designed a function in Rust to check image brightness, dynamically
           changing category titles based on brightness
          </li>
          <li>Added secrets to environment variables for better security</li>
          <li>
           Enhanced slider design with a new filtering icon allowing the user to
           filter games by genres
          </li>
          <li>Added better torrent configuration options in TOML format</li>
          <li>
           Added Peers Information part in vertical slide (@simplystoned)
          </li>
         </ul>
        </li>
        <li>
         <span class="label bugfix">Bug Fixes:</span>
         <ul>
          <li>
           Fixed issue with stopping game from vertical slide without
           initializing the torrent.
          </li>
          <li>Fixed hardcoded sizing issues, especially for the sidebar</li>
          <li>
           Resolved clipping issues with long game titles that didn't fit
           properly
          </li>
          <li>Corrected Z-index overlap issues with the sidebar</li>
          <li>Fixed library reactivity to improve performance</li>
          <li>Addressed random box shadow inconsistencies across elements</li>
          <li>Fixed hovering issues for game images in the slider</li>
          <li>Improved CSS readability and functionality</li>
          <li>Improved social media icon hovering (Discord & GitHub)</li>
          <li>
           Fixed sidebar useful-links navigation for better maintainability
          </li>
         </ul>
        </li>
        <li>
         <span class="label improvement">Improvements:</span>
         <ul>
          <li>Removed most event listeners for better optimization</li>
          <li>
           Made reload quicker to prevent issues from users spamming the "Save
           Settings" button
          </li>
          <li>
           Replaced regular checkboxes with switches for a more modern look and
           fixed the settings design (@simplystoned)
          </li>
          <li>Hid the sidebar scrollbar for a cleaner design</li>
          <li>Improved download progress bar with better icon alignment</li>
          <li>
           Unified the app's icon set to Lucid Icons for a consistent appearance
          </li>
          <li>
           Enforced NPM fontsource usage for fonts, prohibiting direct changes
           to the app’s font-family
          </li>
          <li>
           Reorganized slider CSS into a dedicated file for better
           maintainability
          </li>
          <li>
           Optimized UI automation and improved logic for smoother interactions
          </li>
         </ul>
        </li>
       </ul>
      </div>

      <div class="changelog-item">
       <div class="date">Oct 11, 2024 - v1.0.3</div>
       <ul class="bullet-list">
        <li>
         <span class="label new">New Features:</span>
         <ul>
          <li>Added popup for Finished Game and Unexpected Resume Error</li>
          <li>Allowed user to restart torrent through vertical slide</li>
          <li>
           Overhauled Settings page with file picker, background image handling,
           and input path clearing
          </li>
          <li>Added changelog popup for displaying updates</li>
          <li>Implemented network error alerts</li>
          <li>Prepared for background image changes in future updates</li>
          <li>Started manual refresh feature for game content updates</li>
         </ul>
        </li>
        <li>
         <span class="label bugfix">Bug Fixes:</span>
         <ul>
          <li>Fixed path replacing issues</li>
          <li>Corrected search bar type for better input validation</li>
          <li>Fixed quick avoidable errors with `?`</li>
          <li>Fixed AppCache issue in JSX</li>
          <li>
           Fixed AppDir and AppConfig compatibility (Unix-Based OS and Windows)
          </li>
         </ul>
        </li>
        <li>
         <span class="label improvement">Improvements:</span>
         <ul>
          <li>
           Increased scraping speed by approximately 70% for faster image
           fetching
          </li>
          <li>Compressed requests with Brotli, Gzip, or Deflate</li>
          <li>Started migration to Stores instead of localStorage</li>
          <li>Added store `restartTorrentInfo`</li>
          <li>Enhanced HTML readability</li>
          <li>Spacing adjustments on changelog</li>
          <li>Deprecation of localStorage usage</li>
          <li>
           Increased logging during scraping and network tasks for better
           debugging
          </li>
          <li>
           Prepared codebase for UI component updates without full window
           reloads
          </li>
          <li>Optimized code for better maintainability and performance</li>
          <li>Added Clippy usage for cleaner code</li>
         </ul>
        </li>
       </ul>
      </div>

      <div class="changelog-item">
       <div class="date">Sep 13, 2024 - v1.0.2</div>
       <ul class="bullet-list">
        <li>
         <span class="label new">New Features:</span>
         <ul>
          <li>NSFW filter functionality</li>
          <li>Safe checker for JSON</li>
          <li>Hidden beta update option</li>
          <li>Confirmation notifications for settings</li>
          <li>Enhanced offline error handling</li>
         </ul>
        </li>
        <li>
         <span class="label bugfix">Bug Fixes:</span>
         <ul>
          <li>Automation setup issues resolved</li>
          <li>Improved tag scanning accuracy</li>
          <li>Image display issues fixed for popular repacks</li>
          <li>Corrected persistence and file recognition problems</li>
          <li>Fixed 0MB/s display issue</li>
         </ul>
        </li>
        <li>
         <span class="label improvement">Improvements:</span>
         <ul>
          <li>Upgraded to librqbit 7.0.1</li>
          <li>Added asynchronous functions for better performance</li>
          <li>Logging and CTG (Currently Torrenting Game) feature</li>
          <li>Improved event handling and DHT persistence</li>
          <li>Safe checker for JSON</li>
         </ul>
        </li>
       </ul>
      </div>

      <div class="checkbox-container">
       <label>
        <input
         type="checkbox"
         checked={isHidden()}
         onchange={event => {
          const shouldHide = event.target.checked;
          setIsHidden(shouldHide);
          localStorage.setItem("hideChangelog", String(shouldHide));
         }}
        />
        Don't show again
       </label>
      </div>

      <button class="close-btn" onclick={() => setIsVisible(false)}>
       Close
      </button>
     </div>
    </div>
   )}
  </>
 );
}
