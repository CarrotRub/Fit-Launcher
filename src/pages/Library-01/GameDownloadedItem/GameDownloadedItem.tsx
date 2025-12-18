import { createSignal, For, Show } from "solid-js";
import { message } from "@tauri-apps/plugin-dialog";
import { showError } from "../../../helpers/error";
import { Play, Settings, Info, Trash2, BookmarkPlus } from "lucide-solid";
import { DownloadedGame, Game, ExecutableInfo, commands } from "../../../bindings";
import { LibraryApi } from "../../../api/library/api";
import createBasicChoicePopup from "../../../Pop-Ups/Basic-Choice-PopUp/Basic-Choice-PopUp";
import { Accessor } from "solid-js";
import Button from "../../../components/UI/Button/Button";
import createPathInputPopup from "../../../Pop-Ups/Basic-PathInput-PopUp/Basic-PathInput-PopUp";
import createAddToCollectionPopup from "../../../Pop-Ups/Basic-AddToCollection-PopUp/Basic-AddToCollection-PopUp";
import { formatDate, formatDiskSize, formatPlayTime } from "../../../helpers/format";
import { useNavigate } from "@solidjs/router";

const api = new LibraryApi();

//TODO: Delete item icon

export type LayoutType = "column" | "row";

export default function GameDownloadedItem(props: {
  downloadedGamesList: Accessor<DownloadedGame[]>;
  onGameInfoUpdate?: (title: string, info: ExecutableInfo) => void;
  onGameDelete?: (title: string) => void;
  onGameAddToCollection?: (collectionKey: string, game: Game) => void;
  createCollection: () => void | Promise<void>;
  layoutType?: Accessor<LayoutType>;
}) {
  const [clicked, setClicked] = createSignal(false);
  const [hoveredGame, setHoveredGame] = createSignal<string | null>(null);
  const [expandedGame, setExpandedGame] = createSignal<string | null>(null);
  const navigate = useNavigate();

  async function handleGameClick(gameTitle: string, gameHref: string) {
    if (!clicked()) {
      setClicked(true);
      const uuid = await commands.hashUrl(gameHref);
      navigate(`/game/${uuid}`, {
        state: { gameHref, gameTitle, filePath: "" }
      });
    }
  }

  const getExecutableInfo = async (path: string, folder: string) => {
    try {
      const info = await api.getExecutableInfo(path, folder);
      return info;
    } catch (err) {
      await showError(err, "Error");
      return null;
    }
  };

  const addExecutablePath = async (game: DownloadedGame) => {
    const folder = game.installation_info.output_folder.replace(" [FitGirl Repack]", "");
    createPathInputPopup({
      infoTitle: "Select game executable",
      infoMessage: "Choose the .exe file for this game",
      initialPath: folder,
      filters: [{ name: "Executable", extensions: ["exe", "bat"] }],
      multipleFiles: false,
      isDirectory: false,
      placeholder: "Executable Path",
      infoFooter: "",
      action: async (path: string) => {
        const info = await getExecutableInfo(path, folder);
        if (info) {
          await api.updateGameExecutableInfo(game.title, info);
          props.onGameInfoUpdate?.(game.title, info);
        }
      }
    });
  };

  const handleStartGame = (path: string) => {
    createBasicChoicePopup({
      infoTitle: "Launch Game",
      infoMessage: "Do you want to launch the game now?",
      action: async () => {
        try {
          await api.runExecutable(path);
        } catch (err) {
          await showError(err, "Error");
        }
      },
    });
  };

  const toggleExpand = (title: string) => {
    setExpandedGame(expandedGame() === title ? null : title);
  };

  async function handleRemoveGame(gameTitle: string): Promise<void> {
    const result = await api.removeDownloadedGame(gameTitle);
    if (result.status === "ok") {
      await message("The game has been deleted correctly!", { title: "FitLauncher", kind: "info" });
      props.onGameDelete?.(gameTitle);
    } else {
      await showError(result.error, "Error deleting the game");
    }
  }

  function removeGame(game: DownloadedGame) {
    createBasicChoicePopup({
      infoTitle: "Do you really want to delete this game ?",
      infoMessage: `This will remove <strong>${game.title}</strong> from your library !`,
      infoFooter: "This action is still in beta, you will have to delete the game yourself !",
      action: async () => {
        await handleRemoveGame(game.title)
      }
    })
    //todo: remove from downloaded_games
    //todo: del recursiv if exec path info


    // if (game.executable_info.executable_path !== "") {
    //   //todo: not safe has to ask user for specific folder starting from exec path ofc
    //   commands.deleteGameFolderRecursively(game.executable_info.executable_path)
    // }

  }

  function addGameToCollection(game: DownloadedGame) {
    createAddToCollectionPopup({
      infoTitle: "Where do you want to add this game ?",
      infoMessage: `Here you can choose in which collection to add your game !`,
      gameObjectInfo: api.downloadedGameToGame(game),
      action: async (addedTo: string[]) => {
        const gameAsGame = api.downloadedGameToGame(game);
        for (const collectionKey of addedTo) {
          console.log(game)
          props.onGameAddToCollection?.(collectionKey, gameAsGame);
        }
      },
      createCollection: props.createCollection
    })

  }

  const resolvedLayout = () => props.layoutType?.() ?? "column";

  return (
    <div class="w-full p-4 h-full">
      <Show
        when={resolvedLayout() === "column"}
        fallback={
          <div class="flex flex-wrap gap-4">
            <For each={props.downloadedGamesList()}>
              {(game) => (
                <div
                  class={`
                    w-[30%] xl:w-[20%]
                    flex-shrink-0 flex flex-col
                    rounded-xl bg-gradient-to-b from-background-30/20 to-background-30/10
                    backdrop-blur-sm border border-secondary-20
                    transition-all duration-300 overflow-hidden
                    hover:border-accent/50
                  `}
                  onMouseEnter={() => setHoveredGame(game.title)}
                  onMouseLeave={() => setHoveredGame(null)}
                >
                  {/* Game Cover */}
                  <div class="w-full aspect-[3/4] relative overflow-hidden">
                    <img
                      src={game.img}
                      alt={game.title}
                      class="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                      onClick={() => handleGameClick(game.title, game.href)}
                    />

                    <div class={`
                      absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-medium border-1 border-accent
                      ${game.executable_info?.executable_path ? "bg-secondary-30 text-primary" : "bg-secondary-30 text-accent"}
                    `}>
                      {game.executable_info?.executable_path ? "Ready" : "Setup Required"}
                    </div>
                  </div>

                  {/* Info and Actions */}
                  <div class="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 class="text-sm font-bold text-text truncate" title={game.title}>
                        {game.title}
                      </h3>
                      <p class="text-xs text-muted mt-1 truncate">
                        {game.installation_info.output_folder.split(/[\\/]/).pop()}
                      </p>
                    </div>

                    <div class="flex items-center justify-between mt-3">
                      <Show when={game.executable_info?.executable_path} fallback={
                        <button
                          class="p-1.5 rounded-full bg-secondary-20 hover:bg-secondary-30 text-muted transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            addExecutablePath(game);
                          }}
                          title="Setup"
                        >
                          <Settings class="size-4" />
                        </button>
                      }>
                        <button
                          class="p-1.5 rounded-full bg-accent/20 hover:bg-accent/30 text-accent transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartGame(game.executable_info.executable_path);
                          }}
                          title="Play"
                        >
                          <Play class="size-4" />
                        </button>
                      </Show>

                      <div class="flex gap-1">
                        <button
                          class="p-1.5 rounded-full hover:bg-secondary-20 text-muted transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            addGameToCollection(game);
                          }}
                          title="Add to collection"
                        >
                          <BookmarkPlus class="size-4" />
                        </button>
                        <button
                          class="p-1.5 rounded-full hover:bg-secondary-20 text-muted transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeGame(game);
                          }}
                          title="Delete"
                        >
                          <Trash2 class="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>

        }
      >
        <div class="flex flex-col gap-4">
          <For each={props.downloadedGamesList()}>
            {(game) => (
              <div
                class={`relative rounded-xl bg-gradient-to-r from-background-30/20 to-background-30/10 backdrop-blur-sm border border-secondary-20 transition-all duration-300 overflow-hidden ${hoveredGame() === game.title ? "border-accent/50" : ""
                  }`}
                onMouseEnter={() => setHoveredGame(game.title)}
                onMouseLeave={() => setHoveredGame(null)}
              >
                <div class="flex min-h-40 max-h-42">
                  {/* Game Cover */}
                  <div class="w-1/4 min-w-[160px] relative overflow-hidden">
                    <img
                      src={game.img}
                      alt={game.title}
                      class="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                      onClick={() => handleGameClick(game.title, game.href)}
                    />

                    {/* Status Badge */}
                    <div class={`absolute top-2 left-2 px-3 py-1 rounded-full text-xs font-medium ${game.executable_info
                      ? "bg-accent/90 text-background"
                      : "bg-secondary-30 text-text"
                      }`}>
                      {game.executable_info.executable_path !== "" ? "Ready to Play" : "Setup Required"}
                    </div>
                  </div>

                  {/* Game Info */}
                  <div class="flex-1 p-2 flex flex-col">
                    <div class="flex justify-between items-start">
                      <div>
                        <h3 class="text-lg font-bold text-text cursor-pointer">
                          {game.title}
                        </h3>
                        <p class="text-sm text-muted mt-1">
                          {game.installation_info.output_folder.split(/[\\/]/).pop()}
                        </p>
                      </div>

                      <div class="flex gap-2">
                        <button
                          class="p-2 rounded-full bg-secondary-20 hover:bg-secondary-30 text-muted transition-colors"
                          onClick={(e) => { e.stopPropagation(); addGameToCollection(game) }}
                        >
                          <BookmarkPlus class="w-4 h-4" />
                        </button>
                        <button
                          class="p-2 rounded-full bg-secondary-20 hover:bg-secondary-30 text-muted transition-colors"
                          onClick={(e) => { e.stopPropagation(); toggleExpand(game.title) }}
                        >
                          <Info class="w-4 h-4" />
                        </button>
                        <button
                          class="p-2 rounded-full bg-secondary-20 hover:bg-secondary-30 text-muted hover:text-primary transition-colors"
                          onClick={(e) => { e.stopPropagation(); removeGame(game) }}
                        >
                          <Trash2 class="w-4 h-4 " />
                        </button>
                      </div>
                    </div>

                    {/* Executable Info */}
                    <div class="mt-2 flex-1">
                      <Show when={game.executable_info}>
                        <div class="grid grid-cols-3 gap-3">
                          <div class="text-center">
                            <p class="text-xs text-muted">Play Time</p>
                            <p class="font-medium">
                              {formatPlayTime(game.executable_info!.executable_play_time)}
                            </p>
                          </div>
                          <div class="text-center">
                            <p class="text-xs text-muted">Last Played</p>
                            <p class="font-medium">
                              {formatDate(game.executable_info!.executable_last_opened_date)}
                            </p>
                          </div>
                          <div class="text-center">
                            <p class="text-xs text-muted">Size</p>
                            <p class="font-medium">
                              {formatDiskSize(game.executable_info!.executable_disk_size)}
                            </p>
                          </div>
                        </div>
                      </Show>
                    </div>

                    {/* Play Button */}
                    <div class="flex justify-end ">
                      <Show when={game.executable_info.executable_path !== ""}
                        fallback={
                          <Button size="sm" label="Set Up" icon={<Settings class="w-4 h-4" />} onClick={(e) => {
                            e.stopPropagation();
                            addExecutablePath(game);
                          }} />
                        }
                      >
                        <Button size="sm" label="Play Now" icon={<Play class="w-4 h-4" />} onClick={(e) => {
                          e.stopPropagation();
                          handleStartGame(game.executable_info.executable_path);
                        }} />
                      </Show>
                    </div>
                  </div>
                </div>

                {/* Additional Info Section */}
                <Show when={expandedGame() === game.title}>
                  <div class="bg-background-30 p-4 border-t border-secondary-20">
                    <div class="grid grid-cols-4 gap-4">
                      <div>
                        <p class="text-xs text-muted">Installed Date</p>
                        <p class="text-sm">
                          {game.executable_info
                            ? formatDate(game.executable_info.executable_installed_date)
                            : "N/A"}
                        </p>
                      </div>
                      <div>
                        <p class="text-xs text-muted">Executable Path</p>
                        <p class="text-sm truncate" title={game.executable_info?.executable_path || "Not configured"}>
                          {game.executable_info?.executable_path || "Not configured"}
                        </p>
                      </div>
                    </div>
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Empty State */}
      <Show when={props.downloadedGamesList().length === 0}>
        <div class="flex flex-col items-center justify-center py-16 text-center rounded-xl bg-background-30 border border-secondary-20">
          <div class="w-24 h-24 bg-secondary-20 rounded-full flex items-center justify-center mb-4">
            <Play class="w-12 h-12 text-muted" />
          </div>
          <h3 class="text-xl font-medium text-text mb-2">No Games Installed</h3>
          <p class="text-muted max-w-md">
            Your installed games will appear here. Download some games to get started!
          </p>
        </div>
      </Show>
    </div>
  );
}