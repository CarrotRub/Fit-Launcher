import { createSignal, onMount } from "solid-js";
import { appConfigDir } from "@tauri-apps/api/path";
import { readTextFile, writeTextFile, exists } from "@tauri-apps/api/fs";
import { createDir } from "@tauri-apps/api/fs";
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
  const dirPath = `${configDir.replace(/\\/g, '/')}/fitgirlConfig`; // Define the directory path
  const settingsPath = `${dirPath}/settings.json`; // Define the settings file path

  try {
    // Check if the directory exists, and if not, create it
    const dirExists = await exists(dirPath);
    if (!dirExists) {
      await createDir(dirPath, { recursive: true });
      console.log("Directory created:", dirPath);
    }

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
  const dirPath = `${configDir.replace(/\\/g, '/')}fitgirlConfig`; // Define the directory path
  const settingsPath = `${dirPath}/settings.json`; // Define the settings file path

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

        loadSettings().then(initialSettings => {
            setSettings(initialSettings);
            setLoading(false);
          });
    }) 

  // Update settings when values change
  const handleSave = () => {
    saveSettings(settings());
  };


  const lastInputPath = localStorage.getItem('LUP');

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
            value={settings().defaultDownloadPath ? settings().defaultDownloadPath : lastInputPath } 
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
            Automatic installation of games.
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
          <a href="https://discord.gg/cXaBWdcUSF" target="_blank">Discord</a>
          <a href="https://github.com/CarrotRub/Fit-Launcher/" target="_blank">GitHub</a>
        </div>
      </section>

      <button onClick={handleSave}>Save Settings</button>
    </div>
  );
};

export default SettingsPage;
