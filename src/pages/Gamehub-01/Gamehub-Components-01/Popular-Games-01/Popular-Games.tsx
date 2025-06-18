import { createSignal, onMount, createEffect, onCleanup, Show, For } from 'solid-js';
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from '@solidjs/router';
import { GamesCacheAPI } from '../../../../api/cache/api';
import { setDownloadGamePageInfo } from '../../../../components/functions/dataStoreGlobal';
import { Game } from '../../../../bindings';
import { ChevronLeft, ChevronRight, Star, HardDrive, Languages, Building2, ArrowRight } from 'lucide-solid';
import LoadingPage from '../../../LoadingPage-01/LoadingPage';

const gameCacheInst = new GamesCacheAPI();
const popularGamesPath = await gameCacheInst.getPopularGamesPath();

async function parsePopularGames(): Promise<Game[]> {
  try {
    const result = await gameCacheInst.getPopularGames();
    if (result.status === "ok") {
      return await gameCacheInst.removeNSFW(result.data);
    }
    return [];
  } catch (err) {
    console.error('Error parsing game data:', err);
    throw err;
  }
}

export default function PopularGames() {
  const [games, setGames] = createSignal<Game[]>([]);
  const [selected, setSelected] = createSignal(0);
  const [loading, setLoading] = createSignal(true);
  const [isHovered, setIsHovered] = createSignal(false);
  const navigate = useNavigate();

  onMount(async () => {
    const parsedGames = await parsePopularGames();
    setGames(parsedGames);
    setLoading(false);
  });

  createEffect(() => {
    const interval = setInterval(() => {
      if (!isHovered() && games().length > 0) {
        setSelected((prev) => (prev + 1) % games().length);
      }
    }, 10000);
    onCleanup(() => clearInterval(interval));
  });

  function extractTitle(title: string) {
    return title
      ?.replace(/(?: - |, | )?(Digital Deluxe|Ultimate Edition|Deluxe Edition)\s*[:\-]?.*|(?: - |, ).*/, '')
      ?.replace(/\s*[:\-]\s*$/, '')
      ?.replace(/\(.*?\)/g, '')
      ?.replace(/[\–].*$/, '') ?? title;
  }

  function extractDetails(desc?: string) {
    if (!desc) return {
      GenreTags: 'N/A',
      Companies: 'N/A',
      Language: 'N/A',
      RepackSize: 'N/A'
    };

    return {
      GenreTags: desc.match(/Genres\/Tags:\s*([^\n]+)/)?.[1]?.trim() ?? 'N/A',
      Companies: desc.match(/Company(?:ies)?:\s*([^\n]+)/)?.[1]?.trim() ?? 'N/A',
      Language: desc.match(/Languages:\s*([^\n]+)/)?.[1]?.trim() ?? 'N/A',
      RepackSize: desc.match(/Repack Size:\s*([^\n]+)/)?.[1]?.trim() ?? 'N/A',
    };
  }

  function handleGameClick(game: Game) {
    const uuid = crypto.randomUUID();
    setDownloadGamePageInfo({
      gameTitle: game.title,
      gameHref: game.href,
      filePath: popularGamesPath
    });
    navigate(`/game/${uuid}`);
  }

  const current = () => games()[selected()] ?? {};
  const details = () => extractDetails(current().desc);

  return (
    <div class="relative w-full" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      {/* Loading State */}
      <Show when={loading()}>
        <LoadingPage />
      </Show>

      {/* Game Card */}
      <Show when={!loading() && games().length > 0}>
        <div class="relative h-120 rounded-xl overflow-hidden border-b border-secondary-20 bg-background-70 shadow-lg flex w-full">
          {/* Background Image with Blur Fallback */}
          <div class="absolute inset-0 overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-b from-background/70 to-background/30 z-10"></div>
            <div class="absolute inset-0 bg-secondary-20/50 backdrop-blur-sm"></div>
            <img
              src={current().img}
              class="absolute inset-0 w-full h-full object-cover opacity-80 transition-opacity duration-500"
              style={{ 'filter': 'blur(8px)' }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.opacity = '0.3';
                (e.currentTarget as HTMLImageElement).style.filter = 'blur(8px)';
              }}
            />
          </div>

          {/* Navigation Arrows */}
          <Show when={games().length > 1}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelected(prev => (prev - 1 + games().length) % games().length);
              }}
              class="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-background/90 backdrop-blur-md border border-secondary-20 shadow-lg hover:bg-accent/20 transition-all duration-300 hover:scale-110"
            >
              <ChevronLeft size={24} class="text-text" stroke-width={1.5} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelected(prev => (prev + 1) % games().length);
              }}
              class="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-background/90 backdrop-blur-md border border-secondary-20 shadow-lg hover:bg-accent/20 transition-all duration-300 hover:scale-110"
            >
              <ChevronRight size={24} class="text-text" stroke-width={1.5} />
            </button>
          </Show>

          {/* Game Content */}
          <div class="relative z-10 h-full flex flex-col justify-end p-6 w-fit">
            <div class="bg-background/90 backdrop-blur-sm rounded-xl p-6 border border-secondary-20/50 shadow-xl">
              {/* Title */}
              <div class="mb-4">
                <h2 class="text-3xl font-bold text-text leading-tight">
                  {extractTitle(current().title)}
                </h2>
                <p class="text-muted text-sm">{current().title}</p>
              </div>

              {/* Details Grid */}
              <div class="grid grid-cols-2 gap-4 mb-6">
                <div class="flex items-start gap-3">
                  <div class="p-2 bg-accent/10 rounded-lg">
                    <Star size={18} class="text-accent" stroke-width={1.5} />
                  </div>
                  <div>
                    <p class="text-xs text-muted uppercase tracking-wider">Genre/Tags</p>
                    <p class="text-text font-medium line-clamp-2">{details().GenreTags}</p>
                  </div>
                </div>
                <div class="flex items-start gap-3">
                  <div class="p-2 bg-accent/10 rounded-lg">
                    <Building2 size={18} class="text-accent" stroke-width={1.5} />
                  </div>
                  <div>
                    <p class="text-xs text-muted uppercase tracking-wider">Companies</p>
                    <p class="text-text font-medium line-clamp-2">{details().Companies}</p>
                  </div>
                </div>
                <div class="flex items-start gap-3">
                  <div class="p-2 bg-accent/10 rounded-lg">
                    <Languages size={18} class="text-accent" stroke-width={1.5} />
                  </div>
                  <div>
                    <p class="text-xs text-muted uppercase tracking-wider">Languages</p>
                    <p class="text-text font-medium">{details().Language}</p>
                  </div>
                </div>
                <div class="flex items-start gap-3">
                  <div class="p-2 bg-accent/10 rounded-lg">
                    <HardDrive size={18} class="text-accent" stroke-width={1.5} />
                  </div>
                  <div>
                    <p class="text-xs text-muted uppercase tracking-wider">Repack Size</p>
                    <p class="text-text font-medium">{details().RepackSize}</p>
                  </div>
                </div>
              </div>

              {/* View Button */}
              <button
                onClick={() => handleGameClick(current())}
                class="w-full flex items-center justify-center gap-2 px-6 py-3 bg-accent hover:bg-accent/90 text-background font-medium rounded-lg transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-accent/30"
              >
                View Game Details
                <ArrowRight size={18} class="transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>

          {/* Pagination Dots */}
          <Show when={games().length > 1}>
            <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
              <For each={games()}>
                {(_, index) => (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(index());
                    }}
                    class={`w-3 h-3 rounded-full transition-all duration-300 ${selected() === index()
                      ? 'bg-accent w-6 scale-125 shadow-sm shadow-accent/50'
                      : 'bg-secondary-20 hover:bg-accent/50'
                      }`}
                  />
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}