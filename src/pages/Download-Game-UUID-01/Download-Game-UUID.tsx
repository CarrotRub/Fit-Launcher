import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import { useLocation } from "@solidjs/router";
import { LibraryApi } from "../../api/library/api";
import { GamesCacheApi } from "../../api/cache/api";
import { DownloadedGame } from "../../bindings";
import { ArrowLeft, Bookmark, BookmarkCheck, Clock, Download, Factory, Gamepad2, Globe, HardDrive, Info, Languages, Loader2, Magnet, Tags } from "lucide-solid";
import { formatDate, formatPlayTime } from "../../helpers/format";
import LoadingPage from "../LoadingPage-01/LoadingPage";
import Button from "../../components/UI/Button/Button";
import createDownloadPopup from "../../Pop-Ups/Download-PopUp/Download-PopUp";
import { GameDetails, GamePageState } from "../../types/game";
import { DownloadType } from "../../types/popup";

const library = new LibraryApi();
const cache = new GamesCacheApi();

const DownloadGameUUIDPage = () => {
  const [gameInfo, setGameInfo] = createSignal<DownloadedGame>();
  const [additionalImages, setAdditionalImages] = createSignal<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = createSignal(0);
  const [loading, setLoading] = createSignal(true);
  const [isToDownloadLater, setToDownloadLater] = createSignal(false);
  const [showPopup, setShowPopup] = createSignal(false);
  const [gameDetails, setGameDetails] = createSignal<GameDetails>({
    tags: "N/A",
    companies: "N/A",
    language: "N/A",
    originalSize: "N/A",
    repackSize: "N/A"
  });

  const navigate = useNavigate();
  const params = useParams();

  let backgroundCycleIntervalID: number;

  const location = useLocation<GamePageState>();
  const { gameHref, gameTitle, filePath } = location.state || {};

  async function fetchGame(gameHref: string) {
    try {
      setLoading(true);
      await cache.getSingularGameInfo(gameHref);
      const res = await cache.getSingularGameLocal(gameHref);
      if (res.status === "ok") {
        const game = library.gameToDownloadedGame(res.data);
        console.log(game)
        setGameInfo(game);
        extractDetails(game.desc);
        checkIfInDownloadLater(game.title);
      }
    } catch (err) {
      console.error("Failed to load game info", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchImages(gameHref: string) {
    try {
      const images = await cache.getGameImages(gameHref);
      if (images.status === "ok") {
        setAdditionalImages(images.data);
        startBackgroundCycle();
      }
    } catch {
      console.warn("No additional images available");
    }
  }


  async function checkIfInDownloadLater(title: string) {
    try {
      const list = await library.getGamesToDownload();
      const exists = list.some((g) => g.title === title);
      setToDownloadLater(exists);
    } catch (err) {
      console.error("Error checking download later list", err);
      setToDownloadLater(false);
    }
  }

  function extractDetails(description?: string) {
    const match = (label: string) =>
      description?.match(new RegExp(`${label}:\\s*([^\\n]+)`));

    const details: GameDetails = {
      tags: match("Genres/Tags")?.[1]?.trim() ?? "N/A",
      companies: match("Company")?.[1]?.trim()
        ?? match("Companies")?.[1]?.trim()
        ?? "N/A",
      language: match("Languages")?.[1]?.trim() ?? "N/A",
      originalSize: match("Original Size")?.[1]?.trim() ?? "N/A",
      repackSize: match("Repack Size")?.[1]?.trim() ?? "N/A"
    };

    setGameDetails(details);
  }


  function cutDescription(desc?: string): string {
    if (!desc) return "Description not available";
    const index = desc.indexOf("\nGame Description\n");
    return index !== -1 ? desc.substring(index + 19).trim() : desc.trim();
  }

  function startBackgroundCycle() {
    clearInterval(backgroundCycleIntervalID)
    backgroundCycleIntervalID = setInterval(() => {
      setCurrentImageIndex((i) => (i + 1) % additionalImages().length);
    }, 5000);
  }

  function extractMainTitle(title: string): string {
    return title
      ?.replace(/(?: - |, | )?(Digital Deluxe|Ultimate Edition|Deluxe Edition)\s*[:\-]?.*|(?: - |, ).*/, "")
      ?.replace(/\s*[:\-]\s*$/, "")
      ?.replace(/\(.*?\)/g, "")
      ?.replace(/\s*[:\u2013]\s*$/, "")
      ?.replace(/[\u2013].*$/, "");
  }

  async function toggleDownloadLater(checked: boolean) {
    const game = gameInfo();
    if (!game) return;
    if (checked) {
      await library.addGameToCollection("games_to_download", library.downloadedGameToGame(game));
    } else {
      await library.removeGameToDownload(game.title);
    }
    setToDownloadLater(checked);
  }

  const handleCheckboxChange = async (e: Event) => {
    const checked = (e.target as HTMLInputElement).checked;
    await toggleDownloadLater(checked);
  };

  const handleReturn = () => navigate(localStorage.getItem("latestGlobalHref") || "/");


  createEffect(() => {
    const state = location.state;
    if (state?.gameHref) {
      setLoading(true);
      setGameInfo(undefined);
      setAdditionalImages([]);
      console.log(state.gameHref)
      fetchGame(state.gameHref);
      fetchImages(state.gameHref);
    }
  });

  onCleanup(() => {
    clearInterval(backgroundCycleIntervalID);
  });

  function handleDownloadPopup(downloadType: DownloadType) {
    createDownloadPopup({
      infoTitle: "Download Game",
      infoMessage: `Do you want to download ${gameInfo()!.title}`,
      downloadedGame: gameInfo()!,
      gameDetails: gameDetails(),
      downloadType
    })
  }

  return (
    <div class="min-h-screen min-w-screen bg-background text-text">

      {loading() ? (
        <LoadingPage />
      ) : gameInfo() ? (
        <div class=" mx-auto pb-8">
          {/* Hero Section */}
          <div
            class="relative h-128 w-full bg-cover bg-center mb-6 overflow-hidden transition-all duration-1000 ease-in-out"
            style={{ 'background-image': `url(${additionalImages()[currentImageIndex()]})` }}
          >
            <div class="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

            {/* Navigation */}
            <div class="absolute top-3 left-3 z-10 flex gap-2">
              <button
                onClick={handleReturn}
                class="p-2 rounded-lg bg-background/80 hover:bg-secondary-20 text-primary transition-colors backdrop-blur-sm"
              >
                <ArrowLeft class="w-5 h-5" />
              </button>
              <label class="cursor-pointer p-2 rounded-lg bg-background/80 hover:bg-secondary-20 backdrop-blur-sm">
                <input
                  type="checkbox"
                  checked={isToDownloadLater()}
                  onChange={handleCheckboxChange}
                  class="hidden"
                />
                {isToDownloadLater() ? (
                  <BookmarkCheck class="w-5 h-5 text-accent" />
                ) : (
                  <Bookmark class="w-5 h-5 text-muted hover:text-accent" />
                )}
              </label>
            </div>

            {/* Game Title */}
            <div class="absolute bottom-4 left-4 right-4 z-10">
              <h1 class="text-2xl font-bold truncate">
                {extractMainTitle(gameInfo()!.title)}
              </h1>
              <p class="text-sm text-muted truncate">
                {gameInfo()!.title}
              </p>
            </div>
          </div>

          <div class="flex w-full flex-col items-center justify-center p-4 gap-6">
            {/* Download Button */}
            <div class="flex flex-row gap-4 w-[80%]">
              <Button
                icon={<Magnet class="size-5" />}
                label="Bittorrent Download"
                onClick={() => handleDownloadPopup("bittorrent")}
                class="w-full max-w-4xl"
              />
              <Button
                icon={<Globe class="size-5" />}
                label="Direct Download"
                onClick={() => handleDownloadPopup("direct_download")}
                class="w-full max-w-4xl"
              />
            </div>

            {/* Game Info Grid */}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Game Description */}
              <div class="bg-popup rounded-lg p-4 border border-secondary-20">
                <h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Info class="w-5 h-5 text-accent" />
                  Description
                </h2>
                <p class="text-sm text-muted leading-relaxed line-clamp-6 hover:line-clamp-none transition-all">
                  {cutDescription(gameInfo()?.desc)}
                </p>
              </div>

              {/* Game Details */}
              <div class="bg-popup rounded-lg p-4 border border-secondary-20">
                <h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Gamepad2 class="w-5 h-5 text-accent" />
                  Details
                </h2>
                <div class="space-y-3">
                  <div class="flex items-start gap-2">
                    <Tags class="w-4 h-4 mt-0.5 text-muted flex-shrink-0" />
                    <div>
                      <p class="text-xs text-muted">Genres/Tags</p>
                      <p class="text-sm font-medium">{gameDetails().tags}</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-2">
                    <Factory class="w-4 h-4 mt-0.5 text-muted flex-shrink-0" />
                    <div>
                      <p class="text-xs text-muted">Company</p>
                      <p class="text-sm font-medium">{gameDetails().companies}</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-2">
                    <Languages class="w-4 h-4 mt-0.5 text-muted flex-shrink-0" />
                    <div>
                      <p class="text-xs text-muted">Languages</p>
                      <p class="text-sm font-medium">{gameDetails().language}</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-2">
                    <HardDrive class="w-4 h-4 mt-0.5 text-muted flex-shrink-0" />
                    <div>
                      <p class="text-xs text-muted">Original Size</p>
                      <p class="text-sm font-medium">{gameDetails().originalSize}</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-2">
                    <HardDrive class="w-4 h-4 mt-0.5 text-muted flex-shrink-0" />
                    <div>
                      <p class="text-xs text-muted">Repack Size</p>
                      <p class="text-sm font-medium">{gameDetails().repackSize}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
          {/* Play Statistics */}
          <Show when={gameInfo()?.executable_info?.executable_path}>
            <div class="mt-4 bg-popup rounded-lg p-4 border border-secondary-20">
              <h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
                <Clock class="w-5 h-5 text-accent" />
                Play Stats
              </h2>
              <div class="grid grid-cols-3 gap-3">
                <div class="text-center">
                  <p class="text-xs text-muted">Play Time</p>
                  <p class="text-sm font-medium">
                    {formatPlayTime(gameInfo()!.executable_info.executable_play_time)}
                  </p>
                </div>
                <div class="text-center">
                  <p class="text-xs text-muted">Last Played</p>
                  <p class="text-sm font-medium">
                    {formatDate(gameInfo()!.executable_info.executable_last_opened_date)}
                  </p>
                </div>
                <div class="text-center">
                  <p class="text-xs text-muted">Installed</p>
                  <p class="text-sm font-medium">
                    {formatDate(gameInfo()!.executable_info.executable_installed_date)}
                  </p>
                </div>
              </div>
            </div>
          </Show>
        </div>
      ) : (
        <div class="flex flex-col items-center justify-center h-screen px-4">
          <div class="text-center p-6 bg-popup rounded-lg border border-secondary-20 w-full max-w-sm">
            <Info class="w-10 h-10 text-accent mx-auto mb-3" />
            <h2 class="text-xl font-bold mb-2">Game Not Found</h2>
            <p class="text-sm text-muted mb-4">
              We couldn't find the game you're looking for
            </p>
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
