import { onMount, createSignal } from 'solid-js';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen, emit } from '@tauri-apps/api/event';
import { Route, Router, useLocation } from '@solidjs/router';
import { lazy } from 'solid-js';

import Notification from './components/Notification-01/Notification';
import ChangelogPopup from './components/Changelog-01/ChangelogPopup';

import '@fontsource-variable/mulish';
import '@fontsource-variable/lexend'

import './App.css';
import Topbar from './components/Topbar-01/Topbar';
import { appDataDir, dirname, join } from '@tauri-apps/api/path';
import { exists, mkdir, readDir, readTextFile, writeFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { check } from '@tauri-apps/plugin-updater';
import { confirm, message } from '@tauri-apps/plugin-dialog';

const appDir = await appDataDir()
async function userCollectionPath() {
    return await join(appDir, 'library', 'collections');
}

function App() {
    const defaultThemes = [
        "Default Dark Purple", 
        "Forest Dark Green", 
        "Ocean Dark Blue", 
        "Dark Orange Mead", 
        "Desert Light Beige", 
        "Le Beau Cyan"
    ];

    onMount(async () => {
        try {
            const themesDir = await appDataDir();
            const themePath = await join(themesDir, "themes");
            await mkdir(themePath, { recursive: true });

            const themeFiles = await readDir(themePath);

            const loadedThemes = themeFiles
                .filter(file => file.name.endsWith(".css"))
                .map(file => file.name.replace(".css", "").replace(/-/g, " ").replace(/\b\w/g, char => char.toUpperCase()));

            // Apply the saved theme
            const defaultThemeKeys = defaultThemes.map(theme => theme.replace(/\s+/g, "-").toLowerCase());
            const savedTheme = localStorage.getItem("theme") || defaultThemeKeys[0];
            if (defaultThemeKeys.includes(savedTheme)) {
                document.documentElement.setAttribute("data-theme", savedTheme);
                const originalThemeName = defaultThemes[defaultThemeKeys.indexOf(savedTheme)];
            } else {
                await applyTheme(savedTheme);
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

        console.info("Reverted to default theme:", defaultTheme);
    }



    //TODO: Add option to remove auto check update
    async function handleCheckUpdate() {
        let update = await check();
    
        if (update) {
            console.log(
              `found update ${update.version} from ${update.date} with notes ${update.body}`
            );
            const confirm_update = await confirm(`Update "${update.version} was found, do you want to download it ?" `, {title: 'FitLauncher', kind:'info'})
            if (confirm_update) {
                let downloaded = 0;
                let contentLength = 0;
                // alternatively we could also call update.download() and update.install() separately
                await update.downloadAndInstall((event) => {
                  switch (event.event) {
                    case 'Started':
                      contentLength = event.data.contentLength;
                      console.log(`started downloading ${event.data.contentLength} bytes`);
                      break;
                    case 'Progress':
                      downloaded += event.data.chunkLength;
                      console.log(`downloaded ${downloaded} from ${contentLength}`);
                      break;
                    case 'Finished':
                      console.log('download finished');
                      
                      break;
                  }
                });
                await message(`Update has been installed correctly ! close and re-open the app.`)
            }
        }
    }

    onMount(() => {
        handleCheckUpdate();
    })

    const sidebarRoutes = [
        {
            path: '/',
            component: lazy(() => import('./pages/Gamehub-01/Gamehub')),
        },
        {
            path: '/game/:uuid',
            component: lazy(() => import('./pages/Download-Game-UUID-01/Download-Game-UUID')),
        },
        {
            path: '/discovery-page',
            component: lazy(() => import('./pages/Discovery-01/Discovery'))
        },
        {
            path: '/downloads-page',
            component: lazy(() => import('./pages/Downloads-01/Downloads-Page'))
        },
        {
            path: '/library',
            component: lazy(() => import('./pages/Library-01/Library')),
        },
        {
            path: '/settings',
            component: lazy(() => import('./pages/Settings-01/Settings')),
        },
        {
            path: "*404",
            component: lazy(() => import('./pages/Gamehub-01/Gamehub')),
        },
        {
            path: "*",
            component: lazy(() => import('./pages/Gamehub-01/Gamehub')),
        }
    ];

    return (
        <>


            <Router base={'/'} root={(props) => {
                const location = useLocation();
                return (
                    <>
                        <div className='main-layout'>
                            <Topbar /> {/* This is the .topbar */}

                            {props.children} {/* This is the .content-page */}
                        </div>
                    </>
                );
            }}>
                {sidebarRoutes.map(route => (
                  <Route path={route.path} component={route.component} />
                ))}
            </Router>
        </>
    );
}

export default App;
