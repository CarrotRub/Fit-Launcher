import { createSignal, For, JSX, Suspense, createResource, lazy, createEffect, Show } from 'solid-js';
import { DiscoveryGame } from '../../bindings';
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

type SortDirection = 'asc' | 'desc';
type SortOption = 'title' | 'size' | 'none';


function DiscoveryPage(): JSX.Element {
  const [currentPage, setCurrentPage] = createSignal(0);
  const [tags, setTags] = createSignal<SelectableTag[]>([]);
  const [openFilters, setOpenFilters] = createSignal(false);
  const [openSort, setOpenSort] = createSignal(false);
  const [sortBy, setSortBy] = createSignal<SortOption>('none');
  const [sortDirection, setSortDirection] = createSignal<SortDirection>('asc');
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

  const toggleFilters = () => {
    setOpenFilters(prev => !prev);
    setOpenSort(false);
  };

  const toggleSort = () => {
    setOpenSort(prev => !prev);
    setOpenFilters(false);
  };

  const extractSizeInMB = (description: string): number => {
    const repackMatch = description.match(/Repack Size:\s*([\d.]+)\s*([GMK])B/i);
    if (!repackMatch) return 0;
    
    const [_, size, unit] = repackMatch;
    const numSize = parseFloat(size);
    
    switch(unit.toUpperCase()) {
      case 'G': return numSize * 1024;
      case 'K': return numSize / 1024;
      case 'M': return numSize;
      default: return 0;
    }
  };

  const toggleSortOption = (option: SortOption) => {
    if (sortBy() === option) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(option);
      setSortDirection('asc');
    }
  };

  const sortedGames = () => {
    const data = gamesResource();
    if (!data) return [];
    const { games } = data;
    
    const direction = sortDirection() === 'asc' ? 1 : -1;
    
    switch(sortBy()) {
      case 'title':
        return [...games].sort((a, b) => 
          direction * a.game_title.localeCompare(b.game_title)
        );
      case 'size':
        return [...games].sort((a, b) => 
          direction * (extractSizeInMB(b.game_description) - extractSizeInMB(a.game_description))
        );
      default:
        return games;
    }
  };

   const visibleGames = () => {
    let filteredGames = sortedGames();
    const selectedTags = tags().filter(t => t.selected).map(t => t.tag);

    if (selectedTags.length > 0) {
      filteredGames = filteredGames.filter(game => {
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
      <div class='flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-background to-background-70'>
        <div class='flex bg-gradient-to-br from-background to-background-70 py-8 gap-4 overflow-y-auto no-scrollbar'>
          <button 
            onclick={toggleFilters} 
            class={`transition-all duration-300 p-2 border-1 rounded-xl min-w-20 cursor-pointer ${openFilters() ? 'bg-accent' : ''} hover:bg-accent flex align-center justify-center w-50`}>
              Filters 
              <ChevronDown class={`transition-all duration-300 ${openFilters() ? 'rotate-180' : '' }`}/>
          </button>
          <button 
            onclick={toggleSort} 
            class={`transition-all duration-300 p-2 border-1 rounded-xl min-w-20 cursor-pointer ${openSort() ? 'bg-accent' : ''} hover:bg-accent flex align-center justify-center w-50`}>
              Sort by 
              <ChevronDown class={`transition-all duration-300 ${openSort() ? 'rotate-180' : '' }`}/>
          </button>
        </div>
        <div class='flex bg-gradient-to-br from-background to-background-70 w-3/4 gap-4 overflow-y-auto no-scrollbar'>
          <Show when={openFilters() === true}>
            <div class='flex flex-wrap bg-gradient-to-br from-background to-background-70 gap-4 overflow-y-auto no-scrollbar mx-auto'>
              <For each={tags()}>
                {(tag) => (<button class={`p-2 border-1 rounded-xl min-w-20 cursor-pointer hover:bg-secondary ${tag.selected ? "bg-secondary" : ""}`} onClick={() => {handleTagClick(tag)}}>{tag.tag}</button>)}
              </For>
            </div>
          </Show>
          <Show when={openSort()}>
            <div class='flex flex-wrap bg-gradient-to-br from-background to-background-70 gap-4 overflow-y-auto no-scrollbar mx-auto'>
              <button 
                class={`p-2 border-1 rounded-xl min-w-20 cursor-pointer hover:bg-secondary ${sortBy() === 'title' ? "bg-secondary" : ""} flex items-center gap-2`}
                onClick={() => toggleSortOption('title')}>
                Title
                <Show when={sortBy() === 'title'}>
                  <ChevronDown 
                    class={`transition-all duration-300 ${sortDirection() === 'desc' ? 'rotate-180' : ''}`}
                    size={16}
                  />
                </Show>
              </button>
              <button 
                class={`p-2 border-1 rounded-xl min-w-20 cursor-pointer hover:bg-secondary ${sortBy() === 'size' ? "bg-secondary" : ""} flex items-center gap-2`}
                onClick={() => toggleSortOption('size')}>
                Size
                <Show when={sortBy() === 'size'}>
                  <ChevronDown 
                    class={`transition-all duration-300 ${sortDirection() === 'desc' ? 'rotate-180' : ''}`}
                    size={16}
                  />
                </Show>
              </button>
              <button 
                class={`p-2 border-1 rounded-xl min-w-20 cursor-pointer hover:bg-secondary ${sortBy() === 'none' ? "bg-secondary" : ""}`}
                onClick={() => {
                  setSortBy('none');
                  setSortDirection('asc');
                }}>
                Default
              </button>
            </div>
          </Show>
        </div>
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
