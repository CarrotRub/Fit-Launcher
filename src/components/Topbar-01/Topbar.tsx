import { A, useLocation } from "@solidjs/router";
import { Compass, Download, Home, Library, Maximize2, Minimize2, Minus, Settings, X } from "lucide-solid";
import { createSignal, onMount, Show } from "solid-js";
import Searchbar from "./Topbar-Components-01/Searchbar-01/Searchbar";
import { listen } from "@tauri-apps/api/event";
import { TorrentApi } from "../../api/bittorrent/api";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

export default function Topbar() {
  const [isDialogOpen, setIsDialogOpen] = createSignal(false);
  const [notificationMessage, setNotificationMessage] = createSignal('');
  const [isMaximized, setIsMaximized] = createSignal(false);
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  const torrentApi = new TorrentApi();
  const appWindow = getCurrentWebviewWindow();

  function handleWindowClose() {
    //todo: add pause all torrent
    appWindow.hide();
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

  function changeLocalStorageLatestHref(href: string) {
    localStorage.setItem("latestGlobalHref", href);
    console.log("Updated latestGlobalHref:", href);
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

    listen('network-failure', (event: any) => {
      setNotificationMessage(`Network failure: ${event.payload.message}`);
      setIsDialogOpen(true);
    });

    listen('scraping_failed_event', (event: any) => {
      setNotificationMessage(`Scraping failed: ${event.payload.message}`);
      setIsDialogOpen(true);
      console.log('Scraping failed:', event.payload.message);
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
          onClick={() => changeLocalStorageLatestHref("/")}
          end
        >
          <Home size={18} />
          <span class="font-medium">GameHub</span>
        </A>

        <A
          href="/discovery-page"
          class={`flex items-center gap-2 px-4 h-full transition-colors ${isActive("/discovery-page") ? "text-accent border-b-2 border-accent" : "text-muted hover:text-text"
            }`}
          onClick={() => changeLocalStorageLatestHref("/discovery-page")}
        >
          <Compass size={18} />
          <span class="font-medium">Discovery</span>
        </A>

        <A
          href="/library"
          class={`flex items-center gap-2 px-4 h-full transition-colors ${isActive("/library") ? "text-accent border-b-2 border-accent" : "text-muted hover:text-text"
            }`}
          onClick={() => changeLocalStorageLatestHref("/library")}
        >
          <Library size={18} />
          <span class="font-medium">Library</span>
        </A>

        <A
          href="/downloads-page"
          class={`flex items-center gap-2 px-4 h-full transition-colors ${isActive("/downloads-page") ? "text-accent border-b-2 border-accent" : "text-muted hover:text-text"
            }`}
          onClick={() => changeLocalStorageLatestHref("/downloads-page")}
        >
          <Download size={18} />
          <span class="font-medium">Downloads</span>
        </A>

        <A
          href="/settings"
          class={`flex items-center gap-2 px-4 h-full transition-colors ${isActive("/settings") ? "text-accent border-b-2 border-accent" : "text-muted hover:text-text"
            }`}
          onClick={() => changeLocalStorageLatestHref("/settings")}
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