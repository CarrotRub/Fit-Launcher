import { createSignal, createEffect, JSX, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { CircleArrowLeft, CircleArrowRight, MoveRight } from 'lucide-solid';
import { SliderProps } from '../../types/components/types';
import { commands } from '../../bindings';
import LazyImage from '../LazyImage/LazyImage';

const Slider = (props: SliderProps): JSX.Element => {
    const navigate = useNavigate();
    const [clicked, setClicked] = createSignal(false);
    const [currentIndex, setCurrentIndex] = createSignal(0);
    const sliderId = `slider-${crypto.randomUUID()}`;

    async function handleImageClick(gameTitle: string, filePath: string, gameHref: string) {
        if (!clicked()) {
            setClicked(true);
            const uuid = await commands.hashUrl(gameHref);
            navigate(`/game/${uuid}`, {
                state: { gameHref, gameTitle, filePath }
            });
        }
    };


    const goPrevious = () => setCurrentIndex(prev => Math.max(prev - 3, 0));
    const goNext = () => setCurrentIndex(prev => Math.min(prev + 3, props.images.length - 1));

    createEffect(() => {
        const container = document.querySelector<HTMLDivElement>(`#${sliderId} .slider-container`);
        const gradient = document.querySelector<HTMLDivElement>(`#${sliderId} .image-slider-gradient`);
        const skipperRight = document.querySelector<HTMLDivElement>(`#${sliderId} .skipper.right`);

        const itemWidth = 192; // each card
        const spacing = 16;     // the gap-4 (1rem = 16px)
        const totalWidth = props.images.length * (itemWidth + spacing) - spacing;
        const offset = -currentIndex() * (itemWidth + spacing);
        const containerWidth = container?.offsetWidth || 0;

        // Translate slider
        if (container) {
            container.style.transform = `translateX(${offset}px)`;
        }

        // Mask gradient
        if (gradient) {
            gradient.style.webkitMaskImage = currentIndex() > 0
                ? `linear-gradient(to right, var(--background-color) 0%, transparent 30%, transparent 70%, var(--background-color) 100%)`
                : `linear-gradient(to right, transparent 70%, var(--background-color) 100%)`;
            gradient.style.maskImage = gradient.style.webkitMaskImage;
        }

        // Hide right button if end reached
        const reachedEnd = Math.abs(offset) + containerWidth >= totalWidth;

        if (reachedEnd && skipperRight) {
            skipperRight.style.display = 'none';
            if (gradient) {
                gradient.style.webkitMaskImage = `linear-gradient(to left, transparent 70%, var(--background-color) 100%)`;
                gradient.style.maskImage = gradient.style.webkitMaskImage;
            }
        } else if (skipperRight?.style.display === 'none') {
            skipperRight.style.display = 'flex';
        }
    });


    return (
        <>
            <div id={sliderId} class="w-full flex flex-col gap-3 pt-4">
                <div class="overflow-x-auto w-full scroll-smooth no-scrollbar">
                    <div class="slider-container flex gap-4 px-4 transition-transform duration-500 ease-out">
                        <For each={props.images}>
                            {(image, index) => (
                                <div class="shrink-0">
                                    <div
                                        class="w-48 h-64 shrink-0 rounded-xl overflow-hidden bg-background shadow border border-secondary-30 hover:shadow-lg relative cursor-pointer group/image transition-all duration-300 hover:scale-[1.02]"
                                        onClick={() => handleImageClick(props.titles[index()], props.filePath || '', props.hrefs[index()])}
                                    >
                                        <LazyImage
                                            src={image}
                                            alt={props.titles[index()]}
                                            class="w-full h-full"
                                        />
                                        <div class="absolute bottom-0 w-full bg-gradient-to-t from-background/80 to-transparent px-3 py-2 flex justify-between items-end">
                                            <span class="text-text text-sm font-semibold truncate transition-all duration-300 group-hover/image:text-primary">
                                                {props.titles[index()]}
                                            </span>
                                            <MoveRight class="text-accent opacity-80 group-hover/image:translate-x-1 transition-all duration-200" size={18} />
                                        </div>
                                    </div>
                                </div>

                            )}
                        </For>
                    </div>
                </div>
            </div>
            <div class="flex w-full h-fit items-center justify-center gap-4 mt-3">
                <button
                    class={`skipper left p-2 rounded-full bg-background/90 border border-secondary-30 shadow backdrop-blur-md transition-all duration-200 hover:scale-105 ${currentIndex() === 0 ? 'opacity-0 cursor-default' : 'opacity-100 hover:bg-accent/10'}`}
                    onClick={goPrevious}
                >
                    <CircleArrowLeft size={24} class="text-accent" stroke-width={1.5} />
                </button>

                {/* Dots */}
                <Show when={props.images.length > 1}>
                    <div class="flex gap-2 items-center">
                        <For each={props.images}>
                            {(_, index) => (
                                <button
                                    onClick={() => setCurrentIndex(index())}
                                    class={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${currentIndex() === index() ? 'bg-accent w-6' : 'bg-secondary-20 hover:bg-accent/50'}`}
                                />
                            )}
                        </For>
                    </div>
                </Show>

                <button
                    class={`skipper right p-2 rounded-full bg-background/90 border border-secondary-30 shadow backdrop-blur-md transition-all duration-200 hover:scale-105 ${currentIndex() === props.images.length - 1 ? 'opacity-0 cursor-default' : 'opacity-100 hover:bg-accent/10'}`}
                    onClick={goNext}
                >
                    <CircleArrowRight size={24} class="text-accent" stroke-width={1.5} />
                </button>
            </div>
        </>
    );

};

export default Slider;