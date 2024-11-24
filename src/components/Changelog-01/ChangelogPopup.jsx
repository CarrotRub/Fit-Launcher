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
        <li>Added the ability to favorite and unfavorite games for easy access. (SimplyStoned)</li>
        <li>Introduced the "Collections" feature, allowing users to create and organize games into collections. (SimplyStoned)</li>
        <li>Enhanced filtering options to display All Games, Favorites, or specific Collections. (SimplyStoned)</li>
        <li>Added clear button for the search bar to quickly reset queries. (SimplyStoned)</li>
        <li>Prepared codebase to support future features such as favoriting and collections. (SimplyStoned)</li>
      </ul>
    </li>
    <li>
      <span class="label bugfix">Bug Fixes:</span>
      <ul>
        <li>Fixed a scraping issue with the new GTA V "4Barbra Streisand” Edition. (CarrotRub)</li>
        <li>Improved error handling to display placeholders for images that fail to load in "Recently Downloaded Games." (SimplyStoned)</li>
        <li>Corrected alert messaging in Settings for clearer feedback. (SimplyStoned)</li>
        <li>Corrected bug fix by reversing to the older version of the vertical slide bar (CarrotRub)</li>
      </ul>
    </li>
    <li>
      <span class="label improvement">Improvements:</span>
      <ul>
        <li>Removed default auto-fill in search results for better accuracy. (SimplyStoned)</li>
        <li>Refined and improved UI components for a smoother experience. (SimplyStoned)</li>
        <li>Cleaned up code for better maintainability. (SimplyStoned)</li>
        <li>Updated changelog and search results UI for improved readability. (SimplyStoned)</li>
        <li>Hidden download data by default, with an option to unhide as needed. (SimplyStoned)</li>
        <li>Enhanced game image loading speeds by an order of magnitude. (CarrotRub)</li>
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
