import { createSignal, For, JSX, Suspense, createResource, lazy } from 'solid-js';
import { appDataDir, join } from '@tauri-apps/api/path';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { commands, DiscoveryGame } from '../../bindings';
import LoadingPage from '../LoadingPage-01/LoadingPage';
import Button from '../../components/UI/Button/Button';
import { GamesCacheApi } from '../../api/cache/api';
import { LibraryApi } from '../../api/library/api';
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


function DiscoveryPage(): JSX.Element {
  const [currentPage, setCurrentPage] = createSignal(0);
  const [gamesResource] = createResource(fetchDiscoveryGames);

  const visibleGames = () => {
    const data = gamesResource();
    if (!data) return [];
    const { games } = data;
    const start = currentPage() * 25;
    return games.slice(start, start + 25);
  };
  //todo: add note from steam_api

  return (
    <Suspense fallback={<LoadingPage />}>
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
