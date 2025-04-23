
import { createEffect, createSignal } from "solid-js";
import { exists } from "@tauri-apps/plugin-fs";
import './PathInput.css'; 
import { open } from "@tauri-apps/plugin-dialog";
import Button from "../Button/Button";

const PathInput = (props) => {
    const {
        placeholder = "Enter a path",
        initialPath = "",
        isDirectory = false,
        onPathChange,
        isValidPath,
    } = props;

    const [currentPath, setCurrentPath] = createSignal(initialPath);
    const [localIsValid, setLocalIsValid] = createSignal(false);

    createEffect(() => {
        console.log("Initial path changed:", initialPath);
        setCurrentPath(initialPath);
        validatePath(initialPath);
    });


    const validatePath = async (path) => {
        try {
            const path_exists = await exists(path);
            setLocalIsValid(path_exists);
            if (onPathChange) onPathChange(path, path_exists);
            return path_exists;
        } catch (error) {
            console.error("Validation error:", error);
            setLocalIsValid(false);
            if (onPathChange) onPathChange(path, false);
            return false;
        }
    };

    const openFileDialog = async () => {
        try {
            const selected = await open({
                directory: isDirectory,
                defaultPath: currentPath() || undefined,
            });
            
            if (selected) {
                console.log("Selected path:", selected);
                const isValid = await validatePath(selected);
                if (isValid) {
                    console.log("It's valid")
                    setCurrentPath(selected);
                }
            }
        } catch (error) {
            console.error("File dialog error:", error);
        }
    };

    const displayValidation = typeof isValidPath !== 'undefined' ? isValidPath : localIsValid();

    return (
        <div className="path-input-container">
            <input
                className="path-input"
                placeholder={placeholder}
                value={currentPath()}
                onInput={async (e) => {
                    const newPath = e.target.value;
                    setCurrentPath(newPath);
                    await validatePath(newPath);
                }}
            />
            <Button onClick={openFileDialog} label="Browse"/>
            <span className="path-icon">
                {displayValidation ? (
                    <CheckIcon />
                ) : (
                    <ErrorIcon />
                )}
            </span>
        </div>
    );
};

const CheckIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)">
        <path d="M9 12l2 2 4-4" />
        <circle cx="12" cy="12" r="10" />
    </svg>
);

const ErrorIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--error-color)">
        <circle cx="12" cy="12" r="10" />
        <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
);

export default PathInput;