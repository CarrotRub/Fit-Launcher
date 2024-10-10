import { createSignal, onMount } from 'solid-js';
import './ChangelogPopup.css';

const ChangelogPopup = () => {
  const [isVisible, setIsVisible] = createSignal(true);

  onMount(() => {
    setIsVisible(true);
  });

  const handleClose = () => {
    setIsVisible(false);
  };

  return (
    <>
      {isVisible() && (
        <div class="popup-container">
          <div class="changelog-content">
            <h1>Changelog</h1>
            <p class="subheading">Discover the latest features, improvements, and fixes.</p>

            <div class="changelog-item">
              <div class="date">Oct x, 2024 - v1.0.3</div>
              <ul class="bullet-list">
                <li><span class="label new">New:</span> FIT</li>
                <li><span class="label bugfix">Bugfix:</span> FIT</li>
                <li><span class="label improvement">Improvement:</span> FIT</li>
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

            <button class="close-btn" onClick={handleClose}>Close</button>
          </div>
        </div>
      )}
    </>
  );
};

export default ChangelogPopup;
