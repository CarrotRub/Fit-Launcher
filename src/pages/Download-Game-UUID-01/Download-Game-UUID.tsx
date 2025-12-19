/* eslint-disable @typescript-eslint/no-explicit-any */
import { createResource, createSignal, createMemo, createEffect, onCleanup, Switch, Match, For, Show } from "solid-js";
import { useNavigate, useLocation } from "@solidjs/router";
import { LibraryApi } from "../../api/library/api";
import { GamesCacheApi } from "../../api/cache/api";
import { DownloadedGame } from "../../bindings";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Clock,
  Globe,
  Info,
  Magnet,
  Play,
  Zap,
} from "lucide-solid";
import { extractMainTitle, formatDate, formatPlayTime } from "../../helpers/format";
import { extractCompany, extractLanguage, parseGameSize, formatBytesToSize } from "../../helpers/gameFilters";
import LoadingPage from "../LoadingPage-01/LoadingPage";
import Button from "../../components/UI/Button/Button";
import createDownloadPopup from "../../Pop-Ups/Download-PopUp/Download-PopUp";
import { GamePageState } from "../../types/game";
import { DownloadType } from "../../types/popup";
import { useToast } from "solid-notifications";
import * as Debrid from "../../api/debrid/api";
import { ScreenshotGallery } from "./Download-Game-Components/ScreenshotGallery/ScreenshotGallery";

const library = new LibraryApi();
const cache = new GamesCacheApi();

// --- Fetcher function for createResource ---
async function fetchGameData(gameHref: string): Promise<DownloadedGame | null> {
  if (!gameHref) return null;
  await cache.getSingularGameInfo(gameHref);
  const res = await cache.getSingularGameLocal(gameHref);
  if (res.status === "ok") {
    return library.gameToDownloadedGame(res.data);
  }
  return null;
}

