import { createSignal, onMount } from "solid-js";
import { appConfigDir } from "@tauri-apps/api/path";
import { readTextFile, writeTextFile, exists } from "@tauri-apps/api/fs";

import './Settings.css';

// Define default settings
const defaultSettings = {
  defaultDownloadPath: "",
  autoClean: true,
  hoverTitle: true,
  autoInstall: true,
  importPath: "",
  two_gb_limit: true
};

// Define a function to load settings from the JSON file
async function loadSettings() {
  const configDir = await appConfigDir();
  const settingsPath = `${configDir}/settings.json`;

  try {
    // Check if the settings file exists
    const fileExists = await exists(settingsPath);
    if (!fileExists) {
      // If the file does not exist, create it with default settings
      await writeTextFile(settingsPath, JSON.stringify(defaultSettings, null, 2));
      console.log("Settings file created with default settings.");
      return defaultSettings;
    }

    // If the file exists, read and parse it
    const json = await readTextFile(settingsPath);
    return JSON.parse(json);
  } catch (error) {
    console.error("Failed to load settings:", error);
    return defaultSettings;
  }
}

// Define a function to save settings to the JSON file
async function saveSettings(settings) {
  const configDir = await appConfigDir();
  const settingsPath = `${configDir}/settings.json`;

  try {
    await writeTextFile(settingsPath, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error("Failed to save settings:", error);
  }
}

const SettingsPage = () => {
  // Load settings from the JSON file
  const [settings, setSettings] = createSignal(defaultSettings);
  const [loading, setLoading] = createSignal(true);

    onMount(() => {
        loadSettings().then(initialSettings => {
            setSettings(initialSettings);
            setLoading(false);
          });
    }) 

  // Update settings when values change
  const handleSave = () => {
    saveSettings(settings());
  };



  return (
    <div class="settings-page">
      <h1>Settings</h1>

      {/* Download Settings */}
      <section>
        <h2>Download Settings</h2>
        <div class="form-group">
          <label for="defaultDownloadPath">Default Download Path</label>
          <input 
            type="text" 
            id="defaultDownloadPath" 
            value={settings().defaultDownloadPath} 
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
            Auto-clean game files after installation
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
            Automatic installation of games
          </label>
        </div>
        <div class="form-group">
          <label>
            <input 
              type="checkbox" 
              checked={settings().hoverTitle} 
              onChange={(e) => setSettings({ ...settings(), hoverTitle: e.target.checked })}
            />
            Show hover title on game icons
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
          <span>
            It will be automatically on if you have 8GB or less
          </span>
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
      </section>

      {/* Contacts */}
      <section>
        <h2>Contacts</h2>
        <div class="form-group">
          <a href="https://discord.gg/your-link" target="_blank">Discord</a>
          <a href="https://github.com/CarrotRub/Better-Fitgirl-Repack-Launcher" target="_blank">GitHub</a>
        </div>
      </section>

      <button onClick={handleSave}>Save Settings</button>
    </div>
  );
};

export default SettingsPage;
