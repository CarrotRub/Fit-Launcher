import { createSignal, onMount } from "solid-js";
import { appDataDir } from "@tauri-apps/api/path";
import { readTextFile, writeTextFile, exists, createDir } from "@tauri-apps/api/fs";
import { getVersion } from '@tauri-apps/api/app';
import { checkUpdate, installUpdate } from '@tauri-apps/api/updater';

import './Settings.css';

// Default settings object
const defaultSettings = {
  defaultDownloadPath: "",
  autoClean: true,
  hoverTitle: true,
  autoInstall: true,
  importPath: "",
  two_gb_limit: true,
  hide_nsfw_content: false,
  background_image_path: "",
};
// Load settings 
async function loadSettings() {
  const configDir = await appDataDir();
  const dirPath = `${configDir.replace(/\\/g, '/')}/fitgirlConfig`;
  const settingsPath = `${dirPath}/settings.json`;

  try {
    // Create folder if it does not exist
    const dirExists = await exists(dirPath);
    if (!dirExists) {
      await createDir(dirPath, { recursive: true });
    }

    // Check if the settings file exists, and if not, create it
    const fileExists = await exists(settingsPath);
    if (!fileExists) {
      await writeTextFile(settingsPath, JSON.stringify(defaultSettings, null, 2));
      return defaultSettings;
    }

    // Read and parse the settings file
    const json = await readTextFile(settingsPath);
    let settings = JSON.parse(json);

    // Check if new settings have been added, and add them with default values
    if (!settings.hasOwnProperty('hide_nsfw_content')) {
      settings.hide_nsfw_content = defaultSettings.hide_nsfw_content;
      await writeTextFile(settingsPath, JSON.stringify(settings, null, 2));
    }
  

    return settings;
  } catch (error) {
    console.error("Failed to load settings:", error);
    return defaultSettings;
  }
}

// Save settings to a JSON file
async function saveSettings(settings) {
  const configDir = await appDataDir();
  const dirPath = `${configDir.replace(/\\/g, '/')}/fitgirlConfig`;
  const settingsPath = `${dirPath}/settings.json`;

  try {
    await writeTextFile(settingsPath, JSON.stringify(settings, null, 2));
    return true; // Return true on success
  } catch (error) {
    console.error("Failed to save settings:", error);
    return false; // Return false on error
  }
}

