import { Route, Router, useLocation } from "@solidjs/router";
import { lazy, onMount } from "solid-js";

import "@fontsource-variable/lexend";
import "@fontsource-variable/mulish";

import { Header } from "@/components/header";
import { appDataDir, join } from "@tauri-apps/api/path";
import { confirm, message } from "@tauri-apps/plugin-dialog";
import { mkdir, readDir, readTextFile } from "@tauri-apps/plugin-fs";
import { check } from "@tauri-apps/plugin-updater";
import "./App.css";

const appDir = await appDataDir();
async function userCollectionPath() {
 return await join(appDir, "library", "collections");
}

function App() {
 const defaultThemes = [
  "Default Dark Purple",
  "Forest Dark Green",
  "Ocean Dark Blue",
  "Dark Orange Mead",
  "Desert Light Beige",
  "Le Beau Cyan",
 ];

 onMount(async () => {
  try {
   const themesDir = await appDataDir();
   const themePath = await join(themesDir, "themes");
   await mkdir(themePath, { recursive: true });

   const themeFiles = await readDir(themePath);

   const loadedThemes = themeFiles
    .filter(file => file.name.endsWith(".css"))
    .map(file =>
     file.name
      .replace(".css", "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, char => char.toUpperCase()),
    );

   // Apply the saved theme
   const defaultThemeKeys = defaultThemes.map(theme =>
    theme.replace(/\s+/g, "-").toLowerCase(),
   );
   const savedTheme = localStorage.getItem("theme") || defaultThemeKeys[0];
   if (defaultThemeKeys.includes(savedTheme)) {
    document.documentElement.setAttribute("data-theme", savedTheme);
    const originalThemeName =
     defaultThemes[defaultThemeKeys.indexOf(savedTheme)];
   } else {
    await applyTheme(savedTheme);
   }
  } catch (error) {
   console.error("Error loading new themes:", error);
  }
 });

 async function applyTheme(theme: string) {
  try {
   const defaultThemeKeys = defaultThemes.map(t =>
    t.replace(/\s+/g, "-").toLowerCase(),
   );
   const themeFileName = theme.replace(/\s+/g, "-").toLowerCase();

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
 async function checkForUpdates() {
  let update = await check();

  if (update) {
   console.log(
    `found update ${update.version} from ${update.date} with notes ${update.body}`,
   );
   const confirmedUpdate = await confirm(
    `Update "${update.version} was found, do you want to download it ?" `,
    { title: "FitLauncher", kind: "info" },
   );

   if (!confirmedUpdate) return;

   let downloadedBytes = 0;
   let totalBytes = 0;

   // Alternatively call update.download() and update.install() separately
   await update.downloadAndInstall(event => {
    switch (event.event) {
     case "Started": {
      totalBytes = event.data.contentLength!;
      console.log(`Started downloading ${event.data.contentLength} bytes`);
      break;
     }
     case "Progress": {
      downloadedBytes += event.data.chunkLength;
      console.log(`Download ${downloadedBytes} from ${totalBytes}`);
      break;
     }
     case "Finished": {
      console.log("Download finished");
      break;
     }
    }
   });
   await message(
    `Update has been installed correctly ! close and re-open the app.`,
   );
  }
 }

 onMount(() => {
  checkForUpdates();
 });

 const sidebarRoutes = [
  {
   path: "/",
   component: lazy(() => import("./routes/gamehub/gamehub")),
  },
  {
   path: "/game/:uuid",
   component: lazy(() => import("./routes/download-game/download-game")),
  },
  {
   path: "/discovery-page",
   component: lazy(() => import("./routes/discovery/discovery")),
  },
  {
   path: "/downloads-page",
   component: lazy(() => import("./routes/downloads/downloads")),
  },
  {
   path: "/library",
   component: lazy(() => import("./routes/library/library")),
  },
  {
   path: "/settings",
   component: lazy(() => import("./routes/settings/settings")),
  },
  {
   path: "*404",
   component: lazy(() => import("./routes/gamehub/gamehub")),
  },
  {
   path: "*",
   component: lazy(() => import("./routes/gamehub/gamehub")),
  },
 ];

 return (
  <>
   <Router
    base={"/"}
    root={props => {
     const location = useLocation();
     return (
      <>
       <div class="main-layout">
        <Header /> {/* This is the .topbar */}
        {props.children} {/* This is the .content-page */}
       </div>
      </>
     );
    }}
   >
    {sidebarRoutes.map(route => (
     <Route path={route.path} component={route.component} />
    ))}
   </Router>
  </>
 );
}

export default App;
