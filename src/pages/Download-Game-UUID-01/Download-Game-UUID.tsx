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
import LoadingPage from "../LoadingPage-01/LoadingPage";
import Button from "../../components/UI/Button/Button";
import createDownloadPopup from "../../Pop-Ups/Download-PopUp/Download-PopUp";
import { GameDetails, GamePageState } from "../../types/game";
import { DownloadType } from "../../types/popup";
import { useToast } from "solid-notifications";
import * as Debrid from "../../api/debrid/api";
import { open } from "@tauri-apps/plugin-shell";

import { InfoRow, InfoDivider } from "../../components/UI/Download-Game-Page/InfoRow/InfoRow";
import { CollapsibleSection } from "../../components/UI/Download-Game-Page/CollapsibleSection/CollapsibleSection";
import { ScreenshotGallery } from "../../components/UI/Download-Game-Page/ScreenshotGallery/ScreenshotGallery";
import { StatCard } from "../../components/UI/Download-Game-Page/StatCard/StatCard";

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
    const match = (label: string) =>
      description?.match(new RegExp(`${label}:\\s*([^\\n]+)`));

    setGameDetails({
      tags: match("Genres/Tags")?.[1]?.trim() ?? "N/A",
      companies: match("Company")?.[1]?.trim() ?? match("Companies")?.[1]?.trim() ?? "N/A",
      language: match("Languages")?.[1]?.trim() ?? "N/A",
      originalSize: match("Original Size")?.[1]?.trim() ?? "N/A",
      repackSize: match("Repack Size")?.[1]?.trim() ?? "N/A"
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
      setLoading(true);
      setGameInfo(undefined);
      setAdditionalImages([]);
      setCurrentGameHref(state.gameHref);
      setupImageEventListener();
      fetchGame(state.gameHref);
      fetchImages(state.gameHref);
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
          <div class="flex-1 overflow-y-auto custom-scrollbar">
            <div class="max-w-7xl mx-auto p-4 md:p-6">
              {/* Gallery + Sidebar */}
              <div class="flex flex-col lg:flex-row gap-6 mb-6">
                {/* Screenshot Gallery */}
                <div class="flex-1 lg:w-[60%]">
                  <ScreenshotGallery
                    images={additionalImages}
                    autoPlayInterval={5000}
                  />
                </div>

                {/* Sidebar */}
                <div class="lg:w-[40%] flex flex-col gap-4">
                  {/* Title */}
                  <div>
                    <h1 class="text-2xl md:text-3xl font-bold leading-tight mb-1">
                      {extractMainTitle(gameInfo()!.title)}
                    </h1>
                    <p class="text-sm text-muted line-clamp-2">{gameInfo()!.title}</p>
                  </div>

                  {/* Download Buttons */}
                  <div class="flex flex-col gap-2">
                    <Button
                      icon={<Magnet class="w-5 h-5" />}
                      label="Torrent Download"
                      onClick={() => handleDownloadPopup("bittorrent")}
                      class="w-full py-3 justify-center"
                      variant="bordered"
                    />
                    <div class="relative">
                      <Show when={hasDebridCached()}>
                        <div class="absolute -top-2 -right-2 z-10 flex items-center gap-1 px-2 py-0.5 bg-emerald-500 text-white text-xs font-semibold rounded-full shadow-lg">
                          <Zap class="w-3 h-3" />
                          Fast
                        </div>
                      </Show>
                      <Button
                        icon={<Globe class="w-5 h-5" />}
                        label="Direct Download"
                        onClick={() => handleDownloadPopup("direct_download")}
                        class="w-full py-3 justify-center"
                        variant="bordered"
                      />
                    </div>
                  </div>

                  {/* Quick Info Card */}
                  <div class="bg-popup-background rounded-xl p-4 border border-secondary-20 space-y-3">
                    <InfoRow
                      icon={<HardDrive class="w-4 h-4 text-accent" />}
                      iconBgClass="bg-accent/10"
                      label="Download Size"
                      value={gameDetails().repackSize}
                    />
                    <InfoRow
                      icon={<Package class="w-4 h-4 text-primary" />}
                      iconBgClass="bg-primary/10"
                      label="Original Size"
                      value={gameDetails().originalSize}
                    />
                    <InfoDivider />
                    <InfoRow
                      icon={<Factory class="w-4 h-4 text-muted" />}
                      label="Publisher"
                      value={gameDetails().companies}
                    />
                    <InfoRow
                      icon={<Languages class="w-4 h-4 text-muted" />}
                      label="Languages"
                      value={gameDetails().language}
                    />
                    <InfoRow
                      icon={<Tags class="w-4 h-4 text-muted" />}
                      label="Genres/Tags"
                      value={gameDetails().tags}
                      multiline
                    />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div class="mb-4">
                <CollapsibleSection
                  icon={<Info class="w-5 h-5 text-accent" />}
                  title="About This Game"
                >
                  <p class="text-sm text-muted leading-relaxed whitespace-pre-wrap">
                    {gameInfo()?.description || "Description not available"}
                  </p>
                </CollapsibleSection>
              </div>

              {/* Repack Features */}
              <Show when={gameInfo()?.features}>
                <div class="mb-4">
                  <CollapsibleSection
                    icon={<Package class="w-5 h-5 text-accent" />}
                    title="Repack Features"
                  >
                    <p class="text-sm text-muted leading-relaxed whitespace-pre-wrap">
                      {gameInfo()?.features}
                    </p>
                  </CollapsibleSection>
                </div>
              </Show>

              {/* Play Stats */}
              <Show when={gameInfo()?.executable_info?.executable_path}>
                <div class="bg-popup-background rounded-xl p-4 border border-secondary-20">
                  <h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Gamepad2 class="w-5 h-5 text-accent" />
                    Your Play Stats
                  </h2>
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatCard
                      icon={<Clock class="w-5 h-5 text-accent" />}
                      iconBgClass="bg-accent/10"
                      label="Play Time"
                      value={formatPlayTime(gameInfo()!.executable_info.executable_play_time)}
                    />
                    <StatCard
                      icon={<Play class="w-5 h-5 text-primary" />}
                      iconBgClass="bg-primary/10"
                      label="Last Played"
                      value={formatDate(gameInfo()!.executable_info.executable_last_opened_date)}
                    />
                    <StatCard
                      icon={<Calendar class="w-5 h-5 text-muted" />}
                      label="Installed"
                      value={formatDate(gameInfo()!.executable_info.executable_installed_date)}
                    />
                  </div>
                </div>
              </Show>
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
      )}
    </div>
  );
};

export default DownloadGameUUIDPage;