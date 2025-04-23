import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import "./PopupModal.css";

const PopupModal = (props) => {
    const [isVisible, setIsVisible] = createSignal(false);

    createEffect(() => {
        if (props.isOpen()) {
            setTimeout(() => setIsVisible(true), 10);
        } else {
            setIsVisible(false);
        }
    });

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(() => {
            if (props.onClose) props.onClose();
        }, 300); // Matches transition duration
    };

    const handleKeyDown = (e) => {
        if (e.key === "Escape") handleClose();
    };

    onMount(() => document.addEventListener("keydown", handleKeyDown));
    onCleanup(() => document.removeEventListener("keydown", handleKeyDown));

    return (
        <div
            class={`popup-modal-overlay ${props.isOpen() ? "show" : ""}`}
            onClick={handleClose}
        >
            <div
                class={`popup-modal-content ${isVisible() ? "visible" : ""}`}
                onClick={(e) => e.stopPropagation()}
            >
                {props.children}
            </div>
        </div>
    );
};

export default PopupModal;
