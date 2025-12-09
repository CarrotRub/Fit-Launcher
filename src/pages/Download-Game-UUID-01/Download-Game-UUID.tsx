import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import { useLocation } from "@solidjs/router";
import { LibraryApi } from "../../api/library/api";
import { GamesCacheApi } from "../../api/cache/api";
import { commands, DownloadedGame } from "../../bindings";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Calendar,
  ChevronDown,
  Clock,
  ExternalLink,
  Factory,
  Gamepad2,
  Globe,
  HardDrive,
  Info,
  Languages,
  Magnet,
  Package,
  Play,
  Tags,
  Zap,
} from "lucide-solid";
import { extractMainTitle, formatDate, formatPlayTime } from "../../helpers/format";
import { extractCompany, extractLanguage, parseGameSize, formatBytesToSize } from "../../helpers/gameFilters";
import LoadingPage from "../LoadingPage-01/LoadingPage";
import Button from "../../components/UI/Button/Button";
import createDownloadPopup from "../../Pop-Ups/Download-PopUp/Download-PopUp";
import { GameDetails, GamePageState } from "../../types/game";
import { DownloadType } from "../../types/popup";
import { useToast } from "solid-notifications";
import * as Debrid from "../../api/debrid/api";
import { open } from "@tauri-apps/plugin-shell";

import { ScreenshotGallery } from "../../components/UI/Download-Game-Page/ScreenshotGallery/ScreenshotGallery";

const library = new LibraryApi();
const cache = new GamesCacheApi();

