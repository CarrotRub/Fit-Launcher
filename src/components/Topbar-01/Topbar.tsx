import { createEffect, onMount, createSignal } from "solid-js";
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen } from '@tauri-apps/api/event';
import { A, useLocation } from "@solidjs/router";
import { invoke } from "@tauri-apps/api/core";
import {
  Minimize2,
  Maximize2,
  X,
  Home,
  Compass,
  Library,
  Download,
  Settings,
  EyeClosed,
  Minus
} from "lucide-solid";
import Searchbar from "./Topbar-Components-01/Searchbar-01/Searchbar";
import { globalTorrentsInfo } from "../functions/dataStoreGlobal";

const appWindow = getCurrentWebviewWindow();

export default function Topbar() {
  const [isDialogOpen, setIsDialogOpen] = createSignal(false);
  const [notificationMessage, setNotificationMessage] = createSignal('');
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  function handleWindowClose() {
    const { torrents } = globalTorrentsInfo;
    torrents.forEach(async (torrent) => {
      const { torrentIdx } = torrent;
      await invoke('torrent_action_pause', { id: torrentIdx })
        .then(() => console.log(`Paused torrent with idx: ${torrentIdx}`))
        .catch((error) => console.error(`Failed to pause torrent with idx: ${torrentIdx}`, error));
    });
    appWindow.hide();
  }

  function changeLocalStorageLatestHref(href: string) {
    localStorage.setItem("latestGlobalHref", href);
    console.log("Updated latestGlobalHref:", href);
  }

  onMount(() => {
    document.getElementById('titlebar-minimize')?.addEventListener('click', () => appWindow.minimize());
    document.getElementById('titlebar-maximize')?.addEventListener('click', () => appWindow.toggleMaximize());
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
          >
            <Minus size={16} />
          </button>
          <button
            id="titlebar-maximize"
            class="p-1.5 rounded-full text-muted hover:bg-secondary-20/30 hover:text-accent transition-colors"
          >
            <Maximize2 size={16} />
          </button>
          <button
            id="titlebar-close"
            class="p-1.5 rounded-full text-muted hover:bg-secondary/20 hover:text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>


      </div>
    </div>
  );
}