// --- Main Component ---
const DownloadGameUUIDPage = () => {
  const navigate = useNavigate();
  const location = useLocation<GamePageState>();
  const { notify } = useToast();

  // Core reactive source: the game href from router state
  const gameHref = () => location.state?.gameHref ?? "";

  // Main game data via createResource (handles loading state automatically)
  const [game] = createResource(gameHref, fetchGameData);

  // Secondary state
  const [additionalImages, setAdditionalImages] = createSignal<string[]>([]);
  const [isToDownloadLater, setToDownloadLater] = createSignal(false);
  const [hasDebridCached, setHasDebridCached] = createSignal(false);

  const [infoTab, setInfoTab] = createSignal<"game" | "repack">("game");

  // Derived: game details extracted from description
  const gameDetails = createMemo(() => {
    const description = game()?.details;
    if (!description) {
      return { tags: "N/A", companies: "N/A", language: "N/A", originalSize: "N/A", repackSize: "N/A" };
    }
    const originalBytes = parseGameSize(description, "original");
    const repackBytes = parseGameSize(description, "repack");
    const tagsMatch = description.match(/Genres\/Tags:\s*([^\n]+)/i);
    return {
      tags: tagsMatch?.[1]?.trim() ?? "N/A",
      companies: extractCompany(description),
      language: extractLanguage(description),
      originalSize: originalBytes > 0 ? formatBytesToSize(originalBytes) : "N/A",
      repackSize: repackBytes > 0 ? formatBytesToSize(repackBytes) : "N/A"
    };
  });

  // Image event listener for progressive loading
  let imageEventUnlisten: UnlistenFn | null = null;

  const setupImageListener = async (href: string) => {
    if (imageEventUnlisten) {
      imageEventUnlisten();
      imageEventUnlisten = null;
    }
    setAdditionalImages([]);

    // Fetch cached images first
    try {
      const images = await cache.getGameImages(href);
      if (images.status === "ok" && images.data.length > 0) {
        setAdditionalImages(images.data);
      }
    } catch { /* ignore */ }

    // Listen for progressive image events
    imageEventUnlisten = await listen<{ game_link: string; image_url: string }>(
      "game_images::image_ready",
      (event) => {
        if (event.payload.game_link === href) {
          setAdditionalImages((prev) =>
            prev.includes(event.payload.image_url) ? prev : [...prev, event.payload.image_url]
          );
        }
      }
    );
  };


  createEffect(() => {
    const href = gameHref();
    const g = game();
    if (!href) return;

    const initTasks: Promise<void>[] = [];

    initTasks.push((async () => {
      setHasDebridCached(false);
      await setupImageListener(href);
    })());

    if (g?.title) {
      initTasks.push((async () => {
        try {
          const list = await library.getGamesToDownload();
          setToDownloadLater(list.some((item) => item.title === g.title));
        } catch { setToDownloadLater(false); }
      })());
    } else {
      setToDownloadLater(false);
    }

    // Check debrid cache (runs when game has magnetlink)
    if (g?.magnetlink) {
      initTasks.push((async () => {
        try {
          const hash = Debrid.extractHashFromMagnet(g.magnetlink);
          if (!hash) return;

          const credInfo = await Debrid.listCredentials();
          if (credInfo.status !== "ok") return;
          const configuredProviders = new Set(credInfo.data.configured_providers);

          const providers = await Debrid.listProviders();
          const results = await Promise.all(
            providers
              .filter(p => p.supports_cache_check && configuredProviders.has(p.id))
              .map(async (provider) => {
                const result = await Debrid.checkCache(provider.id, hash);
                return result.status === "ok" && result.data.is_cached;
              })
          );
          if (results.some(r => r)) {
            setHasDebridCached(true);
          }
        } catch { /* ignore */ }
      })());
    }
    const hasGame = !!game()?.gameplay_features;
    const hasRepack = !!game()?.features;
    const tab = infoTab();

    if (tab === "game" && !hasGame && hasRepack) {
      setInfoTab("repack");
    }

    if (tab === "repack" && !hasRepack && hasGame) {
      setInfoTab("game");
    }

    // Fire all tasks concurrently - don"t await
    Promise.all(initTasks);
  });

  onCleanup(() => imageEventUnlisten?.());

  // Actions
  const handleReturn = () => navigate(localStorage.getItem("latestGlobalHref") || "/");

  const toggleDownloadLater = async () => {
    const g = game();
    if (!g) return;
    try {
      if (isToDownloadLater()) {
        await library.removeGameToDownload(g.title);
        setToDownloadLater(false);
        notify(`${g.title} removed from favorites`, { type: "success" });
      } else {
        await library.addGameToCollection("games_to_download", library.downloadedGameToGame(g));
        setToDownloadLater(true);
        notify(`${g.title} added to favorites`, { type: "success" });
      }
    } catch {
      notify("Error updating favorites", { type: "error" });
    }
  };

  const handleDownloadPopup = (downloadType: DownloadType) => {
    const g = game();
    if (!g) return;
    createDownloadPopup({
      infoTitle: "Download Game",
      infoMessage: `Do you want to download ${g.title}`,
      downloadedGame: g,
      //todo: add in config settings
      folderExclusion: false,
      gameDetails: gameDetails(),
      downloadType,
      onFinish: () => navigate("/downloads-page")
    });
  };

  return (
    <div class="min-h-full w-full bg-background text-text">
      <Switch>
        {/* Loading */}
        <Match when={game.loading}>
          <LoadingPage />
        </Match>

        {/* Error / Not Found */}
        <Match when={!game.loading && !game()}>
          <div class="flex flex-col items-center justify-center h-full px-4">
            <div class="text-center p-6 bg-popup-background rounded-lg border border-secondary-20 w-full max-w-sm">
              <Info class="w-10 h-10 text-accent mx-auto mb-3" />
              <h2 class="text-xl font-bold mb-2">Game Not Found</h2>
              <p class="text-sm text-muted mb-4">We couldn"t find the game you"re looking for</p>
              <button onClick={handleReturn} class="w-full px-4 py-2 bg-accent hover:bg-accent/90 text-background rounded-lg transition-colors text-sm">
                Back to Library
              </button>
            </div>
          </div>
        </Match>

        {/* Game Loaded */}
        <Match when={game()}>
          <div class="flex flex-col h-full">
            {/* Top Bar */}
            <div class="flex items-center justify-between px-4 py-3 border-b border-secondary-20 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
              <Button icon={<ArrowLeft class="w-5 h-5" />} onClick={handleReturn} size="sm" variant="glass" label="Back" />
              <Button
                icon={isToDownloadLater() ? <BookmarkCheck class="w-5 h-5 text-accent" /> : <Bookmark class="w-5 h-5" />}
                onClick={toggleDownloadLater}
                size="sm"
                variant="glass"
                label={isToDownloadLater() ? "Saved" : "Save"}
              />
            </div>

            {/* Main Content */}
            <div class="flex-1 overflow-y-auto custom-scrollbar bg-background">
              <div class="max-w-300 md:max-w-full md:px-24 mx-auto p-4 md:p-6">
                <div class="h-4" />

                {/* Top Section: Gallery + Sidebar */}
                <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(330px,1fr)] gap-6 lg:gap-8 mb-8">
                  {/* Gallery */}
                  <div class="min-w-0">
                    <ScreenshotGallery images={additionalImages} autoPlayInterval={5000} />
                  </div>

                  {/* Sidebar */}
                  <div class="flex flex-col gap-6">
                    {/* Title */}
                    <div>
                      <h1 class="text-3xl font-bold leading-tight mb-2 text-text">
                        {extractMainTitle(game()!.title)}
                      </h1>
                      <p class="text-sm text-muted line-clamp-3 leading-relaxed">
                        {game()?.description?.slice(0, 150) || game()!.title}...
                      </p>
                    </div>

                    {/* Download Actions */}
                    <div class="flex flex-col gap-3">
                      <Button
                        icon={<Magnet class="w-4 h-4" />}
                        label="Torrent Download"
                        onClick={() => handleDownloadPopup("bittorrent")}
                        class="w-full py-3 justify-center text-sm font-semibold uppercase tracking-wide border border-secondary-20 bg-secondary-20/50 hover:bg-secondary-20 hover:text-text transition-all"
                        variant="bordered"
                      />
                      <div class="relative w-full">
                        <Show when={hasDebridCached()}>
                          <div class="absolute -top-2 -right-2 z-10 flex items-center gap-1 px-2 py-0.5 bg-emerald-500 text-text text-[10px] font-bold uppercase rounded-sm shadow-md tracking-wider">
                            <Zap class="w-3 h-3" /> Fast
                          </div>
                        </Show>
                        <Button
                          icon={<Globe class="w-4 h-4" />}
                          label="Direct Download"
                          onClick={() => handleDownloadPopup("direct_download")}
                          class="w-full py-3 justify-center text-sm font-semibold uppercase tracking-wide border border-secondary-20 bg-secondary-20/50 hover:bg-secondary-20 hover:text-text transition-all"
                          variant="bordered"
                        />
                      </div>
                    </div>

                    {/* Metadata */}
                    <div class="flex flex-col gap-1 text-sm bg-popup-background/50 p-4 rounded-lg border border-secondary-20/50">
                      <MetadataRow label="Download Size" value={gameDetails().repackSize} valueClass="text-accent font-mono" />
                      <MetadataRow label="Orig Size" value={gameDetails().originalSize} valueClass="text-primary font-mono" />
                      <MetadataRow label="Publisher" value={gameDetails().companies} />
                      <MetadataRow label="Languages" value={gameDetails().language} last />
                    </div>

                    {/* Tags */}
                    <div class="flex flex-wrap gap-1.5">
                      <For each={gameDetails().tags.split(",")}>
                        {(tag) => (
                          <span class="px-2 py-1 bg-secondary-20/30 text-secondary-foreground text-xs rounded hover:bg-secondary-20/50 cursor-default transition-colors">
                            {tag.trim()}
                          </span>
                        )}
                      </For>
                    </div>
                  </div>
                </div>

                {/* Lower Section */}
                <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(330px,1fr)] gap-8">
                  {/* Left: About */}
                  <div class="space-y-6 flex-row">
                    <Show when={game()?.description}>
                      <ContentSection title="About This Game">
                        <div class="text-sm text-muted leading-7 space-y-4 font-light text-justify whitespace-pre-wrap">
                          {game()?.description}
                        </div>
                      </ContentSection>
                    </Show>
                    <Show when={game()?.gameplay_features || game()?.features}>
                      <div class="mb-6">
                        <div class="flex gap-2 mb-4 border-b items-center transition-all duration-300  border-secondary-20/40 ">
                          <div class="w-1 h-4 bg-accent rounded-full"></div>
                          <Show when={game()?.gameplay_features} >
                            <button
                              onClick={() => setInfoTab("game")}
                              class={`px-4 py-2 text-lg font-semibold transition-colors
                              ${infoTab() === "game"
                                  ? "text-accent border-b-2 border-accent"
                                  : "text-muted hover:text-text"
                                }`}
                            >
                              Game Features
                            </button>
                          </Show>
                          <Show when={game()?.features}>
                            <button
                              onClick={() => setInfoTab("repack")}
                              class={`px-4 py-2 text-lg font-semibold transition-colors
                              ${infoTab() === "repack"
                                  ? "text-accent border-b-2 border-accent"
                                  : "text-muted hover:text-text"
                                }`}
                            >
                              Repack Features
                            </button></Show>

                        </div>

                        {/* Content */}
                        <div class="bg-secondary-20/10 border border-secondary-20/30 rounded-lg p-4 max-h-80 overflow-y-auto custom-scrollbar">
                          <Switch>
                            <Match when={infoTab() === "game"}>
                              <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-muted leading-6">
                                <For
                                  each={game()?.gameplay_features
                                    ?.split("\n")
                                    .map(f => f.trim())
                                    .filter(Boolean)
                                    .sort((a, b) => b.length - a.length)
                                  }
                                >
                                  {(feature) => (
                                    <div class="flex gap-2">
                                      <span class="mt-1 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                                      <p>{feature}</p>
                                    </div>
                                  )}
                                </For>
                              </div>
                            </Match>

                            <Match when={infoTab() === "repack"}>
                              <div class="text-xs font-mono text-muted whitespace-pre-wrap leading-6">
                                {game()?.features}
                              </div>
                            </Match>
                          </Switch>
                        </div>
                      </div>
                    </Show>
                  </div>

                  {/* Right: Extras */}
                  <div class="flex flex-col gap-6">
                    <Show when={game()?.included_dlcs}>
                      <SidebarCard title="Included DLCs">
                        <div class="max-h-64 overflow-y-auto custom-scrollbar pr-2 space-y-1">
                          <For each={game()?.included_dlcs.split("\n").filter(d => d.trim() && d.trim() !== ":")}>
                            {(dlc) => (
                              <div class="text-xs text-muted/80 hover:text-text transition-colors py-1 border-b border-secondary-20/10 last:border-0">
                                {dlc.trim()}
                              </div>
                            )}
                          </For>
                        </div>
                      </SidebarCard>
                    </Show>

                    <Show when={game()?.executable_info?.executable_path}>
                      <SidebarCard title="Your Activity">
                        <div class="grid grid-cols-1 gap-4">
                          <StatItem icon={<Clock class="w-5 h-5" />} iconBg="bg-accent/20 text-accent" label="Time Played" value={formatPlayTime(game()!.executable_info.executable_play_time)} />
                          <StatItem icon={<Play class="w-5 h-5" />} iconBg="bg-primary/20 text-primary" label="Last Session" value={formatDate(game()!.executable_info.executable_last_opened_date)} small />
                        </div>
                      </SidebarCard>
                    </Show>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Match>
      </Switch>
    </div>
  );
};

