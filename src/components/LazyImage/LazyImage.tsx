import { createSignal, createEffect, Show, onCleanup } from "solid-js";
import { Loader2 } from "lucide-solid";

interface LazyImageProps {
    src: string;
    alt?: string;
    class?: string;
    style?: any;
    onLoad?: () => void;
    onError?: (e: Event) => void;
    maxRetries?: number;
    retryDelay?: number;
}

export default function LazyImage(props: LazyImageProps) {
    const [loaded, setLoaded] = createSignal(false);
    const [retrying, setRetrying] = createSignal(false);
    const [currentSrc, setCurrentSrc] = createSignal(props.src);
    const [retryCount, setRetryCount] = createSignal(0);

    const maxRetries = props.maxRetries ?? 5;
    const baseDelay = props.retryDelay ?? 1000;

    let retryTimeout: number | undefined;

    createEffect(() => {
        if (props.src !== currentSrc()) {
            clearTimeout(retryTimeout);
            setLoaded(false);
            setRetrying(false);
            setRetryCount(0);
            setCurrentSrc(props.src);
        }
    });

    onCleanup(() => {
        clearTimeout(retryTimeout);
    });

    const handleLoad = () => {
        setLoaded(true);
        setRetrying(false);
        setRetryCount(0);
        props.onLoad?.();
    };

    const handleError = (e: Event) => {
        const attempts = retryCount();

        if (attempts < maxRetries) {
            setRetrying(true);
            const delay = baseDelay * Math.pow(1.5, attempts);

            retryTimeout = setTimeout(() => {
                setRetryCount(attempts + 1);
                const separator = props.src.includes('?') ? '&' : '?';
                setCurrentSrc(`${props.src}${separator}_retry=${attempts + 1}`);
            }, delay);
        } else {
            setRetrying(false);
            setLoaded(true);
            props.onError?.(e);
        }
    };

    const isLoading = () => !loaded() || retrying();

    return (
        <div class={`relative ${props.class ?? ""}`} style={props.style}>
            {/* Spinner while loading or retrying */}
            <Show when={isLoading()}>
                <div class="absolute inset-0 flex items-center justify-center bg-secondary-20/30">
                    <Loader2 class="w-6 h-6 text-accent animate-spin" />
                </div>
            </Show>

            {/* Actual image */}
            <img
                src={currentSrc()}
                alt={props.alt ?? ""}
                class={`w-full h-full object-cover transition-opacity duration-300 ${loaded() && !retrying() ? 'opacity-100' : 'opacity-0'}`}
                onLoad={handleLoad}
                onError={handleError}
            />
        </div>
    );
}
