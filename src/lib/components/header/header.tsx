import { A, useLocation } from "@solidjs/router";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { createSignal, onMount } from "solid-js";
import { globalTorrentsInfo } from "../../store/global.store";
import "./header.css";
import { Search } from "./search";
const appWindow = getCurrentWebviewWindow();

export function Header() {
 const [isDialogOpen, setIsDialogOpen] = createSignal(false);
 const [notificationMessage, setNotificationMessage] = createSignal("");
 const [search, setSearch] = createSignal<string>("");

 function handleWindowClose() {
  // Iterate through all torrents and pause them
  const { torrents } = globalTorrentsInfo;
  torrents.forEach(async torrent => {
   const { torrentIdx } = torrent;
   await invoke("torrent_action_pause", { id: torrentIdx })
    .then(() => {
     console.log(`Paused torrent with idx: ${torrentIdx}`);
    })
    .catch(error => {
     console.error(`Failed to pause torrent with idx: ${torrentIdx}`, error);
    });
  });

  // Close the app window
  appWindow.hide();
 }

 const location = useLocation();
 const isActive = (path: string) => location.pathname == path;

 onMount(() => {
  console.log("App mounted. Setting up event listeners...");

  // Add event listeners for Tauri app window controls
  document
   .getElementById("titlebar-minimize")
   ?.addEventListener("click", () => appWindow.minimize());
  document
   .getElementById("titlebar-maximize")
   ?.addEventListener("click", () => appWindow.toggleMaximize());
  document
   .getElementById("titlebar-close")
   ?.addEventListener("click", () => handleWindowClose());

  // Listen for network failure event and handle it
  listen<{ message: string }>("network-failure", event => {
   setNotificationMessage(`Network failure: ${event.payload.message}`);
   setIsDialogOpen(true);
  });

  listen<{ message: string }>("scraping_failed_event", event => {
   setNotificationMessage(`Scraping failed: ${event.payload.message}`);
   setIsDialogOpen(true);
   console.log("Scraping failed:", event.payload.message);
  });
 });

 function changeLocalStorageLatestHref(href: string) {
  localStorage.setItem("latestGlobalHref", href);
  console.log("Updated latestGlobalHref:", href);
 }

 return (
  <div class="top-bar-container">
   <div data-tauri-drag-region class="titlebar">
    <div class="titlebar-button" id="titlebar-minimize">
     <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
     >
      <path fill="currentColor" d="M14 8v1H3V8z"></path>
     </svg>
    </div>
    <div class="titlebar-button" id="titlebar-maximize">
     <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
     >
      <g fill="currentColor">
       <path d="M3 5v9h9V5zm8 8H4V6h7z"></path>
       <path
        fill-rule="evenodd"
        d="M5 5h1V4h7v7h-1v1h2V3H5z"
        clip-rule="evenodd"
       ></path>
      </g>
     </svg>
    </div>
    <div class="titlebar-button" id="titlebar-close">
     <svg
      class="icon-id"
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
     >
      <path
       fill="currentColor"
       fill-rule="evenodd"
       d="m7.116 8-4.558 4.558.884.884L8 8.884l4.558 4.558.884-.884L8.884 8l4.558-4.558-.884-.884L8 7.116 3.442 2.558l-.884.884z"
       clip-rule="evenodd"
      ></path>
     </svg>
    </div>
   </div>

   <img
    id="fitgirl-logo"
    src="/Square310x310Logo.png"
    alt="fitgirl repack logo"
   />

   <Search setSearch={setSearch} />

   <A
    href="/"
    class="clickable-link"
    classList={{
     active: isActive("/"),
    }}
    onclick={() => changeLocalStorageLatestHref("/")}
    end
   >
    <p id="link-gamehub" class="links-texts">
     GameHub
    </p>
   </A>

   <A
    href="/discovery-page"
    classList={{
     "clickable-link": true,
     active: isActive("/discovery-page"),
    }}
    onclick={() => changeLocalStorageLatestHref("/discovery-page")}
   >
    <p id="link-discovery" class="links-texts">
     Discovery
    </p>
   </A>

   <A
    href="/library"
    classList={{
     "clickable-link": true,
     active: isActive("/library"),
    }}
    onclick={() => changeLocalStorageLatestHref("/library")}
   >
    <p id="link-library" class="links-texts">
     Library
    </p>
   </A>

   <A
    href="/downloads-page"
    classList={{
     "clickable-link": true,
     active: isActive("/downloads-page"),
    }}
    onclick={() => changeLocalStorageLatestHref("/downloads-page")}
   >
    <p id="link-downloads" class="links-texts">
     Downloads
    </p>
   </A>

   <A
    href="/settings"
    classList={{
     "clickable-link": true,
     active: isActive("/settings"),
    }}
    onclick={() => changeLocalStorageLatestHref("/settings")}
   >
    <p id="link-settings" class="links-texts">
     Settings
    </p>
   </A>
  </div>
 );
}