// --- Inline Sub-Components ---

const MetadataRow = (props: { label: string; value: string; valueClass?: string; last?: boolean }) => (
  <div class={`flex justify-between items-baseline py-1 ${props.last ? "pt-2" : "border-b border-secondary-20/30"}`}>
    <span class="text-muted/70 text-xs font-bold uppercase tracking-wider">{props.label}</span>
    <span class={`max-w-50 truncate ${props.valueClass || "text-secondary-foreground"}`} title={props.value}>
      {props.value}
    </span>
  </div>
);

const ContentSection = (props: { title: string; children: any }) => (
  <div class="mb-6 last:mb-0">
    <div class="flex items-center gap-3 mb-4 pb-3 border-b border-secondary-20/40">
      <div class="w-1 h-4 bg-accent rounded-full"></div>
      <h2 class="text-lg font-semibold tracking-wide text-text">{props.title}</h2>
    </div>
    {props.children}
  </div>
);

// const CollapsibleContent = (props: { title: string; expanded: boolean; onToggle: () => void; children: any }) => (
//   <div class="mb-6 last:mb-0">
//     <button
//       onClick={props.onToggle}
//       class="flex items-center justify-between w-full gap-3 mb-3 cursor-pointer group"
//     >
//       <div class="flex items-center gap-3">
//         <div class={`w-1 h-4 transition-all duration-200 ${props.expanded ? "bg-accent" : "bg-secondary-20/40"}`}></div>
//         <h2 class="text-lg font-semibold tracking-wide text-text group-hover:text-accent/80 transition-colors">
//           {props.title}
//         </h2>
//       </div>
//       <ChevronDown
//         class={`w-5 h-5 text-muted transition-all duration-300 ${props.expanded ? "rotate-180 text-accent" : ""}`}
//       />
//     </button>
//     <div class={`overflow-hidden transition-all duration-300 ${props.expanded ? "max-h-500 opacity-100" : "max-h-0 opacity-0"}`}>
//       <div class="pt-2">
//         {props.children}
//       </div>
//     </div>
//   </div>
// );

const SidebarCard = (props: { title: string; children: any }) => (
  <div class="bg-secondary-20/10 border border-secondary-20/30 rounded-xl p-5 hover:border-secondary-20/50 transition-colors">
    <div class="flex items-center gap-2 mb-4 pb-3 border-b border-secondary-20/30">
      <div class="w-2 h-2 rounded-full bg-accent"></div>
      <h3 class="text-sm font-semibold uppercase tracking-wider text-text">{props.title}</h3>
    </div>
    {props.children}
  </div>
);

const StatItem = (props: { icon: any; iconBg: string; label: string; value: string; small?: boolean }) => (
  <div class="flex items-center gap-4 p-3 hover:bg-secondary-20/20 rounded-lg transition-colors">
    <div class={`p-3 rounded-lg ${props.iconBg}`}>
      {props.icon}
    </div>
    <div class="flex-1 min-w-0">
      <div class="text-xs text-muted uppercase tracking-wide mb-1">{props.label}</div>
      <div class={`font-medium text-text truncate ${props.small ? "text-sm" : "text-base"}`}>
        {props.value}
      </div>
    </div>
  </div>
);
export default DownloadGameUUIDPage;