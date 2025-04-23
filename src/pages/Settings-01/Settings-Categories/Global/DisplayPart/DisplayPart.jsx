import { createEffect, createSignal, onMount, Show } from "solid-js"
import '../GlobalSettingsPage.css'
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { message, open } from "@tauri-apps/plugin-dialog";
import { Select } from "@thisbeyond/solid-select";
import { copyFile, mkdir, readDir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { appDataDir, basename, dirname, join } from "@tauri-apps/api/path";
import { load } from "@tauri-apps/plugin-store";

export default function DisplayPart({ settings, handleSwitchCheckChange }) {
    const defaultThemes = [
        "Default Dark Purple", 
        "Forest Dark Green", 
        "Ocean Dark Blue", 
        "Dark Orange Mead", 
        "Desert Light Beige", 
        "Le Beau Cyan"
    ];
    const [newThemes, setNewThemes] = createSignal([]);
    const [currentTheme, setCurrentTheme] = createSignal(defaultThemes[0]);
    const [blurAmount, setBlurAmount] = createSignal(null);
    const [bgApplied, setBgApplied] = createSignal(false);

    onMount(async () => {
        try {
            // Load user-added themes
            const themesDir = await appDataDir();
            const themePath = await join(themesDir, "themes");
            await mkdir(themePath, { recursive: true });

            const themeFiles = await readDir(themePath);

            const loadedThemes = themeFiles
                .filter(file => file.name.endsWith(".css"))
                .map(file => file.name.replace(".css", "").replace(/-/g, " ").replace(/\b\w/g, char => char.toUpperCase()));

            setNewThemes(loadedThemes);

            // Apply the saved theme
            const defaultThemeKeys = defaultThemes.map(theme => theme.replace(/\s+/g, "-").toLowerCase());
            const savedTheme = localStorage.getItem("theme") || defaultThemeKeys[0];
            if (defaultThemeKeys.includes(savedTheme)) {
                document.documentElement.setAttribute("data-theme", savedTheme);
                const originalThemeName = defaultThemes[defaultThemeKeys.indexOf(savedTheme)];
                setCurrentTheme(originalThemeName);
            } else {
                setCurrentTheme(savedTheme.replace(/-/g, " ").replace(/\b\w/g, char => char.toUpperCase()));
                await applyTheme(savedTheme);
            }

            try {
                const bgImageStore = await load('background_store.json', { autoSave: false });
                let bg_path = await bgImageStore.get('background_image');
                let bg_blur = await bgImageStore.get('blur_amount')
                if (bg_path === '' || bg_path === undefined) {
                    setBgApplied(false)
                } else {
                    setBgApplied(true)
                }
                console.log(bg_blur)
                if (bg_blur !== null) {
                    setBlurAmount(bg_blur);
                } else {
                    setBlurAmount(5);
                    console.warn("no")
                }
            } catch (error) {
                await message(`Error checking background:\n ${error}`, {title: 'FitLauncher', kind: 'error'});
            }
        } catch (error) {
            console.error("Error loading new themes:", error);
        }
    });

    async function applyTheme(themeName) {
        try {
            const defaultThemeKeys = defaultThemes.map(t => t.replace(/\s+/g, "-").toLowerCase());
            const themeFileName = themeName.replace(/\s+/g, "-").toLowerCase();
    
            if (defaultThemeKeys.includes(themeFileName)) {
                document.documentElement.setAttribute("data-theme", themeFileName);
            } else {
                const themesDir = await appDataDir();
                const themePath = await join(themesDir, "themes", `${themeFileName}.css`);
    
                try {
                    const themeContent = await readTextFile(themePath);
    
                    let themeStyle = document.getElementById("theme-style");
                    if (!themeStyle) {
                        themeStyle = document.createElement("style");
                        themeStyle.id = "theme-style";
                        document.head.appendChild(themeStyle);
                    }
                    themeStyle.textContent = themeContent;
    
                    document.documentElement.setAttribute("data-theme", themeFileName);
                } catch (fileError) {
                    console.warn("User theme not found. Reverting to default theme.");
                    await revertToDefault();
                }
            }
    
            localStorage.setItem("theme", themeFileName);
        } catch (error) {
            console.error("Error applying theme:", error);
            await revertToDefault();
        }
    }

    async function revertToDefault() {
        const defaultTheme = "default-dark-purple";
        const defaultThemeKey = defaultTheme.replace(/\s+/g, "-").toLowerCase();
    
        document.documentElement.setAttribute("data-theme", defaultThemeKey);
        localStorage.setItem("theme", defaultThemeKey);
        setCurrentTheme(defaultTheme.replace(/-/g, " ").replace(/\b\w/g, char => char.toUpperCase()));
    
        console.info("Reverted to default theme:", defaultTheme);
    }

    async function handleAddTheme() {
        const requiredVariables = [
            "--accent-color",
            "--secondary-color",
            "--secondary-30-selected-color",
            "--non-selected-text-color",
            "--primary-color",
            "--secondary-20-color",
            "--text-color",
            "--background-color",
            "--70-background-color",
            "--30-background-color",
            "--popup-background-color",
            "--resume-button-accent-color",
            "--warning-orange",
        ];

        const themeNamePattern = /^[a-z0-9-]{1,40}$/;
        const themeBlockPattern = /:root\[data-theme="([a-z0-9-]{1,40})"\]\s*{([^}]+)}/;

        try {
            const cssThemeFile = await open({
                directory: false,
                multiple: false,
                filters: [{ name: "Cascading Style Sheets", extensions: ["css"] }],
            });

            if (!cssThemeFile) {
                await message("No file selected", { title: "FitLauncher", kind: "error" });
                return;
            }

            const fileContent = await readTextFile(cssThemeFile);

            const match = fileContent.match(themeBlockPattern);

            if (!match) {
                await message("Invalid theme block structure.", { title: "FitLauncher", kind: "error" });
                return;
            }

            const themeName = match[1];
            const themeVariables = match[2];

            if (!themeNamePattern.test(themeName)) {
                await message(
                    "Invalid theme name. Must be lowercase, contain only letters, numbers, hyphens, and be max 40 characters.",
                    { title: "FitLauncher", kind: "error" }
                );
                return;
            }

            const isValidTheme = requiredVariables.every((variable) => themeVariables.includes(variable));

            if (isValidTheme) {
                let themesDir = await appDataDir();
                themesDir = await join(themesDir, "themes");

                await mkdir(themesDir, { recursive: true });

                const themeFilePath = await join(themesDir, `${themeName}.css`);
                await writeTextFile(themeFilePath, fileContent);

                // Add the new theme to the list
                setNewThemes([...newThemes(), themeName.replace(/-/g, " ").replace(/\b\w/g, char => char.toUpperCase())]);

                await message("Theme saved successfully! You can now use it.", {
                    title: "FitLauncher",
                    kind: "info",
                });
            } else {
                await message("Invalid theme file. Missing required variables.", {
                    title: "FitLauncher",
                    kind: "error",
                });
            }
        } catch (error) {
            console.error("Error adding theme:", error);
            await message("An error occurred while processing the theme file.", {
                title: "FitLauncher",
                kind: "error",
            });
        }
    }

    async function addBackgroundImage(imagePath) {
        const bgElement = document.querySelector(".background-style");
        const bgBlurElement = document.querySelector(".background-blur-whole");
    
        if (imagePath !== ''&& imagePath !== undefined) {
            console.log(imagePath)
            const bgDir = await appDataDir();
            let imageName = await basename(imagePath);
    
            // keep this folder for later usage to show the user background history and allow him to choose between old backgrounds.
            // This will also be for later usage when adding fully custom theming where the user can just add one single file that will add background + theme + fonts kind of like dotfiles.
            let targetPath = await join(bgDir, 'backgroundImages', imageName);
            let parentDir = await dirname(targetPath)
            await mkdir(parentDir, { recursive: true });
            console.log(targetPath)
            // Copy the image to the target directory
            await copyFile(imagePath, targetPath)
    
            await invoke('allow_dir', { path: targetPath });
            const bgImageStore = await load('background_store.json', { autoSave: false });
        
            // Set the background image and blur amount in the store
            await bgImageStore.set('background_image', targetPath);
            await bgImageStore.set('blur_amount', blurAmount() || 5);
        
            // Use this imageLink as a fallback
            const imageLink = await bgImageStore.get('background_image');
            bgElement.style.backgroundColor = ``;
            bgElement.style.backgroundImage = `url(${convertFileSrc(imageLink)})`;
        
            // Apply blur effect
            bgBlurElement.style.backdropFilter = `blur(${blurAmount()}px)`;
        }
    }

    createEffect(async() => {
        const bgBlurElement = document.querySelector(".background-blur-whole");
        bgBlurElement.style.backdropFilter = `blur(${blurAmount()}px)`;
    
        load('background_store.json', { autoSave: false }).then(async (bgImageStore) => {
            if (blurAmount() !== null) {
                await bgImageStore.set('blur_amount', blurAmount());
            }
        });

    });

    async function handleAddBackgroundImage() {
        let imagePath = await open({
            multiple: false,
            directory: false,
            filters: [{
                name: 'Image',
                extensions: ['png', 'jpeg', 'jpg', 'webp']
            }]
        })

        if (imagePath) {
            addBackgroundImage(imagePath);
            setBgApplied(true);
        }
    }

    async function handleRemoveBackground() {
        const bgImageStore = await load('background_store.json', { autoSave: false });
        await bgImageStore.set('background_image', '');
        await bgImageStore.set('blur_amount', 0);

        window.location.reload()
    }

    return (
        <Show when={settings} placeholder={<p>Loading</p>} >
            <div className="global-page-group" id="global-display">
                <p className="global-page-group-title">App Settings</p>
                <ul className="global-page-group-list">
                    <li>
                        <span>Hide NSFW Content :</span>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={settings.nsfw_censorship}
                                onChange={() => handleSwitchCheckChange("display.nsfw_censorship")}
                            />
                            <span className="switch-slider round"></span>
                        </label>
                    </li>
                    <li>
                        <span>Automatically Get Colors <small><i>(Popular Games)</i></small> :</span>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={settings.auto_get_colors_popular_games}
                                onChange={() => handleSwitchCheckChange("display.auto_get_colors_popular_games")}
                            />
                            <span className="switch-slider round"></span>
                        </label>
                    </li>
                    <li>
                        <span>Change Themes <small><i>(Coming really soon...)</i></small> :</span>
                        <Select
                            class="theme-dropdown"
                            options={[...defaultThemes, ...newThemes()]}
                            placeholder={<span>{currentTheme()}  &darr;</span>}
                            onChange={async (selectedOption) => {
                                const themeName = selectedOption.replace(/\s+/g, "-").toLowerCase();
                                await applyTheme(themeName);
                                setCurrentTheme(selectedOption);
                            }}
                        />
                        <button className="plus-button-settings" onClick={async () => await handleAddTheme()}>
                            <span>+</span>
                        </button>
                    </li>
                    <li>
                        <span>Add Background Image :</span>
                        <button className="go-to-logs-settings-button" onClick={async () => handleAddBackgroundImage()}>
                            <span>
                                Set Background Image
                            </span>
                        </button>
                        <button className="plus-button-settings" disabled={!bgApplied()} onClick={async () => await handleRemoveBackground()} >
                            <span>-</span>
                        </button>
                    </li>
                    <li>
                        <span>Change Background Blur :</span>
                        <div class="slidecontainer">
                          <input type="range" min="0" max="50" value={blurAmount()} class="slider" id="myRange" onInput={(e) => setBlurAmount(e.target.value)}/>
                          <span> {blurAmount()} pixels</span>
                        </div>
                    </li>
                </ul>
            </div>

        </Show>
    );
}