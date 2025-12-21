import { Switch, Match, Show, JSX } from "solid-js";
import { useLocation } from "@solidjs/router";


import LoadingPage from "../LoadingPage-01/LoadingPage";
import { useDebridCache, useFavorites, useGameDatabase, useGameDetails, useGameImages, useGameResource } from "./hooks/games";
import { ErrorNotFound } from "./sections/ErrorNotFound";
import { TopbarSection } from "./sections/TopbarSection";
import GallerySection from "./sections/GallerySection";
import { SidebarSection } from "./sections/SidebarSection";
import { AboutSection } from "./sections/About/AboutSection";
import { FeaturesSection } from "./sections/FeaturesSection";
import { GamePageState } from "../../types/game";
import { ActivitySection } from "./sections/About/ActivitySection";


const GridCard = (props: { children: JSX.Element; class?: string }) => (
  <div class={`flex flex-col ${props.class ?? ""}`}>
    {props.children}
  </div>
);

const DownloadGameUUIDPage = () => {
  const location = useLocation<GamePageState>();
  const gameHref = () => location.state?.gameHref ?? "";

  const game = useGameResource(gameHref);
  const images = useGameImages(gameHref);
  const debrid = useDebridCache(game);
  const favorites = useFavorites(game);
  const gameDetails = useGameDetails(game);
  const downloadedGame = useGameDatabase(game);

  const currentGame = () => downloadedGame() ?? game();

  return (
    <Switch>
      <Match when={game.loading}>
        <LoadingPage />
      </Match>

      <Match when={!game.loading && !game()}>
        <ErrorNotFound />
      </Match>

      <Match when={game()}>
        <div class="flex flex-col h-full">
          <TopbarSection
            isSaved={favorites.isSaved}
            onToggleDownloadLater={favorites.toggle}
          />

          {/* Main Content */}
          <div class="flex-1 overflow-y-auto custom-scrollbar bg-popup-background">
            <div class="max-w-300 md:max-w-full md:px-24 mx-auto p-4 md:p-6">
              <div class="h-4" />

              <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(330px,1fr)] gap-6 lg:gap-8">
                {/* Left column */}
                <div class="flex flex-col gap-6">
                  <GridCard>
                    <GallerySection images={images} />
                  </GridCard>

                  <GridCard>
                    <AboutSection game={currentGame} downloadedGame={downloadedGame} />
                  </GridCard>
                </div>

                {/* Right column */}
                <div class="flex flex-col gap-6">
                  <GridCard>
                    <SidebarSection
                      game={currentGame}
                      gameDetails={gameDetails}
                      hasDebridCached={debrid}
                    />
                  </GridCard>

                  <Show when={currentGame()?.gameplay_features || currentGame()?.features}>
                    <GridCard>
                      <FeaturesSection game={currentGame} />
                    </GridCard>
                  </Show>
                  <Show when={currentGame()?.executable_info.executable_path !== "" && currentGame()?.executable_info.executable_path}>
                    <ActivitySection game={downloadedGame} />
                  </Show>
                </div>
              </div>

            </div>
          </div>
        </div>
      </Match>
    </Switch>
  );
};

export default DownloadGameUUIDPage;