const DownloadGameUUIDPage = () => {
  const [gameInfo, setGameInfo] = createSignal<DownloadedGame>();
  const [additionalImages, setAdditionalImages] = createSignal<string[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [isToDownloadLater, setToDownloadLater] = createSignal(false);
  const [hasDebridCached, setHasDebridCached] = createSignal(false);
  const [gameDetails, setGameDetails] = createSignal<GameDetails>({
    tags: "N/A",
    companies: "N/A",
    language: "N/A",
    originalSize: "N/A",
    repackSize: "N/A"
  });
  const [repackFeaturesExpanded, setRepackFeaturesExpanded] = createSignal(false);

  const { notify } = useToast();
  const navigate = useNavigate();
  const location = useLocation<GamePageState>();

  // Track current game href for event filtering
  const [currentGameHref, setCurrentGameHref] = createSignal<string>("");
  let imageEventUnlisten: UnlistenFn | null = null;

  async function fetchGame(gameHref: string) {
    try {
      setLoading(true);
      setHasDebridCached(false);
      await cache.getSingularGameInfo(gameHref);
      const res = await cache.getSingularGameLocal(gameHref);
      if (res.status === "ok") {
        const game = library.gameToDownloadedGame(res.data);
        setGameInfo(game);
        extractDetails(game.details);
        checkIfInDownloadLater(game.title);
        if (game.magnetlink) {
          checkDebridCache(game.magnetlink);
        }
      }
    } catch (err) {
      console.error("Failed to load game info", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchImages(gameHref: string): Promise<void> {
    // First check if already cached - will return immediately if so
    try {
      const images = await cache.getGameImages(gameHref);
      if (images.status === "ok" && images.data.length > 0) {
        setAdditionalImages(images.data);
      }
      // If not cached, backend will emit events as images are processed
      // The listener set up in setupImageEventListener handles those
    } catch (err) {
      console.warn("Error fetching images:", err);
    }
  }

  async function setupImageEventListener() {
    // Clean up previous listener
    if (imageEventUnlisten) {
      imageEventUnlisten();
      imageEventUnlisten = null;
    }

    imageEventUnlisten = await listen<{
      game_link: string;
      image_url: string;
      index: number;
      total: number;
    }>("game_images::image_ready", (event) => {
      // Only handle events for the current game
      if (event.payload.game_link === currentGameHref()) {
        setAdditionalImages((prev) => {
          // Avoid duplicates
          if (prev.includes(event.payload.image_url)) {
            return prev;
          }
          return [...prev, event.payload.image_url];
        });
      }
    });
  }

  async function checkIfInDownloadLater(title: string) {
    try {
      const list = await library.getGamesToDownload();
      setToDownloadLater(list.some((g) => g.title === title));
    } catch {
      setToDownloadLater(false);
    }
  }

  async function checkDebridCache(magnet: string) {
    try {
      const hash = Debrid.extractHashFromMagnet(magnet);
      if (!hash) return;

      const providers = await Debrid.listProviders();
      for (const providerInfo of providers) {
        if (!providerInfo.supports_cache_check) continue;
        const hasCredResult = await Debrid.hasCredential(providerInfo.id);
        if (hasCredResult.status !== "ok" || !hasCredResult.data) continue;
        const cacheResult = await Debrid.checkCache(providerInfo.id, hash);
        if (cacheResult.status === "ok" && cacheResult.data.is_cached) {
          setHasDebridCached(true);
          return;
        }
      }
    } catch (err) {
      console.error("Error checking debrid cache", err);
    }
  }

  function extractDetails(description?: string) {
    if (!description) return;

    // Use centralized helpers
    const originalBytes = parseGameSize(description, 'original');
    const repackBytes = parseGameSize(description, 'repack');

    // Note: Tags extraction kept inline as currently expecting string, helper returns array
    const tagsMatch = description.match(/Genres\/Tags:\s*([^\n]+)/i);

    setGameDetails({
      tags: tagsMatch?.[1]?.trim() ?? "N/A",
      companies: extractCompany(description),
      language: extractLanguage(description),
      originalSize: originalBytes > 0 ? formatBytesToSize(originalBytes) : "N/A",
      repackSize: repackBytes > 0 ? formatBytesToSize(repackBytes) : "N/A"
    });
  }

  async function toggleDownloadLater() {
    const game = gameInfo();
    if (!game) return;

    try {
      if (isToDownloadLater()) {
        await library.removeGameToDownload(game.title);
        setToDownloadLater(false);
        notify(`${game.title} removed from favorites`, { type: "success" });
      } else {
        await library.addGameToCollection("games_to_download", library.downloadedGameToGame(game));
        setToDownloadLater(true);
        notify(`${game.title} added to favorites`, { type: "success" });
      }
    } catch {
      notify("Error updating favorites", { type: "error" });
    }
  }

  const handleReturn = () => navigate(localStorage.getItem("latestGlobalHref") || "/");

  function handleDownloadPopup(downloadType: DownloadType) {
    createDownloadPopup({
      infoTitle: "Download Game",
      infoMessage: `Do you want to download ${gameInfo()!.title}`,
      downloadedGame: gameInfo()!,
      gameDetails: gameDetails(),
      downloadType,
      onFinish: () => navigate("/downloads-page")
    });
  }

  createEffect(() => {
    const state = location.state;
    if (state?.gameHref) {
      const gameHref = state.gameHref; // Capture for closure
      setLoading(true);
      setGameInfo(undefined);
      setAdditionalImages([]);
      setCurrentGameHref(gameHref);

      // Use IIFE to properly await async operations in correct order
      (async () => {
        // MUST set up listener BEFORE fetching to catch all emitted events
        await setupImageEventListener();
        // Now safe to fetch - listener is ready
        fetchGame(gameHref);
        fetchImages(gameHref);
      })();
    }
  });

  // Cleanup event listener on unmount
  onCleanup(() => {
    if (imageEventUnlisten) {
      imageEventUnlisten();
    }
  });

  return (
    <div class="min-h-full w-full bg-background text-text">
      {loading() ? (
        <LoadingPage />
      ) : gameInfo() ? (
        <div class="flex flex-col h-full">
          {/* Top Bar */}
          <div class="flex items-center justify-between px-4 py-3 border-b border-secondary-20 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
            <Button
              icon={<ArrowLeft class="w-5 h-5" />}
              onClick={handleReturn}
              size="sm"
              variant="glass"
              label="Back"
            />
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
            <div class="max-w-[1200px] mx-auto p-4 md:p-6">
              {/* Breadcrumb / Top Spacing (Optional) */}
              <div class="h-4" />

              {/* Top Section: Gallery + Sidebar Info */}
              <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(330px,1fr)] gap-6 lg:gap-8 mb-8">

                {/* Left Col: Gallery */}
                <div class="min-w-0">
                  <ScreenshotGallery
                    images={additionalImages}
                    autoPlayInterval={5000}
                  />
                </div>

                {/* Right Col: Title, Actions, Stats */}
                <div class="flex flex-col gap-6">
                  {/* Title Block */}
                  <div>
                    <h1 class="text-3xl font-bold leading-tight mb-2 text-white">
                      {extractMainTitle(gameInfo()!.title)}
                    </h1>
                    <p class="text-sm text-muted line-clamp-3 leading-relaxed">
                      {/* Using description as short blurb, if too long it clamps */}
                      {gameInfo()?.description?.slice(0, 150) || gameInfo()!.title}...
                    </p>
                  </div>

                  {/* Actions / Downloads */}
                  <div class="flex flex-col gap-3">
                    <Button
                      icon={<Magnet class="w-4 h-4" />}
                      label="Torrent Download"
                      onClick={() => handleDownloadPopup("bittorrent")}
                      class="w-full py-3 justify-center text-sm font-semibold uppercase tracking-wide border border-secondary-20 bg-secondary-20/50 hover:bg-secondary-20 hover:text-white transition-all"
                      variant="bordered"
                    />
                    <div class="relative w-full">
                      <Show when={hasDebridCached()}>
                        <div class="absolute -top-2 -right-2 z-10 flex items-center gap-1 px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-bold uppercase rounded-sm shadow-md tracking-wider">
                          <Zap class="w-3 h-3" />
                          Fast
                        </div>
                      </Show>
                      <Button
                        icon={<Globe class="w-4 h-4" />}
                        label="Direct Download"
                        onClick={() => handleDownloadPopup("direct_download")}
                        class="w-full py-3 justify-center text-sm font-semibold uppercase tracking-wide border border-secondary-20 bg-secondary-20/50 hover:bg-secondary-20 hover:text-white transition-all"
                        variant="bordered"
                      />
                    </div>
                  </div>

                  {/* Metadata Cards (Steam Style) */}
                  <div class="flex flex-col gap-1 text-sm bg-popup-background/50 p-4 rounded-lg border border-secondary-20/50">
                    <div class="flex justify-between items-baseline py-1 border-b border-secondary-20/30">
                      <span class="text-muted/70 text-xs font-bold uppercase tracking-wider">Download Size</span>
                      <span class="text-accent font-mono">{gameDetails().repackSize}</span>
                    </div>
                    <div class="flex justify-between items-baseline py-1 border-b border-secondary-20/30">
                      <span class="text-muted/70 text-xs font-bold uppercase tracking-wider">Orig Size</span>
                      <span class="text-primary font-mono">{gameDetails().originalSize}</span>
                    </div>
                    <div class="flex justify-between items-baseline py-1 border-b border-secondary-20/30">
                      <span class="text-muted/70 text-xs font-bold uppercase tracking-wider">Publisher</span>
                      <span class="text-secondary-foreground truncate max-w-[150px]" title={gameDetails().companies}>{gameDetails().companies}</span>
                    </div>
                    <div class="flex justify-between items-start py-1 pt-2">
                      <span class="text-muted/70 text-xs font-bold uppercase tracking-wider shrink-0 mt-0.5">Languages</span>
                      <span class="text-secondary-foreground text-xs text-right max-w-[200px] leading-tight">{gameDetails().language}</span>
                    </div>
                  </div>

                  {/* Tags */}
                  <div class="flex flex-wrap gap-1.5">
                    {gameDetails().tags.split(',').map(tag => (
                      <span class="px-2 py-1 bg-secondary-20/30 text-secondary-foreground text-xs rounded hover:bg-secondary-20/50 cursor-default transition-colors">
                        {tag.trim()}
                      </span>
                    ))}
                  </div>

                  {/* Included DLCs */}


                </div>
              </div>

              {/* Lower Section: About + Requirements + Stats */}
              <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(330px,1fr)] gap-8">
                {/* Left: About */}
                <div class="space-y-6">
                  <Show when={gameInfo()?.description}>
                    <div>
                      <div class="flex items-center gap-2 mb-2 pb-1 border-b border-secondary-20">
                        <h2 class="text-lg font-semibold uppercase tracking-wide text-white">About This Game</h2>
                      </div>
                      <div class="text-sm text-muted leading-7 space-y-4 font-light text-justify whitespace-pre-wrap">
                        {gameInfo()?.description}
                      </div>
                    </div>
                  </Show>

                  <Show when={gameInfo()?.gameplay_features}>
                    <div>
                      <div class="flex items-center gap-2 mb-2 pb-1 border-b border-secondary-20">
                        <h2 class="text-lg font-semibold uppercase tracking-wide text-white">Game Features</h2>
                      </div>
                      <div class="text-sm text-muted leading-7 space-y-4 font-light text-justify">
                        {gameInfo()?.gameplay_features.split('\n').map((feature) => (
                          feature.trim() && (
                            <div class="pl-2 border-l-2 border-accent/20">
                              <p>{feature}</p>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  </Show>

                  <Show when={gameInfo()?.features}>
                    <div>
                      <button
                        onClick={() => setRepackFeaturesExpanded(!repackFeaturesExpanded())}
                        class="flex items-center justify-between w-full gap-2 mb-2 pb-1 border-b border-secondary-20 cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        <h2 class="text-lg font-semibold uppercase tracking-wide text-white">Repack Features</h2>
                        <ChevronDown
                          class={`w-5 h-5 text-muted transition-transform duration-200 ${repackFeaturesExpanded() ? 'rotate-180' : ''}`}
                        />
                      </button>
                      <div
                        class={`overflow-hidden transition-all duration-200 ${repackFeaturesExpanded() ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
                      >
                        <div class="text-sm text-muted leading-6 whitespace-pre-wrap font-mono bg-secondary-20/20 p-4 rounded border border-secondary-20/30">
                          {gameInfo()?.features}
                        </div>
                      </div>
                    </div>
                  </Show>
                </div>

                {/* Right: User Stats (Your Stuff) */}
                <div class="flex flex-col gap-6">
                  {/* Included DLCs (Moved here) */}
                  <Show when={gameInfo()?.included_dlcs}>
                    <div class="bg-gradient-to-br from-secondary-20/30 to-background border border-secondary-20 rounded-lg p-4">
                      <div class="flex items-center gap-2 mb-3 pb-1 border-b border-secondary-20/50">
                        <h3 class="text-sm font-bold uppercase tracking-wider text-white">Included DLCs</h3>
                      </div>
                      <div class="max-h-64 overflow-y-auto custom-scrollbar pr-2 space-y-1">
                        {gameInfo()?.included_dlcs.split('\n').map((dlc) => (
                          dlc.trim().length > 0 && dlc.trim() !== ":" && (
                            <div class="text-xs text-muted/80 hover:text-white transition-colors py-1 border-b border-secondary-20/10 last:border-0">
                              {dlc.trim()}
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  </Show>

                  <Show when={gameInfo()?.executable_info?.executable_path}>
                    <div class="bg-gradient-to-br from-secondary-20/30 to-background border border-secondary-20 rounded-lg p-4">
                      <h3 class="text-sm font-bold uppercase tracking-wider text-muted mb-4 border-b border-secondary-20/50 pb-2">Your Activity</h3>

                      <div class="grid grid-cols-1 gap-4">
                        <div class="flex items-center gap-3">
                          <div class="p-2 bg-accent/20 text-accent rounded">
                            <Clock class="w-5 h-5" />
                          </div>
                          <div>
                            <div class="text-xs text-muted uppercase font-bold">Time Played</div>
                            <div class="text-lg font-mono text-white">{formatPlayTime(gameInfo()!.executable_info.executable_play_time)}</div>
                          </div>
                        </div>
                        <div class="flex items-center gap-3">
                          <div class="p-2 bg-primary/20 text-primary rounded">
                            <Play class="w-5 h-5" />
                          </div>
                          <div>
                            <div class="text-xs text-muted uppercase font-bold">Last Session</div>
                            <div class="text-sm text-white">{formatDate(gameInfo()!.executable_info.executable_last_opened_date)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Show>
                </div>
              </div>

            </div>
          </div>
        </div>
      ) : (
        <div class="flex flex-col items-center justify-center h-full px-4">
          <div class="text-center p-6 bg-popup-background rounded-lg border border-secondary-20 w-full max-w-sm">
            <Info class="w-10 h-10 text-accent mx-auto mb-3" />
            <h2 class="text-xl font-bold mb-2">Game Not Found</h2>
            <p class="text-sm text-muted mb-4">We couldn't find the game you're looking for</p>
            <button
              onClick={handleReturn}
              class="w-full px-4 py-2 bg-accent hover:bg-accent/90 text-background rounded-lg transition-colors text-sm"
            >
              Back to Library
            </button>
          </div>
        </div>
      )
      }
    </div >
  );
};

export default DownloadGameUUIDPage;