const SettingsPage = () => {
  const [settings, setSettings] = createSignal(defaultSettings);
  const [loading, setLoading] = createSignal(true);
  const [version, setVersion] = createSignal('');
  const [notificationVisible, setNotificationVisible] = createSignal(false);

  onMount(async () => {
    try {
      let gamehubDiv = document.querySelectorAll('.gamehub-container');
      let libraryDiv = document.querySelectorAll('.launcher-container');
      let settingsDiv = document.querySelectorAll('.settings-page');

      if(gamehubDiv){

        let gamehubLinkText = document.querySelector('#link-gamehub');
        gamehubLinkText.style.backgroundColor = ''
      }

      if(libraryDiv){

          let libraryLinkText = document.querySelector('#link-library');
          libraryLinkText.style.backgroundColor = '';
      }

      if(settingsDiv){

          let settingsLinkText = document.querySelector('#link-settings');
          settingsLinkText.style.backgroundColor = '#ffffff0d';
          settingsLinkText.style.borderRadius = '5px';
      }
      // Load settings from the JSON file
      const initialSettings = await loadSettings();
      setSettings(initialSettings);

      // Fetch the app version
      const appVersionValue = await getVersion();
      setVersion(appVersionValue);

    } catch (error) {
      console.error('Error during initialization:', error);
    } finally {
      setLoading(false); 
    }
  });

  // Save settings and show notification
  const handleSave = async () => {
    const success = await saveSettings(settings());
    if (success) {
      setNotificationVisible(true);  // Show notification
      setTimeout(() => {
        setNotificationVisible(false);  // Hide notification after 3 seconds
      }, 3000);
    }
  };

  // Check for updates function
  const handleCheckForUpdates = async () => {
    try {
      const { shouldUpdate } = await checkUpdate();
      if (shouldUpdate) {
        await installUpdate();
      } else {
        alert('You are already on the latest version.');
      }
    } catch (error) {
      alert('Failed to check for updates.');
    }
  };

  const lastInputPath = localStorage.getItem('LUP');

  return (
    <div class="settings-page">
      <h1>Settings</h1>

      {/* Notification box */}
      {notificationVisible() && (
        <div class={`notification ${notificationVisible() ? 'show' : ''}`}>
          Settings saved successfully!
        </div>
      )}

      {/* Download Settings */}
      <section>
        <h2>Download Settings</h2>
        <div class="form-group">
          <label for="defaultDownloadPath">Default Download Path</label>
          <input
            type="text"
            id="defaultDownloadPath"
            value={settings().defaultDownloadPath ? settings().defaultDownloadPath : lastInputPath}
            onInput={(e) => setSettings({ ...settings(), defaultDownloadPath: e.target.value })}
            placeholder="Enter default download path"
          />
        </div>
        <div class="form-group">
          <label>
            <input
              type="checkbox"
              checked={settings().autoClean}
              onChange={(e) => setSettings({ ...settings(), autoClean: e.target.checked })}
            />
            Auto-clean game files after installation. <strong>//Not working//</strong>
          </label>
        </div>
      </section>

      {/* Installation Settings */}
      <section>
        <h2>Installation Settings</h2>
        <div class="form-group">
          <label>
            <input
              type="checkbox"
              checked={settings().autoInstall}
              onChange={(e) => setSettings({ ...settings(), autoInstall: e.target.checked })}
            />
            Automatic installation of games. (This will automatically start the installation process after downloading the game)
          </label>
        </div>
        <div class="form-group">
          <label>
            <input
              type="checkbox"
              checked={settings().hoverTitle}
              onChange={(e) => setSettings({ ...settings(), hoverTitle: e.target.checked })}
            />
            Show hover title on game icons (useful for long game names).
          </label>
        </div>
        <div class="form-group">
          <label>
            <input
              type="checkbox"
              checked={settings().two_gb_limit}
              onChange={(e) => setSettings({ ...settings(), two_gb_limit: e.target.checked })}
            />
            Limit the installer to 2GB of RAM. (It will be automatically on if you have 8GB or less)
          </label>
        </div>
        <div class="form-group">
          <label>
            <input
              type="checkbox"
              checked={settings().hide_nsfw_content}
              onChange={(e) => setSettings({ ...settings(), hide_nsfw_content: e.target.checked })}
            />
            Hide NSFW content. (This will hide all NSFW content from the app)
          </label>
        </div>
      </section>

      {/* Import Settings */}
      <section>
        <h2>Import Settings</h2>
        <div class="form-group">
          <label for="importPath">Import Downloaded Games JSON File</label>
          <input
            type="text"
            id="importPath"
            value={settings().importPath}
            onInput={(e) => setSettings({ ...settings(), importPath: e.target.value })}
            placeholder="Enter path to imported games"
          />
        </div>

        {/* TODO: Background Image Path */}
        {/* <div class="form-group">
          <label for="background_image_path">Choose background image</label>
          <input
            type="text"
            id="background_image_path"
            value={settings().background_image_path}
            onInput={(e) => setSettings({ ...settings(), background_image_path: e.target.value })}
            placeholder="Enter path to image"
          />
        </div> */}
      </section>

      {/* Fit Launcher Information */}
      <section>
        <h2>Fit Launcher Information</h2>
        <div class="form-group">
          <label>
            <p>Application Version: {version()}</p>
          </label>
          {/* <button class="boton-elegante" onClick={handleCheckForUpdates}>Check for updates</button>  */}
        </div>
      </section>

      {/* Contacts */}
      <section>
        <h2>Contacts</h2>
        <div class="form-group">
          <a href="https://discord.gg/cXaBWdcUSF" target="_blank">Discord</a>
          <a href="https://github.com/CarrotRub/Fit-Launcher/" target="_blank">GitHub</a>
        </div>
      </section>

      <button class="boton-elegante" onClick={handleSave}>Save Settings</button>
    </div>
  );
};

export default SettingsPage;
