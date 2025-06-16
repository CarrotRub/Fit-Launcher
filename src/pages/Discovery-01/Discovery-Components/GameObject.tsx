import { JSX, Show } from "solid-js";
import { DiscoveryGame } from "../../../bindings";
import HorizontalImagesCarousel from "./Horizontal-Image-Carousel-01/Image-Carousel";

export default function GameObject({
    gameItemObject,
    isToDownloadLater,
}: {
    gameItemObject: DiscoveryGame;
    isToDownloadLater: boolean;
}): JSX.Element {
    return (
        <Show when={gameItemObject.game_secondary_images.length > 0} >
            <div class="w-full flex flex-col items-center justify-center">
                <HorizontalImagesCarousel gameItemObject={gameItemObject} preloadedDownloadLater={isToDownloadLater}
                />
            </div>
        </Show>
    );
}