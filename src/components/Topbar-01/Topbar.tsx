import { A } from "@solidjs/router";
import { Compass, Download, Home, Library, Maximize2, Minimize2, Minus, Settings, X } from "lucide-solid";
import { createSignal, onMount, Show } from "solid-js";
import Searchbar from "./Topbar-Components-01/Searchbar-01/Searchbar";
import { listen, Event } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { sendNotification, isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import createBasicChoicePopup from "../../Pop-Ups/Basic-Choice-PopUp/Basic-Choice-PopUp";
import { GlobalSettingsApi } from "../../api/settings/api";
import { commands } from "../../bindings";
import { routeHistory } from "../../stores/routeStore";

export default function Topbar() {
  const [isMaximized, setIsMaximized] = createSignal(false);
  const [isFullscreen, setIsFullscreen] = createSignal(false);

  const isActive = (path: string) => {
    return routeHistory.at(-1) === path;
  };

  const appWindow = getCurrentWebviewWindow();

  async function handleWindowClose() {
    const settings = await GlobalSettingsApi.getGamehubSettings();

    if (settings.close_to_tray) {
      await appWindow.hide();

      let permissionGranted = await isPermissionGranted();
      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === "granted";
      }
      if (permissionGranted) {
        sendNotification({
          title: "FitLauncher is running in the tray",
          body: "The app was minimized to the system tray. You can change this behavior in Settings."
        });
      }
      return;
    }

    // Close instantly mode - check if controller is running
    const controllerRunning = await commands.isControllerRunning();

    if (controllerRunning) {
      // Warn user that controller will be killed
      createBasicChoicePopup({
        infoTitle: "Installation In Progress",
        infoMessage: "An installation is currently running. Closing will stop the installation.\n\nAre you sure you want to exit?",
        confirmLabel: "Exit Anyway",
        cancelLabel: "Cancel",
        action: async () => {
          await commands.quitApp();
        },
      });
      return;
    }

    // No controller running, exit immediately
    await commands.quitApp();
  }

  async function handleMaximize() {
    if (isFullscreen()) {
      await appWindow.setFullscreen(false);
      setIsFullscreen(false);
      if (isMaximized()) {
        await appWindow.maximize();
      }
    } else {
      await appWindow.toggleMaximize();
      const maximized = await appWindow.isMaximized();
      setIsMaximized(maximized);
    }
  }

  async function toggleFullscreen() {
    if (isMaximized()) {
      await appWindow.toggleMaximize();
    }
    const newFullscreenState = !isFullscreen();
    await appWindow.setFullscreen(newFullscreenState);
    setIsFullscreen(newFullscreenState);

    if (newFullscreenState) {

      const wasMaximized = await appWindow.isMaximized();
      setIsMaximized(wasMaximized);
    } else {

      if (isMaximized()) {
        await appWindow.maximize();
      }
    }
  }



  onMount(async () => {
    setIsMaximized(await appWindow.isMaximized());
    setIsFullscreen(await appWindow.isFullscreen());

    const unlistenResize = await appWindow.onResized(async () => {
      setIsFullscreen(await appWindow.isFullscreen());
      setIsMaximized(await appWindow.isMaximized());
    });

    document.addEventListener("keydown", async (e) => {
      if (e.key === "F11") {
        e.preventDefault();
        await toggleFullscreen();
      }
    });

    document.getElementById('titlebar-minimize')?.addEventListener('click', () => appWindow.minimize());
    document.getElementById('titlebar-maximize')?.addEventListener('click', handleMaximize);
    document.getElementById('titlebar-close')?.addEventListener('click', () => handleWindowClose());

    listen('network-failure', (event: Event<{ message: string }>) => {
      console.error(`Network failure: ${event.payload.message}`);
    });

    listen('scraping_failed_event', (event: Event<{ message: string }>) => {
      console.error('Scraping failed:', event.payload.message);
    });

    return () => {
      unlistenResize();
    };
  });

  return (
    <div
      class="w-full h-16 px-4 flex items-center justify-between bg-popup-background border-b border-secondary-20 select-none"
      data-tauri-drag-region
    >
      {/* Logo */}
      <img
        src='/Square310x310Logo.png'
        alt='fitgirl repack logo'
        class="w-8 h-8 rounded-md object-cover"
        style="-webkit-app-region: no-drag;"
      />

      {/* Right Section - Searchbar */}
      <div class="flex-1 max-w-fit ml-4" style="-webkit-app-region: no-drag;">
        <Searchbar isTopBar={true} />
      </div>

      {/* Middle Section - Navigation Links */}
      <div class="flex items-center gap-1 h-full" style="-webkit-app-region: no-drag;">
        <A
          href="/"
          class={`flex items-center gap-2 px-4 h-full transition-colors ${isActive("/") ? "text-accent border-b-2 border-accent" : "text-muted hover:text-text"
            }`}
          end
        >
          <Home size={18} />
          <span class="font-medium">GameHub</span>
        </A>

        <A
          href="/discovery-page"
          class={`flex items-center gap-2 px-4 h-full transition-colors ${isActive("/discovery-page") ? "text-accent border-b-2 border-accent" : "text-muted hover:text-text"
            }`}
        >
          <Compass size={18} />
          <span class="font-medium">Discovery</span>
        </A>

        <A
          href="/library"
          class={`flex items-center gap-2 px-4 h-full transition-colors ${isActive("/library") ? "text-accent border-b-2 border-accent" : "text-muted hover:text-text"
            }`}
        >
          <Library size={18} />
          <span class="font-medium">Library</span>
        </A>

        <A
          href="/downloads-page"
          class={`flex items-center gap-2 px-4 h-full transition-colors ${isActive("/downloads-page") ? "text-accent border-b-2 border-accent" : "text-muted hover:text-text"
            }`}
        >
          <Download size={18} />
          <span class="font-medium">Downloads</span>
        </A>

        <A
          href="/settings"
          class={`flex items-center gap-2 px-4 h-full transition-colors ${isActive("/settings") ? "text-accent border-b-2 border-accent" : "text-muted hover:text-text"
            }`}
        >
          <Settings size={18} />
          <span class="font-medium">Settings</span>
        </A>
      </div>

      {/* Left Section - Logo and Window Controls */}
      <div class="flex items-center gap-6" style="-webkit-app-region: no-drag;">
        {/* Window Controls */}
        <div data-tauri-drag-region class="flex items-center gap-2">

          <button
            id="titlebar-minimize"
            class="p-1.5 rounded-full text-muted hover:bg-secondary-20/30 hover:text-accent transition-colors"
            title="Minimize"
          >
            <Minus size={16} />
          </button>

          <button
            id="titlebar-maximize"
            class="p-1.5 rounded-full text-muted hover:bg-secondary-20/30 hover:text-accent transition-colors"
            onClick={handleMaximize}
            title={
              isFullscreen()
                ? "Exit Fullscreen"
                : isMaximized()
                  ? "Restore Down"
                  : "Maximize"
            }
          >
            <Show when={isFullscreen() || isMaximized()} fallback={<Maximize2 size={16} />}>
              <Minimize2 size={16} />
            </Show>
          </button>

          <button
            id="titlebar-close"
            class="p-1.5 rounded-full text-muted hover:bg-red-500/20 hover:text-red-500 transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}