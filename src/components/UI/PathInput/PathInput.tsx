import { CheckCircle2, FolderOpen, XCircle } from "lucide-solid";
import Button from "../Button/Button";
import { open } from "@tauri-apps/plugin-dialog";
import { exists } from "@tauri-apps/plugin-fs";
import { createEffect, createSignal } from "solid-js";
import { PathInputProps } from "../../../types/components/types";

export default function PathInput(props: PathInputProps) {
    const [isFocused, setIsFocused] = createSignal(false);
    const [isValid, setIsValid] = createSignal(false);

    const validatePath = async (path: string) => {
        if (!path) {
            setIsValid(false);
            props.onPathChange?.(path, false);
            return false;
        }

        try {
            const pathExists = await exists(path);
            setIsValid(pathExists);
            props.onPathChange?.(path, pathExists);
            return pathExists;
        } catch (error) {
            console.error("Validation error:", error);
            setIsValid(false);
            props.onPathChange?.(path, false);
            return false;
        }
    };


    const openFileDialog = async () => {
        try {
            const selected = await open({
                directory: props.isDirectory,
                filters: props.filters,
                multiple: props.multipleFiles,
                defaultPath: props.value || undefined,
            });

            if (selected) {
                await validatePath(selected);
            }
        } catch (error) {
            console.error("File dialog error:", error);
        }
    };

    const displayValidation = () =>
        typeof props.isValidPath !== "undefined" ? props.isValidPath : isValid();
    createEffect(() => {
        if (props.value) {
            validatePath(props.value);
        }
    })

    return (
        <div class={`relative w-full ${props.class || ""}`}>
            <div
                class={`
                  flex items-center gap-2 w-full
                  border rounded-lg overflow-hidden
                  transition-all duration-200
                  ${isFocused() ? "border-accent ring-2 ring-accent/20" : "border-secondary-20"}
                  ${displayValidation() ? "bg-background" : "bg-background-70"}
                `}
            >
                <input
                    type="text"
                    placeholder={props.placeholder || "Enter a path"}
                    value={props.value}
                    onInput={async (e) => { props.onPathChange?.(e.currentTarget.value, false); await validatePath(e.currentTarget.value); }}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    class={`
                      flex-1  px-4 bg-transparent
                      text-text placeholder:text-muted/60
                      focus:outline-none
                    `}
                />

                <div class="flex items-center pr-2 gap-1">
                    <Button
                        onClick={openFileDialog}
                        variant="glass"
                        icon={<FolderOpen size={18} class="text-accent" stroke-width={2} />}
                        notRounded={true}
                    />
                    <div class="h-6 w-6 flex items-center justify-center">
                        {displayValidation() ? (
                            <CheckCircle2 size={20} class="text-accent" />
                        ) : (
                            <XCircle size={20} class="text-primary" />
                        )}
                    </div>
                </div>
            </div>

            <div
                class={`
                  absolute inset-0 -z-10 rounded-lg
                  bg-gradient-to-r from-accent/10 to-primary/10
                  opacity-0 transition-opacity duration-300
                  ${isFocused() ? "opacity-100" : ""}
                `}
            ></div>
        </div>
    );
}
