import { For, createEffect, createSignal, onMount } from "solid-js";
import { DragDropProvider, DragDropSensors, DragOverlay, SortableProvider, createSortable } from "@thisbeyond/solid-dnd";
import { useNavigate } from "@solidjs/router";
import { message } from "@tauri-apps/plugin-dialog";
import { render } from "solid-js/web";
import { LibraryAPI } from "../../../api/library/api";
import { DownloadedGame, Game } from "../../../bindings";
import BasicPathInputPopup from "../../../Pop-Ups/Basic-PathInput-PopUp/Basic-PathInput-PopUp";
import BasicChoicePopup from "../../../Pop-Ups/Basic-Choice-PopUp/Basic-Choice-PopUp";


const api = new LibraryAPI();

export default function GameDownloadedItem(props: {
  downloadedGamesList: DownloadedGame[];
  collectionsList: Record<string, Game[]>;
}) {
  const [games, setGames] = createSignal<DownloadedGame[]>(props.downloadedGamesList);
  const [clicked, setClicked] = createSignal(false);
  const [activeItem, setActiveItem] = createSignal<string | null>(null);

  onMount(() => {
    console.log("Collections:", props.collectionsList);
  });

  const ids = () => games().map(game => game.title);

  const handleGameClick = (title: string, href: string) => {
    if (!clicked()) {
      setClicked(true);
      const uuid = crypto.randomUUID();
      window.location.href = `/game/${uuid}`;
    }
  };

  const getExecutableInfo = async (path: string, folder: string) => {
    try {
      const info = await api.getExecutableInfo(path, folder);
      return info;
    } catch (err) {
      await message(String(err), { title: "Error", kind: "error" });
      return null;
    }
  };

  const addExecutablePath = async (game: DownloadedGame) => {
    const folder = game.installation_info.output_folder;
    render(
      () => (
        <BasicPathInputPopup
          infoTitle="Select game executable"
          infoMessage="Choose the .exe file for this game"
          defaultPath={folder}
          fileType={["exe"]}
          multipleFiles={false}
          isDirectory={false}
          infoPlaceholder="Executable Path"
          infoFooter=""
          action={async (path: string) => {
            const info = await getExecutableInfo(path, folder);
            if (info) {
              await api.updateGameExecutableInfo(game.title, info);
              window.location.reload();
            }
          }}
        />
      ),
      document.querySelector(".library")!
    );
  };

  const handleStartGame = (path: string) => {
    render(
      () => (
        <BasicChoicePopup
          infoTitle="Launch Game"
          infoMessage="Do you want to launch the game now?"
          infoFooter=""
          action={async () => {
            try {
              await api.runExecutable(path);
            } catch (err) {
              await message(String(err), { title: "Error", kind: "error" });
            }
          }}
        />
      ),
      document.querySelector(".library")!
    );
  };

  const onDragStart = ({ draggable }: any) => setActiveItem(draggable.id);
  const onDragEnd = ({ draggable, droppable }: any) => {
    if (draggable && droppable) {
      const from = games().findIndex(g => g.title === draggable.id);
      const to = games().findIndex(g => g.title === droppable.id);
      if (from !== to) {
        const list = [...games()];
        const [moved] = list.splice(from, 1);
        list.splice(to, 0, moved);
        setGames(list);
      }
    }
    setActiveItem(null);
  };

  const SortableGameItem = (props: { game: DownloadedGame; itemId: string }) => {
    const sortable = createSortable(props.itemId);
    const game = props.game;

    return (
      // <li use:sortable class="game-item">
      <li class="game-item">
        <img src={game.img} alt={game.title} onClick={() => handleGameClick(game.title, game.href)} />
        <p>{game.title}</p>
        <button onClick={() => game.executable_info.executable_path
          ? handleStartGame(game.executable_info.executable_path)
          : addExecutablePath(game)}>PLAY</button>
      </li>
    );
  };

  return (
    <DragDropProvider onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <DragDropSensors />
      <SortableProvider ids={ids()}>
        <ul class="game-list">
          <For each={games()}>{(game) => <SortableGameItem itemId={game.title} game={game} />}</For>
        </ul>
      </SortableProvider>
      {/* <DragOverlay /> */}
    </DragDropProvider>
  );
}
