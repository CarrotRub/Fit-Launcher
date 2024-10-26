import { createSignal, onMount } from "solid-js";
import { appConfigDir } from "@tauri-apps/api/path";
import {
  readTextFile,
  writeTextFile,
  exists,
  createDir,
  writeFile,
  copyFile,
  removeFile,
} from "@tauri-apps/api/fs";
import { getVersion } from "@tauri-apps/api/app";
import { checkUpdate, installUpdate } from "@tauri-apps/api/updater";
import { open, message } from "@tauri-apps/api/dialog";
import { resolveResource } from "@tauri-apps/api/path";
import { resourceDir } from "@tauri-apps/api/path"; // Use resourceDir for resolving the assets path
import { join, sep, appDir, appDataDir } from "@tauri-apps/api/path";
import { readBinaryFile } from "@tauri-apps/api/fs";

import "./Settings.css";
import Swal from "sweetalert2";

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
  background_image_64: "",
};
// Load settings
async function loadSettings() {
  const configDir = await appConfigDir();
  const dirPath = `${configDir.replace(/\\/g, "/")}/fitgirlConfig`;
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
      await writeTextFile(
        settingsPath,
        JSON.stringify(defaultSettings, null, 2)
      );
      return defaultSettings;
    }

    // Read and parse the settings file
    const json = await readTextFile(settingsPath);
    let settings = JSON.parse(json);

    // Check if new settings have been added, and add them with default values
    if (!settings.hasOwnProperty("hide_nsfw_content")) {
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
  const configDir = await appConfigDir();
  const dirPath = `${configDir.replace(/\\/g, "/")}/fitgirlConfig`;
  const settingsPath = `${dirPath}/settings.json`;

  try {
    await writeTextFile(settingsPath, JSON.stringify(settings, null, 2));
    return true;
  } catch (error) {
    console.error("Failed to save settings:", error);
    return false;
  }
}

