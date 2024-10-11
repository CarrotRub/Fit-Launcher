import { createSignal, onMount } from 'solid-js';
import './ChangelogPopup.css';

const ChangelogPopup = () => {
  const [isVisible, setIsVisible] = createSignal(true);
  const [isHidden, setIsHidden] = createSignal(false);

  // Check localStorage on mount to see if the changelog should be shown
  onMount(() => {
    const hideChangelog = localStorage.getItem('hideChangelog') === 'true';
    setIsHidden(hideChangelog);
    setIsVisible(!hideChangelog);
  });

  const handleClose = () => {
    setIsVisible(false);
  };

  const handleCheckboxChange = (e) => {
    const shouldHide = e.target.checked;
    setIsHidden(shouldHide);
    localStorage.setItem('hideChangelog', shouldHide);
  };

  return (
    <>
      {isVisible() && (
        <div class="popup-container">
          <div class="changelog-content">
            <h1>Changelog</h1>
            <p class="subheading">Discover the latest features, improvements, and fixes.</p>

            <div class="changelog-item">
              <div class="date">Oct 11, 2024 - v1.0.3</div>
              <ul class="bullet-list">
                <li><span class="label new">New Features:</span>
                  <ul>
                    <li>Added popup for Finished Game and Unexpected Resume Error</li>
                    <li>Allowed user to restart torrent through vertical slide</li>
                    <li>Overhauled Settings page with file picker, background image handling, and input path clearing</li>
                    <li>Added changelog popup for displaying updates</li>
                    <li>Implemented network error alerts</li>
                    <li>Prepared for background image changes in future updates</li>
                    <li>Started manual refresh feature for game content updates</li>
                  </ul>
                </li>
                <li><span class="label bugfix">Bug Fixes:</span>
                  <ul>
                    <li>Fixed path replacing issues</li>
                    <li>Corrected search bar type for better input validation</li>
                    <li>Fixed quick avoidable errors with `?`</li>
                    <li>Fixed AppCache issue in JSX</li>
                    <li>Fixed AppDir and AppConfig compatibility (Unix-Based OS and Windows)</li>
                  </ul>
                </li>
                <li><span class="label improvement">Improvements:</span>
                  <ul>
                    <li>Increased scraping speed by approximately 70% for faster image fetching</li>
                    <li>Compressed requests with Brotli, Gzip, or Deflate</li>
                    <li>Started migration to Stores instead of localStorage</li>
                    <li>Added store `restartTorrentInfo`</li>
                    <li>Enhanced HTML readability</li>
                    <li>Spacing adjustments on changelog</li>
                    <li>Deprecation of localStorage usage</li>
                    <li>Increased logging during scraping and network tasks for better debugging</li>
                    <li>Prepared codebase for UI component updates without full window reloads</li>
                    <li>Optimized code for better maintainability and performance</li>
                    <li>Added Clippy usage for cleaner code</li>
                  </ul>
                </li>
              </ul>
            </div>

            <div class="changelog-item">
              <div class="date">Sep 13, 2024 - v1.0.2</div>
              <ul class="bullet-list">
                <li><span class="label new">New Features:</span>
                  <ul>
                    <li>NSFW filter functionality</li>
                    <li>Safe checker for JSON</li>
                    <li>Hidden beta update option</li>
                    <li>Confirmation notifications for settings</li>
                    <li>Enhanced offline error handling</li>
                  </ul>
                </li>
                <li><span class="label bugfix">Bug Fixes:</span>
                  <ul>
                    <li>Automation setup issues resolved</li>
                    <li>Improved tag scanning accuracy</li>
                    <li>Image display issues fixed for popular repacks</li>
                    <li>Corrected persistence and file recognition problems</li>
                    <li>Fixed 0MB/s display issue</li>
                  </ul>
                </li>
                <li><span class="label improvement">Improvements:</span>
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
                  onChange={handleCheckboxChange} 
                />
                Don't show again
              </label>
            </div>

            <button class="close-btn" onClick={handleClose}>Close</button>
          </div>
        </div>
      )}
    </>
  );
};

export default ChangelogPopup;
