import { createSignal, onMount } from 'solid-js';
import { getVersion } from '@tauri-apps/api/app';
import './ChangelogPopup.css';

const ChangelogPopup = () => {
  const [isVisible, setIsVisible] = createSignal(false);
  const [newVersion, setNewVersion] = createSignal('');
  const [currentVersion, setCurrentVersion] = createSignal(localStorage.getItem('currentVersion') || '');

  // Function to compare versions
  const isVersionGreater = (newVer, currVer) => {
    const newParts = newVer.split('.').map(Number);
    const currParts = currVer.split('.').map(Number);

    console.log(`Comparing versions: New Version - ${newVer}, Current Version - ${currVer}`);
    for (let i = 0; i < newParts.length; i++) {
      if (newParts[i] > (currParts[i] || 0)) {
        return true;
      }
      if (newParts[i] < (currParts[i] || 0)) {
        console.log(`New version ${newVer} is not greater than current version ${currVer}`);
        return false;
      }
    }
    console.log(`Versions are equal: ${newVer} == ${currVer}`);
    return false;
  };

  // Fetch the version and check for updates on mount
  onMount(async () => {
    const version = await getVersion();
    console.log(`Fetched version from app: ${version}`);
    setNewVersion(version);

    const storedCurrentVersion = currentVersion();

    const hideChangelog = localStorage.getItem('hideChangelog') === 'true';

    // Show changelog if version is higher or if hideChangelog is false
    if (isVersionGreater(version, storedCurrentVersion) || !hideChangelog) {
      setIsVisible(true);
      localStorage.setItem('hideChangelog', 'false');
    } else {
    }

    // Update currentVersion in localStorage if new version is detected
    if (isVersionGreater(version, storedCurrentVersion)) {
      localStorage.setItem('currentVersion', version);
      setCurrentVersion(version);
    } else {
    }
  });

  const handleClose = () => {
    setIsVisible(false);
    localStorage.setItem('hideChangelog', 'true');
  };

  const handleLearnMore = () => {
    window.open('https://example.com');
  };

  return (
    <>
      {isVisible() && (
        <div class="popup-container">
          <div class="popup-overlay"></div>
          <div class="changelog-content">
            <h1>What's New in Version {newVersion()}</h1>
            <p class="subheading">Released on October 21, 2024.</p>

            <div class="changelog-item">
              <ul class="bullet-list">
                <li>
                  <span class="label new">New Features:</span>
                  <ul>
                    <li>Auto-updater functionality added</li>
                    <li>StopTorrent deletes downloaded files when stopping torrents</li>
                    <li>Dropdown filter for game genres selection</li>
                    <li>Rust function to check image brightness</li>
                  </ul>
                </li>
                <li>
                  <span class="label bugfix">Bug Fixes:</span>
                  <ul>
                    <li>Resolved torrent stopping issue</li>
                    <li>Fixed sidebar clipping with long game titles</li>
                    <li>Improved CSS readability</li>
                  </ul>
                </li>
                <li>
                  <span class="label improvement">Improvements:</span>
                  <ul>
                    <li>Removed most event listeners</li>
                    <li>Unified icon set to Lucid Icons</li>
                  </ul>
                </li>
              </ul>
            </div>

            <div class="line"></div>
            <div class="button-container">
              <button class="learn-more-btn" onClick={handleLearnMore}>LEARN MORE</button>
              <button class="close-btn" onClick={handleClose}>GOT IT</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChangelogPopup;
