import { createEffect, createSignal, JSX } from "solid-js";
import { exists } from "@tauri-apps/plugin-fs";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, CheckCircle2, XCircle } from "lucide-solid";
import Button from "../Button/Button";
import { PathInputProps } from "../../../types/components/types";

export default function PathInput(props: PathInputProps) {
    const [currentPath, setCurrentPath] = createSignal(props.initialPath || "");
    const [localIsValid, setLocalIsValid] = createSignal(false);
    const [isFocused, setIsFocused] = createSignal(false);

    createEffect(() => {
        setCurrentPath(props.initialPath || "");
        validatePath(props.initialPath || "");
    });

    const validatePath = async (path: string) => {
        if (!path) {
            setLocalIsValid(false);
            props.onPathChange?.(path, false);
            return false;
        }

        try {
            const pathExists = await exists(path);
            setLocalIsValid(pathExists);
            props.onPathChange?.(path, pathExists);
            return pathExists;
        } catch (error) {
            console.error("Validation error:", error);
            setLocalIsValid(false);
            props.onPathChange?.(path, false);
            return false;
        }
    };

    const openFileDialog = async () => {
        try {
            const selected = await open({
                directory: props.isDirectory,
                defaultPath: currentPath() || undefined,
            });

            if (selected) {
                const isValid = await validatePath(selected);
                if (isValid) setCurrentPath(selected);
            }
        } catch (error) {
            console.error("File dialog error:", error);
        }
    };

    const displayValidation = typeof props.isValidPath !== "undefined" ? props.isValidPath : localIsValid();

    return (
        <div class={`relative w-full ${props.class || ""}`}>
            <div class={`
        flex items-center gap-2 w-full
        border rounded-lg overflow-hidden
        transition-all duration-200
        ${isFocused() ? "border-accent ring-2 ring-accent/20" : "border-secondary-20"}
        ${displayValidation ? "bg-background" : "bg-background-70"}
      `}>
                <input
                    type="text"
                    placeholder={props.placeholder || "Enter a path"}
                    value={currentPath()}
                    onInput={async (e) => {
                        const newPath = e.currentTarget.value;
                        setCurrentPath(newPath);
                        await validatePath(newPath);
                    }}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    class={`
            flex-1 py-2.5 px-4 bg-transparent
            text-text placeholder:text-muted/60
            focus:outline-none
          `}
                />

                <div class="flex items-center pr-2 gap-1">
                    <Button
                        onClick={openFileDialog}
                        variant="glass"
                        icon={<FolderOpen size={18} />}
                        label=""
                        class="px-2 text-muted hover:text-accent"
                    />

                    <div class="h-6 w-6 flex items-center justify-center">
                        {displayValidation ? (
                            <CheckCircle2 size={20} class="text-accent" />
                        ) : (
                            <XCircle size={20} class="text-warning-orange" />
                        )}
                    </div>
                </div>
            </div>

            {/* Animated focus highlight */}
            <div class={`
        absolute inset-0 -z-10 rounded-lg
        bg-gradient-to-r from-accent/10 to-primary/10
        opacity-0 transition-opacity duration-300
        ${isFocused() ? "opacity-100" : ""}
      `}></div>
        </div>
    );
};
