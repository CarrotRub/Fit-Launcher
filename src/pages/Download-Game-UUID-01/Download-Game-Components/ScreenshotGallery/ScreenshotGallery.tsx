import { Show, For, Accessor, createSignal, createEffect, onCleanup, createMemo } from "solid-js";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-solid";
import LazyImage from "../../../../components/LazyImage/LazyImage";

interface ScreenshotGalleryProps {
    images: Accessor<string[]>;
    autoPlayInterval?: number;
    placeholderCount?: number;
}

export function ScreenshotGallery(props: ScreenshotGalleryProps) {
    const [currentIndex, setCurrentIndex] = createSignal(0);
    const [touchStartX, setTouchStartX] = createSignal(0);
    const [touchEndX, setTouchEndX] = createSignal(0);
    const [swipeDirection, setSwipeDirection] = createSignal<"left" | "right" | null>(null);

    let cycleIntervalID: number;

    const images = createMemo(() => props.images());
    const imageCount = createMemo(() => images().length);
    const placeholderCount = () => props.placeholderCount ?? 5;

    const displayCount = createMemo(() => imageCount() > 0 ? imageCount() : placeholderCount());

    createEffect(() => {
        const count = imageCount();
        if (count > 0 && currentIndex() >= count) {
            setCurrentIndex(0);
        }
    });

    const startCycle = () => {
        if (props.autoPlayInterval && imageCount() > 1) {
            clearInterval(cycleIntervalID);
            cycleIntervalID = setInterval(() => {
                setCurrentIndex((i) => (i + 1) % imageCount());
            }, props.autoPlayInterval);
        }
    };

    const goToNext = () => {
        if (imageCount() === 0) return;
        clearInterval(cycleIntervalID);
        setCurrentIndex((i) => (i + 1) % imageCount());
        startCycle();
    };

    const goToPrev = () => {
        if (imageCount() === 0) return;
        clearInterval(cycleIntervalID);
        setCurrentIndex((i) => (i - 1 + imageCount()) % imageCount());
        startCycle();
    };

    const goToImage = (index: number) => {
        if (imageCount() === 0) return;
        clearInterval(cycleIntervalID);
        setCurrentIndex(index);
        startCycle();
    };

    const handleTouchStart = (e: TouchEvent) => {
        setTouchStartX(e.touches[0].clientX);
        setTouchEndX(e.touches[0].clientX);
        clearInterval(cycleIntervalID);
    };

    const handleTouchMove = (e: TouchEvent) => {
        setTouchEndX(e.touches[0].clientX);
        const diff = touchStartX() - touchEndX();
        if (Math.abs(diff) > 30) {
            setSwipeDirection(diff > 0 ? "left" : "right");
        } else {
            setSwipeDirection(null);
        }
    };

    const handleTouchEnd = () => {
        if (!swipeDirection() || imageCount() === 0) {
            startCycle();
            return;
        }
        if (swipeDirection() === "left") {
            setCurrentIndex((i) => (i + 1) % imageCount());
        } else {
            setCurrentIndex((i) => (i - 1 + imageCount()) % imageCount());
        }
        setSwipeDirection(null);
        startCycle();
    };

    createEffect(() => {
        if (imageCount() > 0) {
            startCycle();
        }
    });

    onCleanup(() => {
        clearInterval(cycleIntervalID);
    });

    const currentImageSrc = createMemo(() => {
        const imgs = images();
        const idx = currentIndex();
        return imgs[idx] || "";
    });

    return (
        <div class="flex flex-col">
            {/* Main Image */}
            <div
                class="relative aspect-video rounded-xl overflow-hidden bg-secondary-20/30 shadow-lg"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Loading state when no images yet */}
                <Show when={imageCount() === 0}>
                    <div class="absolute inset-0 flex items-center justify-center bg-secondary-20/30 z-10">
                        <Loader2 class="w-10 h-10 text-accent animate-spin" />
                    </div>
                </Show>

                {/* Main image - uses LazyImage for async loading */}
                <Show when={currentImageSrc()}>
                    <LazyImage
                        src={currentImageSrc()}
                        alt={`Screenshot ${currentIndex() + 1}`}
                        class="w-full h-full"
                    />
                </Show>

                {/* Navigation Arrows - show when images available */}
                <Show when={imageCount() > 1}>
                    <button
                        onClick={goToPrev}
                        class="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-background/80 backdrop-blur-sm border border-secondary-20 hover:bg-accent/20 transition-all z-20"
                    >
                        <ChevronLeft class="w-5 h-5" />
                    </button>
                    <button
                        onClick={goToNext}
                        class="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-background/80 backdrop-blur-sm border border-secondary-20 hover:bg-accent/20 transition-all z-20"
                    >
                        <ChevronRight class="w-5 h-5" />
                    </button>
                </Show>

                {/* Image Counter */}
                <Show when={imageCount() > 1}>
                    <div class="absolute bottom-3 right-3 px-3 py-1 bg-background/80 backdrop-blur-sm rounded-full text-xs font-medium z-20">
                        {currentIndex() + 1} / {imageCount()}
                    </div>
                </Show>
            </div>

            {/* Thumbnail Strip - always visible with fixed 5 slots */}
            <div class="grid gap-2 mt-3" style={{ "grid-template-columns": `repeat(${placeholderCount()}, 1fr)` }}>
                <For each={Array(placeholderCount()).fill(null)}>
                    {(_, index) => {
                        const img = () => images()[index()];
                        return (
                            <button
                                onClick={() => goToImage(index())}
                                class={`aspect-video rounded-lg overflow-hidden border-2 transition-all bg-secondary-20/30 ${index() === currentIndex() && img()
                                    ? 'border-accent shadow-md shadow-accent/30'
                                    : 'border-transparent opacity-60 hover:opacity-100'
                                    }`}
                                disabled={!img()}
                            >
                                <Show when={img()} fallback={
                                    <div class="w-full h-full flex items-center justify-center">
                                        <Loader2 class="w-4 h-4 text-accent animate-spin" />
                                    </div>
                                }>
                                    <LazyImage
                                        src={img()!}
                                        alt={`Thumbnail ${index() + 1}`}
                                        class="w-full h-full"
                                    />
                                </Show>
                            </button>
                        );
                    }}
                </For>
            </div>
        </div>
    );
}
