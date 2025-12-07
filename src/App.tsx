import { onMount, lazy, JSX } from 'solid-js';
import { Route, Router, useLocation } from '@solidjs/router';
import Topbar from './components/Topbar-01/Topbar';
import '@fontsource-variable/mulish';
import '@fontsource-variable/lexend';
import '@fontsource/bai-jamjuree'

import './App.css';

import { check } from '@tauri-apps/plugin-updater';
import { confirm, message } from '@tauri-apps/plugin-dialog';
import { ThemeManagerApi } from './api/theme/api';
import { Toaster, ToastProvider } from 'solid-notifications';
import { DM } from './api/manager/api';
import { installerService } from './api/installer/api';
import * as Debrid from './api/debrid/api';
import { CREDENTIAL_STORE_SALT } from './api/debrid/api';
import createChangelogPopup from './Pop-Ups/Changelog-PopUp/Changelog-PopUp';
import { fetchLatestGithubRelease } from './api/changelog/api';
import { getVersion } from '@tauri-apps/api/app';
import { lt, SemVer } from 'semver';

const themeManager = new ThemeManagerApi();

function App(props: { children: number | boolean | Node | JSX.ArrayElement | (string & {}) | null | undefined; }) {
  onMount(async () => {

    // Init debrid credential store early so it's ready when needed
    // Await to ensure credentials are available before any debrid operations
    try {
      await Debrid.initCredentials(CREDENTIAL_STORE_SALT);
    } catch (e) {
      console.warn("Failed to init debrid credentials:", e);
    }

    installerService.start();

    await handleChangelog();

    try {
      await themeManager.applyStoredTheme();
    } catch (err) {
      console.error('Failed to load stored theme:', err);
    }

    try {
      const { applied, blur } = await themeManager.loadBackgroundState();
      if (applied) {
        const store = await import('@tauri-apps/plugin-store');
        const bgStore = await store.load('background_store.json', { autoSave: false });
        const imageLink = await bgStore.get<string>('background_image');
        const bgEl = document.querySelector('.background-style') as HTMLElement | null;
        const blurEl = document.querySelector('.background-blur-whole') as HTMLElement | null;
        if (imageLink && bgEl && blurEl) {
          const { convertFileSrc } = await import('@tauri-apps/api/core');
          bgEl.style.backgroundImage = `url(${convertFileSrc(imageLink)})`;
          blurEl.style.backdropFilter = `blur(${blur}px)`;
        }
      }
    } catch (err) {
      console.error('Failed to load background state:', err);
    }

    await handleCheckUpdate();

    // feat: fixed by the webview captcha
    // listen("ddos-guard-blocked", () => {
    //   createCookiesImportPopup({
    //     infoTitle: "DDoS Protection Triggered",
    //     infoMessage: "Please drop a valid `cookies.json` file to bypass the DDoS-Guard restriction.",
    //     confirmLabel: "Continue",
    //     cancelLabel: "Cancel",
    //   });
    // });

  });

  async function handleChangelog() {
    let latestVer = localStorage.getItem("version");
    let updatedVer = await getVersion();

    if (!latestVer) {
      createChangelogPopup({
        fetchChangelog: () => fetchLatestGithubRelease('CarrotRub', 'Fit-Launcher'),
        onClose: () => localStorage.setItem("version", updatedVer),
      });
    } else if (lt(latestVer, updatedVer)) {
      createChangelogPopup({
        fetchChangelog: () => fetchLatestGithubRelease('CarrotRub', 'Fit-Launcher'),
        onClose: () => localStorage.setItem("version", updatedVer),
      });
    }
  }

  async function handleCheckUpdate() {
    try {
      const update = await check();


      if (update) {
        console.log(
          `Found update ${update.version} from ${update.date} with notes: ${update.body}`
        );
        const confirmUpdate = await confirm(
          `Update "${update.version}" was found. Do you want to download it?`,
          { title: 'FitLauncher', kind: 'info' }
        );

        if (confirmUpdate) {
          let downloaded = 0;
          let contentLength = 0;

          await update.downloadAndInstall((event) => {
            switch (event.event) {
              case 'Started':
                contentLength = event.data.contentLength || 0;
                console.log(`Started downloading ${event.data.contentLength} bytes`);
                break;
              case 'Progress':
                downloaded += event.data.chunkLength;
                console.log(`Downloaded ${downloaded} of ${contentLength}`);
                break;
              case 'Finished':
                console.log('Download finished');
                break;
            }
          });

          await message('Update has been installed correctly! Please close and re-open the app.');
        }
      } else {
        console.log("NO updates")
      }
    } catch (err) {
      console.error('Update check failed:', err);
    }
  }

  const sidebarRoutes = [
    { path: '/', component: lazy(() => import('./pages/Gamehub-01/Gamehub')) },
    { path: '/game/:uuid', component: lazy(() => import('./pages/Download-Game-UUID-01/Download-Game-UUID')) },
    { path: '/discovery-page', component: lazy(() => import('./pages/Discovery-01/Discovery')) },
    { path: '/downloads-page', component: lazy(() => import('./pages/Downloads-01/Downloads-Page')) },
    { path: '/library', component: lazy(() => import('./pages/Library-01/Library')) },
    { path: '/settings', component: lazy(() => import('./pages/Settings-01/Settings')) },
    { path: '*404', component: lazy(() => import('./pages/Gamehub-01/Gamehub')) },
    { path: '*', component: lazy(() => import('./pages/Gamehub-01/Gamehub')) },
  ];

  return (
    <Router
      base="/"
      root={(props) => {
        return (
          <ToastProvider positionY='bottom' limit={3} theme="dark">
            <Toaster />
            <div class="flex flex-col w-full h-screen bg-background text-text font-titles">
              <div class="background-style absolute inset-0 bg-cover bg-center -z-2 pointer-events-none">
                <div class="background-blur-whole absolute inset-0 -z-1 pointer-events-none"></div>
              </div>

              <Topbar />
              <div class="flex-1 overflow-y-auto no-scrollbar">
                {props.children}
              </div>

            </div>
          </ToastProvider>

        );
      }}
    >
      {sidebarRoutes.map((route) => (
        <Route path={route.path} component={route.component} />
      ))}
    </Router>
  );
}

export default App;
