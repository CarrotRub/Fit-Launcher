import { createSignal, For, JSX, Suspense, createResource, lazy } from 'solid-js';
import { appDataDir, join } from '@tauri-apps/api/path';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { commands, DiscoveryGame } from '../../bindings';
import LoadingPage from '../LoadingPage-01/LoadingPage';
const LazyGameObject = lazy(() => import("./Discovery-Components/GameObject"));

async function fetchDiscoveryGames(): Promise<{ games: DiscoveryGame[]; toDownloadLater: Set<string> }> {
  const appDir = await appDataDir();
  const settingsPath = await join(appDir, 'fitgirlConfig', 'settings', 'gamehub', 'gamehub.json');
  const settingsContent = await readTextFile(settingsPath);
  const settings = JSON.parse(settingsContent);
  const hideNSFW = settings.nsfw_censorship;


  const result = await commands.getDiscoveryGames();
  const filteredGames = result.status === 'ok'
    ? hideNSFW
      ? result.data.filter(game => !game.game_tags.includes('Adult'))
      : result.data
    : [];

  const gamesToDownloadPath = await join(appDir, 'library', 'games_to_download.json');
  let toDownloadLater = new Set<string>();

  try {
    const fileContent = await readTextFile(gamesToDownloadPath);
    const data = JSON.parse(fileContent) as { title: string }[];
    toDownloadLater = new Set(data.map(d => d.title));
  } catch {
    console.warn("No file yet")
  }

  return { games: filteredGames, toDownloadLater };
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

  return (
    <Suspense fallback={<LoadingPage />}>
      <div class="flex flex-col gap-4 w-full grow overflow-y-auto no-scrollbar">

        <For each={visibleGames()}>
          {(game) => (
            <LazyGameObject
              gameItemObject={game}
              isToDownloadLater={gamesResource()?.toDownloadLater.has(game.game_title) ?? false}
            />
          )}
        </For>
      </div>
      <div class="flex justify-center items-center gap-4 ">
        <button
          onClick={() => setCurrentPage(p => Math.max(p - 1, 0))}
          disabled={currentPage() === 0}
          class="px-4 py-2 bg-gray-800 text-white rounded disabled:opacity-50"
        >
          Previous
        </button>
        <span class="text-text">Page {currentPage() + 1}</span>
        <button
          onClick={() => {
            const total = gamesResource()?.games.length ?? 0;
            const maxPage = Math.floor((total - 1) / 25);
            setCurrentPage(p => Math.min(p + 1, maxPage));
          }}
          disabled={(currentPage() + 1) * 25 >= (gamesResource()?.games.length ?? 0)}
          class="px-4 py-2 bg-gray-800 text-text rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </Suspense>
  );
}





export default DiscoveryPage;
