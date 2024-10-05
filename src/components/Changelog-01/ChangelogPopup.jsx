import { createSignal, onMount } from 'solid-js';
import './ChangelogPopup.css';

const ChangelogPopup = () => {
  const [isVisible, setIsVisible] = createSignal(true);

  onMount(() => {
    setIsVisible(true);
  });

  const handleClose = () => {
    console.log("Closing popup");
    setIsVisible(false); 
    console.log("Popup visible:", isVisible()); 
    
  };

  return (
    <>
      {isVisible() && (
        <div class="popup-container">
          <div class="changelog-content">
            <h1>Changelog</h1>
            <p class="subheading">Find all the new features, improvements, and bugfixes here.</p>

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
                <li><span class="label new">New:</span>
                  <ul>
                    <li>NSFW filter functionality</li>
                    <li>Safe checker for JSON</li>
                    <li>Hidden beta update option</li>
                    <li>Confirmation notifications for settings</li>
                    <li>Enhanced offline error handling</li>
                  </ul>
                </li>
                <li><span class="label bugfix">Bug fixes:</span>
                  <ul>
                    <li>Automation Setup: Fixed related issues.</li>
                    <li>Tag Scanning: Improved accuracy.</li>
                    <li>Image Display: Resolved issues with popular repacks.</li>
                    <li>Persistence: Corrected file recognition problems.</li>
                    <li>0MB/S Issue: Fixed display issue.</li>
                  </ul>
                </li>
                <li><span class="label improvement">Improvement:</span>
                  <ul>
                    <li>Upgraded to librqbit 7.0.1</li>
                    <li>Asynchronous functions for better performance</li>
                    <li>Added logging and CTG (Currently Torrenting Game) feature</li>
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
