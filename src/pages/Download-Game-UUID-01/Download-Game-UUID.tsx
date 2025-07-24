import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import { useLocation } from "@solidjs/router";
import { LibraryApi } from "../../api/library/api";
import { GamesCacheApi } from "../../api/cache/api";
import { DownloadedGame } from "../../bindings";
import { ArrowLeft, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, Clock, Download, Factory, Gamepad2, Globe, HardDrive, Info, Languages, Loader2, Magnet, Tags } from "lucide-solid";
import { extractMainTitle, formatDate, formatPlayTime } from "../../helpers/format";
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
  const [touchStartX, setTouchStartX] = createSignal(0);
  const [touchEndX, setTouchEndX] = createSignal(0);
  const [swipeDirection, setSwipeDirection] = createSignal<"left" | "right" | null>(null);
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
  let heroSectionRef: HTMLDivElement;

  const location = useLocation<GamePageState>();

  function goToNextImage() {
    clearInterval(backgroundCycleIntervalID);
    setCurrentImageIndex((i) => (i + 1) % additionalImages().length);
    startBackgroundCycle();
  }

  function goToPrevImage() {
    clearInterval(backgroundCycleIntervalID);
    setCurrentImageIndex((i) => (i - 1 + additionalImages().length) % additionalImages().length);
    startBackgroundCycle();
  }

  function goToImage(index: number) {
    clearInterval(backgroundCycleIntervalID);
    setCurrentImageIndex(index);
    startBackgroundCycle();
  }


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

  function handleTouchStart(e: TouchEvent) {
    setTouchStartX(e.touches[0].clientX);
    setTouchEndX(e.touches[0].clientX);
    clearInterval(backgroundCycleIntervalID);
  }

  function handleTouchMove(e: TouchEvent) {
    setTouchEndX(e.touches[0].clientX);
    const diff = touchStartX() - touchEndX();
    console.log("Swipe is: ", diff > 0 ? "left" : "right")
    if (Math.abs(diff) > 30) {
      setSwipeDirection(diff > 0 ? "left" : "right");
    } else {
      setSwipeDirection(null);
    }
  }

  function handleTouchEnd() {
    if (!swipeDirection()) {
      startBackgroundCycle();
      return;
    }

    if (swipeDirection() === "left") {
      // Swipe left - go to next image
      setCurrentImageIndex((i) => (i + 1) % additionalImages().length);
    } else {
      // Swipe right - go to previous image
      setCurrentImageIndex((i) => (i - 1 + additionalImages().length) % additionalImages().length);
    }

    setSwipeDirection(null);
    startBackgroundCycle();
  }

  async function toggleDownloadLater() {
    const game = gameInfo();
    if (!game) return;

    try {
      if (isToDownloadLater()) {
        await library.removeGameToDownload(game.title);
        setToDownloadLater(false);
      } else {
        await library.addGameToCollection("games_to_download", library.downloadedGameToGame(game));
        setToDownloadLater(true);
      }
    } catch (err) {
      console.error("Error toggling download later", err);
    }
  }


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
    let onFinish = () => navigate("/downloads-page");
    createDownloadPopup({
      infoTitle: "Download Game",
      infoMessage: `Do you want to download ${gameInfo()!.title}`,
      downloadedGame: gameInfo()!,
      gameDetails: gameDetails(),
      downloadType,
      onFinish
    })
  }

  return (
    <div class="min-h-full min-w-screen bg-background text-text flex items-center justify-center">
      {loading() ? (
        <LoadingPage />
      ) : gameInfo() ? (
        <div class=" mx-auto w-screen   pb-8">
          {/* Hero Section */}
          <div
            ref={heroSectionRef!}
            class="relative h-128 w-full bg-cover bg-center mb-6 overflow-hidden transition-all duration-1000 ease-in-out"
            style={{
              'background-image': `url(${additionalImages()[currentImageIndex()]})`,
              'transform': swipeDirection() ?
                `translateX(${swipeDirection() === 'left' ? '-10' : '10'}px)` : 'translateX(0)',
              'transition': swipeDirection() ? 'transform 0.1s ease-out' : 'transform 0.5s ease-in-out'
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div class="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent pointer-events-none" />

            {/* Navigation */}
            <Show when={additionalImages().length > 1}>
              <div class="flex w-full justify-between items-center h-full px-4">
                <Button
                  icon={<ChevronLeft class="w-5 h-5 text-primary" />}
                  onClick={goToPrevImage}
                  size="sm"
                  class="!rounded-full z-10"
                  variant="glass"
                />

                <Button
                  icon={<ChevronRight class="w-5 h-5 text-primary" />}
                  onClick={goToNextImage}

                  class="!rounded-full z-10"
                  variant="glass"
                />
              </div>
            </Show>

            {/* Top Navigation */}
            <div class="absolute top-3 left-3 z-10 flex gap-2">

              <Button
                icon={<ArrowLeft class="w-5 h-5 text-primary" />}
                onClick={handleReturn}
                size="sm"
                variant="glass"
              />

              <Button
                icon={isToDownloadLater() ?
                  <BookmarkCheck class="w-5 h-5 text-primary" /> :
                  <Bookmark class="w-5 h-5 text-primary" />}
                onClick={toggleDownloadLater}
                size="sm"
                variant="glass"
                aria-label={isToDownloadLater() ? "Remove from download later" : "Add to download later"}
              />
            </div>

            {/* Image Indicators */}
            <Show when={additionalImages().length > 1}>
              <div class="absolute bottom-16 left-0 right-0 flex justify-center gap-2 z-10">
                {additionalImages().map((_, index) => (
                  <button
                    onClick={() => goToImage(index)}
                    class={`w-2 h-2 rounded-full transition-all ${index === currentImageIndex() ? 'bg-accent w-4' : 'bg-muted/50 hover:bg-muted'}`}
                  />
                ))}
              </div>
            </Show>

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

          <div class="flex w-full flex-col items-center justify-center px-4 gap-6">
            {/* Download Button */}
            <div class="w-full max-w-4xl flex flex-col gap-3">
              <div class="flex flex-col sm:flex-row gap-3 w-full">
                <Button
                  icon={<Magnet class="size-5" />}
                  label="Torrent Download"
                  onClick={() => handleDownloadPopup("bittorrent")}
                  class="flex-1 py-3 hover:bg-accent/90 transition-colors"
                  variant="bordered"
                />
                <div class="relative flex items-center justify-center">
                  <div class="absolute inset-0 flex items-center">
                    <div class="w-full border-t border-secondary-20"></div>
                  </div>
                  <div class="relative px-2 bg-popup text-xs text-muted">OR</div>
                </div>
                <Button
                  icon={<Globe class="size-5" />}
                  label="Direct Download"
                  onClick={() => handleDownloadPopup("direct_download")}
                  class="flex-1 py-3 hover:bg-accent/90 transition-colors"
                  variant="bordered"
                />
              </div>
              <p class="text-xs text-muted text-center">
                Choose your preferred download method
              </p>
            </div>

            {/* Game Info Grid */}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
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
                      <p class="text-xs text-muted">Repack Size</p>
                      <p class="text-sm font-medium">{gameDetails().repackSize}</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-2">
                    <HardDrive class="w-4 h-4 mt-0.5 text-muted flex-shrink-0" />
                    <div>
                      <p class="text-xs text-muted">Original Size</p>
                      <p class="text-sm font-medium">{gameDetails().originalSize}</p>
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