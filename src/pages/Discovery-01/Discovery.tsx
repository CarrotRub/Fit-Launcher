import { createSignal, For, JSX, Suspense, createResource, lazy, createEffect, Show } from 'solid-js';
import { appDataDir, join } from '@tauri-apps/api/path';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { commands, DiscoveryGame } from '../../bindings';
import LoadingPage from '../LoadingPage-01/LoadingPage';
import Button from '../../components/UI/Button/Button';
import { GamesCacheApi } from '../../api/cache/api';
import { LibraryApi } from '../../api/library/api';
import { ChevronDown } from 'lucide-solid';
const LazyGameObject = lazy(() => import("./Discovery-Components/GameObject"));

const gameCacheInst = new GamesCacheApi();
const libraryInst = new LibraryApi();

async function fetchDiscoveryGames(): Promise<{ games: DiscoveryGame[]; toDownloadLater: Set<string> }> {
  try {
    const resultGame = await gameCacheInst.getDiscoveryGames();
    const downloadLaterList = await libraryInst.getGamesToDownload();
    const toDownloadLater = new Set(downloadLaterList.map(g => g.title));

    if (resultGame.status === "ok") {
      const filteredGames = await gameCacheInst.removeNSFW(resultGame.data);
      return { games: filteredGames, toDownloadLater };
    } else {
      console.warn("Failed to get discovery games from cache.");
      return { games: [], toDownloadLater };
    }
  } catch (error) {
    console.error("Error fetching discovery games:", error);
    throw error;
  }
}

type SelectableTag = {
  tag: string;
  selected: boolean;
}


function DiscoveryPage(): JSX.Element {
  const [currentPage, setCurrentPage] = createSignal(0);
  const [tags, setTags] = createSignal<SelectableTag[]>([]);
  const [openFilters, setOpenFilters] = createSignal(false);
  const [gamesResource] = createResource(fetchDiscoveryGames);

  createEffect(() => {
    const data = gamesResource();
    if (data) {
      //? Extract unique tags from all games, use ", " instead of trying to replace all spaces
      //? to avoid issues with tags that have spaces in them.
      const allTags = [...new Set(data.games.map(game => game.game_tags.split(', ')).flat())]
        .map(tag => ({ tag: tag.trim(), selected: false }));
      setTags(allTags.sort((a, b) => a.tag.localeCompare(b.tag)));
    }
  });

  const visibleGames = () => {
    const data = gamesResource();
    if (!data) return [];
    const { games } = data;
    const selectedTags = tags().filter(t => t.selected).map(t => t.tag);
    let filteredGames = games;

    if (selectedTags.length > 0) {
      filteredGames = games.filter(game => {
        const gameTags = game.game_tags.split(',').map(tag => tag.trim());
        return selectedTags.every(tag => gameTags.includes(tag));
      });
    }

    const start = currentPage() * 25;
    return filteredGames.slice(start, start + 25);
  };
  //todo: add note from steam_api

  const handleTagClick = (tag: SelectableTag) => {
    setTags(prevTags => prevTags.map(t => t.tag === tag.tag ? { ...t, selected: !t.selected } : t));
  };

  return (
    <Suspense fallback={<LoadingPage />}>
        <div class='flex flex-col bg-gradient-to-br from-background to-background-70 py-8 gap-4 w-1/2 grow overflow-y-auto no-scrollbar mx-auto'>
          <button 
            onclick={() => {setOpenFilters((previous) => !previous)}} 
            class={`transition-all duration-300 p-2 border-1 rounded-xl min-w-20 cursor-pointer ${openFilters() ? 'bg-accent' : ''} hover:bg-accent flex align-center justify-center w-50`}>
              Filters 
              <ChevronDown class={`transition-all duration-300 ${openFilters() ? 'rotate-180' : '' }`}/>
          </button>
          <Show when={openFilters() === true}>
            <div class='flex flex-wrap bg-gradient-to-br from-background to-background-70 py-8 gap-4 grow overflow-y-auto no-scrollbar mx-auto'>
              <For each={tags()}>
                {(tag) => (<button class={`p-2 border-1 rounded-xl min-w-20 cursor-pointer hover:bg-secondary ${tag.selected ? "bg-secondary" : ""}`} onClick={() => {handleTagClick(tag)}}>{tag.tag}</button>)}
              </For>
            </div>
          </Show>
        </div>
      <div class="flex flex-col bg-gradient-to-br from-background to-background-70 py-8 gap-4 w-full grow overflow-y-auto no-scrollbar">
        <For each={visibleGames()}>
          {(game) => (
            <LazyGameObject
              gameItemObject={game}
              isToDownloadLater={gamesResource()?.toDownloadLater.has(game.game_title) ?? false}
            />
          )}
        </For>
      </div>
      <div class="flex justify-center items-center gap-4 my-8">
        <Button label="Previous" disabled={currentPage() === 0} onClick={() => setCurrentPage(p => Math.max(p - 1, 0))} />

        <span class="text-text">Page {currentPage() + 1}</span>

        <Button label="Next" disabled={(currentPage() + 1) * 25 >= (gamesResource()?.games.length ?? 0)} onClick={() => {
          const total = gamesResource()?.games.length ?? 0;
          const maxPage = Math.floor((total - 1) / 25);
          setCurrentPage(p => Math.min(p + 1, maxPage));
        }} />
      </div>
    </Suspense>
  );
}





export default DiscoveryPage;
