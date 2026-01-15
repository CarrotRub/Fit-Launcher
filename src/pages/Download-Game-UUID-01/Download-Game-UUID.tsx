import { Switch, Match, Show, JSX, createResource, createEffect } from "solid-js";
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
import { CommentsSection } from "./sections/CommentsSection";
import { GlobalSettingsApi } from "../../api/settings/api";
import createBasicChoicePopup from "../../Pop-Ups/Basic-Choice-PopUp/Basic-Choice-PopUp";
import { showError } from "../../helpers/error";

const GridCard = (props: { children: JSX.Element; class?: string }) => (
    <div class={`flex flex-col ${props.class ?? ""}`}>
        {props.children}
    </div>
);

// Local storage key to track if the comments popup has been shown
const COMMENTS_POPUP_SHOWN_KEY = "gamehub_comments_popup_seen" as const;

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

    const [allowComments, { refetch: getAllowCommentsSetting }] = createResource(async () => {
        if (!localStorage.getItem(COMMENTS_POPUP_SHOWN_KEY)) return false;
        try {
            return (await GlobalSettingsApi.getGamehubSettings()).game_page_allow_comments ?? false;
        } catch (error) {
            await showError(error, "Something went wrong fetching settings!");
            return false
        }
    });

    // First time popup to enable comments 
    createEffect(() => {
        const hasSeenPopup = localStorage.getItem(COMMENTS_POPUP_SHOWN_KEY);
        if (!allowComments.loading && !allowComments() && !hasSeenPopup) {
            createBasicChoicePopup({
                infoTitle: "Enable Comments",
                infoMessage: "This involves fetching data from third party services.",
                confirmLabel: "Allow",
                cancelLabel: "Don't show again",
                action: async () => {
                    try {
                        const settings = await GlobalSettingsApi.getGamehubSettings()
                        await GlobalSettingsApi.setGamehubSettings({ ...settings, game_page_allow_comments: true });
                        localStorage.setItem(COMMENTS_POPUP_SHOWN_KEY, "true");
                        await getAllowCommentsSetting();
                    } catch (error) {
                        await showError(error, "Something went wrong while saving settings!");
                    }
                },
                cancelAction() {
                    localStorage.setItem(COMMENTS_POPUP_SHOWN_KEY, "true");
                },
            });
        }
    });

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
                            <Show when={allowComments()}>
                                <GridCard class="mt-6">
                                    <CommentsSection title="User Comments" gameHref={gameHref()} />
                                </GridCard>
                            </Show>
                        </div>
                    </div>
                </div>
            </Match>
        </Switch>
    );
};

export default DownloadGameUUIDPage;
