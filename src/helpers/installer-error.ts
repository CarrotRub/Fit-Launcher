import { message } from "@tauri-apps/plugin-dialog";

/**
 * Handle errors from dm_extract_and_install command.
 * 
 * Note: Installation errors from the controller process are NOT handled here - 
 * they come via setup::hook::stopped events with success=false.
 * This only handles EXTRACTION errors that happen before the controller takes over.
 */
export async function handleInstallerError(err: unknown) {
    if (typeof err === "object" && err !== null) {
        if ("Io" in err) {
            await message(`A file system error occurred:\n${(err as { Io: string }).Io}`, {
                kind: "error",
                title: "IO Error",
            });
        } else if ("Unrar" in err) {
            await message(`Failed to extract archive:\n${(err as { Unrar: string }).Unrar}`, {
                kind: "error",
                title: "Extraction Error",
            });
        } else {
            await message(`An unknown error occurred: ${JSON.stringify(err)}`, {
                kind: "error",
                title: "Unknown Error",
            });
        }
    } else if (err === "NoParentDirectory") {
        await message(
            "Extraction failed because the parent directory doesn't exist.",
            { kind: "error", title: "Missing Directory" }
        );
    } else if (err === "NoRarFileFound") {
        await message("No RAR file found in the download directory.", {
            kind: "error",
            title: "Missing Archive File",
        });
    } else {
        await message("An unknown error occurred during extraction.", {
            kind: "error",
            title: "Unknown Error",
        });
    }
}