const SettingsPage = () => {
  const [settings, setSettings] = createSignal(defaultSettings);
  const [loading, setLoading] = createSignal(true);
  const [version, setVersion] = createSignal("");
  const [notificationVisible, setNotificationVisible] = createSignal(false);
  const [notificationMessage, setNotificationMessage] = createSignal("");
  const [selectedDownloadPath, setSelectedDownloadPath] = createSignal(
    localStorage.getItem("LUP") || ""
  );
  const [selectedImportPath, setSelectedImportPath] = createSignal(
    localStorage.getItem("LIP") || ""
  );
  const [selectedBackgroundImagePath, setSelectedBackgroundImagePath] =
    createSignal(localStorage.getItem("LBIP") || "");

  // Show the selected background image path
  const [selectedBackgroundImagePath_1, setSelectedBackgroundImagePath_1] =
    createSignal(localStorage.getItem("LBIP_PATH_64") || "");

  onMount(async () => {
    try {
      let gamehubDiv = document.querySelectorAll(".gamehub-container");
      let libraryDiv = document.querySelectorAll(".launcher-container");
      let settingsDiv = document.querySelectorAll(".settings-page");

      if (gamehubDiv) {
        let gamehubLinkText = document.querySelector("#link-gamehub");
        gamehubLinkText.style.backgroundColor = "";
      }

      if (libraryDiv) {
        let libraryLinkText = document.querySelector("#link-library");
        libraryLinkText.style.backgroundColor = "";
      }

      if (settingsDiv) {
        let settingsLinkText = document.querySelector("#link-settings");
        settingsLinkText.style.backgroundColor = "#ffffff0d";
        settingsLinkText.style.borderRadius = "5px";
      }
      // Load settings from the JSON file
      const initialSettings = await loadSettings();
      setSettings(initialSettings);

      // Fetch the app version
      const appVersionValue = await getVersion();
      setVersion(appVersionValue);
    } catch (error) {
      console.error("Error during initialization:", error);
    } finally {
      setLoading(false);
    }
  });

  // Save settings and show notification
  const handleSave = async () => {
    const success = await saveSettings(settings());
    if (success) {
      Swal.fire({
        title: "Settings Saved",
        text: "Your settings have been saved successfully.",
        icon: "success",
        confirmButtonText: "OK",
      });
    } else {
      Swal.fire({
        title: "Error",
        text: "An error occurred while saving your settings. Please try again later.",
        icon: "error",
        confirmButtonText: "OK",
      });
    }
  };

  const selectDownloadPath = async () => {
    try {
      const selectDownloadPath = await open({
        directory: true,
        multiple: false,
        defaultPath: settings().defaultDownloadPath,
      });

      if (selectDownloadPath) {
        const newSettings = {
          ...settings(),
          defaultDownloadPath: selectDownloadPath,
        };
        setSettings(newSettings);

        setSelectedDownloadPath(selectDownloadPath);
        localStorage.setItem("LUP", selectDownloadPath);
        await saveSettings(newSettings);
      }
    } catch (error) {
      console.error("Settings: Failed to select download path:", error);
    }
  };

  const clearDownloadPath = () => {
    setSelectedDownloadPath("");
    localStorage.setItem("LUP", "");

    // Remove from settings
    const newSettings = {
      ...settings(),
      defaultDownloadPath: "",
    };
    saveSettings(newSettings);
  };

  const selectImportPath = async () => {
    try {
      const selectImportPath = await open({
        directory: true,
        multiple: false,
      });

      if (selectImportPath) {
        const newSettings = {
          ...settings(),
          importPath: selectImportPath,
        };
        setSettings(newSettings);

        setSelectedImportPath(selectImportPath);
        localStorage.setItem("LIP", selectImportPath);
        await saveSettings(newSettings);
      }
    } catch (error) {
      console.error("Settings: Unable to select import path: ", error);

      swalMessages.error.text = "An error occurred while selecting the import path. Please try again.";
    }
  };

  const clearImportPath = () => {
    setSelectedImportPath("");
    localStorage.setItem("LIP", "");

    // Remove from settings
    const newSettings = {
      ...settings(),
      importPath: "",
    };
    saveSettings(newSettings);
  };

  const selectBackgroundImage = async () => {
    try {
      const selectedBackgroundImage = await open({
        multiple: false,
        filters: [
          {
            name: "Image",
            extensions: ["png", "jpeg", "jpg"],
          },
        ],
      });

      if (selectedBackgroundImage) {
          // Notify the user that the background is being applied
          Swal.fire({
            title: "Background image",
            text: `Applying background image, please wait..`,
            timerProgressBar: true,
            didOpen: () => {
              Swal.showLoading();
            },
          });
  
        // Read the binary data of the image file
        const imageData = await readBinaryFile(selectedBackgroundImage);

        // Convert the binary data to a base64 string
        const base64String = btoa(
          new Uint8Array(imageData).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ""
          )
        );

        // Create a data URL for the image
        const dataUrl = `data:image/jpeg;base64,${base64String}`;

        // Save the data URL instead of the file path
        const newSettings = {
          ...settings(),
          background_image_path_64: dataUrl, // Store the base64 data URL
          background_image_path: selectedBackgroundImage, // Store the file path
        };

        setSettings(newSettings);
        setSelectedBackgroundImagePath(selectedBackgroundImage);
        localStorage.setItem("LBIP_PATH_64", dataUrl);
        localStorage.setItem("LBIP", selectedBackgroundImage);
        await saveSettings(newSettings);

        // Delay the reload slightly to allow the notification to appear (Not 1.5sec, too long, the user will click on save settings again and it will break)
        setTimeout(() => {
            window.location.reload()
        }, 2000)
      }
    } catch (error) {
      console.error(
        "Settings: There was an issue selecting the background image:",
        error
      );
      Swal.fire({
        title: "Error",
        text: "An error occurred while selecting the background image. Please try again.",
        timerProgressBar: true,
        timer: 2000,
        didOpen: () => {
          Swal.showLoading();
        }

      });
    }
  };

  // Clear the background image path and set it to an empty string
  const clearBackgroundImagePath = async () => {
    setSelectedBackgroundImagePath("");
    localStorage.setItem("LBIP", "");
    localStorage.setItem("LBIP_PATH_64", "");

    // Remove from settings
    const newSettings = {
      ...settings(),
      background_image_path: "",
      background_image_path_64: "",
    };
    await saveSettings(newSettings);
    setSettings(newSettings);

    // Notify the user that the background is being removed
    Swal.fire({
      title: "Background Image",
      text: "Removing background image, please wait..",
      timerProgressBar: true,
      timer: 2000,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    setTimeout(() => {
        window.location.reload()
    }, 2000);

  };
  
  const swalMessages = {
    error: {
      title: "Error",
      icon: "error",
      confirmButtonText: "OK",
    },
    success: {
      title: "Success",
      icon: "success",
      confirmButtonText: "OK",
    },
  };


  // Check for updates function
  const handleCheckForUpdates = async () => {
    try {
      const { shouldUpdate } = await checkUpdate();
      if (shouldUpdate) {
        await installUpdate();
      } else {
        Swal.fire({
          title: "No updates available",
          text: "You are already using the latest version of Fit Launcher.",
          timerProgressBar: true,
          timer: 2000,
          didOpen: () => {
            Swal.showLoading();
          },
        });
      }
    } catch (error) {
      Swal.fire({
        title: "Error",
        text: "An error occurred while checking for updates. Please try again later.",
        icon: "error",
        confirmButtonText: "OK",
      });
    }
  };

  return (
    <div class="settings-page">
      <h1>Settings</h1>

      {/* Notification box */}
      {notificationVisible() && (
        <div class={`notification ${notificationVisible() ? "show" : ""}`}>
          {notificationMessage()}
        </div>
      )}
      {/* Installation Settings start*/}
      <section>
        <h2>Installation Settings</h2>
        <div class="form-group">
          <label>
            <input
              className="switch"
              type="checkbox"
              checked={settings().autoInstall}
              onChange={(e) =>
                setSettings({
                  ...settings(),
                  autoInstall: e.target.checked,
                })
              }
            />
            Automatic installation of games. (This will automatically start the
            installation process after downloading the game)
          </label>
        </div>
        <div class="form-group">
          <label>
            <input
              class="switch"
              type="checkbox"
              checked={settings().autoClean}
              onChange={(e) =>
                setSettings({
                  ...settings(),
                  autoClean: e.target.checked,
                })
              }
            />
            Auto-clean game files after installation.{" "}
            <strong>//Not working//</strong>
          </label>
        </div>
        <div class="form-group">
          <label>
            <input
              class="switch"
              type="checkbox"
              checked={settings().hoverTitle}
              onChange={(e) =>
                setSettings({
                  ...settings(),
                  hoverTitle: e.target.checked,
                })
              }
            />
            Show hover title on game icons (useful for long game names).
          </label>
        </div>
        <div class="form-group">
          <label>
            <input
              class="switch"
              type="checkbox"
              checked={settings().two_gb_limit}
              onChange={(e) =>
                setSettings({
                  ...settings(),
                  two_gb_limit: e.target.checked,
                })
              }
            />
            Limit the installer to 2GB of RAM. (It will be automatically on if
            you have 8GB or less)
          </label>
        </div>
        <div class="form-group">
          <label>
            <input
              class="switch"
              type="checkbox"
              checked={settings().hide_nsfw_content}
              onChange={(e) =>
                setSettings({
                  ...settings(),
                  hide_nsfw_content: e.target.checked,
                })
              }
            />
            Hide NSFW content. (This will hide all NSFW content from the
            launcher)
          </label>
        </div>
      </section>
      {/* Installation Settings End*/}

      {/* Download Settings */}
      <section>
        <h2>Download Settings</h2>
        <div class="upload-container">
          <div class="upload-btn-wrapper">
            <button class="upload-btn" onClick={selectDownloadPath}>
              Choose Download Path
            </button>
          </div>
          <div class="path-box-inline">
            <p class="path-output-inline">
              {selectedDownloadPath()
                ? selectedDownloadPath()
                : "No download path selected"}
            </p>
            {selectedDownloadPath() && (
              <button class="clear-btn" onClick={clearDownloadPath}>
                ✕
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Import Settings */}
      <section>
        <h2>Import Settings</h2>
        <div class="upload-container">
          <div class="upload-btn-wrapper">
            <button class="upload-btn" onClick={selectImportPath}>
              Choose Import File
            </button>
          </div>
          <div class="path-box-inline">
            <p class="path-output-inline">
              {selectedImportPath()
                ? selectedImportPath()
                : "No import path selected"}
            </p>
            {selectedImportPath() && (
              <button class="clear-btn" onClick={clearImportPath}>
                ✕
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Background Image Settings */}
      <section>
        <h2>Background Image</h2>
        <div class="upload-container">
          <div class="upload-btn-wrapper">
            <button class="upload-btn" onClick={selectBackgroundImage}>
              Select Background Image
            </button>
          </div>
          <div class="path-box-inline">
            <p class="path-output-inline">
              {selectedBackgroundImagePath()
                ? selectedBackgroundImagePath()
                : "No background image selected"}
            </p>
            {selectedBackgroundImagePath() && (
              <button class="clear-btn" onClick={clearBackgroundImagePath}>
                ✕
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Fit Launcher Information */}
      <section>
        <h2>Fit Launcher Information</h2>
        <div class="form-group">
          <p>Application Version: {version()}</p>
        </div>
        <div class="form-group">
          <button class="check-update-btn" onClick={handleCheckForUpdates}>
            Check for Updates
          </button>
        </div>
      </section>

      {/* Social Links */}
      <section class="social-links">
        <h2>Follow Us</h2>
        <div class="card">
          <a
            class="social-link1"
            href="https://github.com/CarrotRub/Fit-Launcher/"
            target="_blank"
          >
            <svg
              viewBox="0 0 496 512"
              height="1em"
              fill="#fff"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z"></path>
            </svg>
          </a>
          <a
            class="social-link2"
            href="https://discord.gg/cXaBWdcUSF"
            target="_blank"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              class="bi bi-discord"
              viewBox="0 0 16 16"
            >
              <path
                d="M13.545 2.907a13.227 13.227 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.19 12.19 0 0 0-3.658 0 8.258 8.258 0 0 0-.412-.833.051.051 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.041.041 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032c.001.014.01.028.021.037a13.276 13.276 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019c.308-.42.582-.863.818-1.329a.05.05 0 0 0-.01-.059.051.051 0 0 0-.018-.011 8.875 8.875 0 0 1-1.248-.595.05.05 0 0 1-.02-.066.051.051 0 0 1 .015-.019c.084-.063.168-.129.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.052.052 0 0 1 .053.007c.08.066.164.132.248.195a.051.051 0 0 1-.004.085 8.254 8.254 0 0 1-1.249.594.05.05 0 0 0-.03.03.052.052 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.235 13.235 0 0 0 4.001-2.02.049.049 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.034.034 0 0 0-.02-.019Zm-8.198 7.307c-.789 0-1.438-.724-1.438-1.612 0-.889.637-1.613 1.438-1.613.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612Zm5.316 0c-.788 0-1.438-.724-1.438-1.612 0-.889.637-1.613 1.438-1.613.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612Z"
                fill="white"
              ></path>
            </svg>
          </a>
        </div>

        <button
          class="boton-elegante"
          style={"width: fit-content;"}
          onClick={handleSave}
        >
          Save Settings
        </button>
      </section>
    </div>
  );
};

export default SettingsPage;
