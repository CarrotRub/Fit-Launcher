import { message } from "@tauri-apps/plugin-dialog";

export async function handleInstallerError(err: unknown) {
    if (typeof err === "object" && err !== null) {
        if ("InstallationError" in err) {
            const installErr = (err as { InstallationError: unknown }).InstallationError;
            if (installErr === "AdminModeError") {
                await message(
                    "Installation requires administrator privileges.\nPlease restart FitLauncher as administrator.",
                    { title: "Administrator Rights Required", kind: "error" }
                );
            } else if (
                typeof installErr === "object" &&
                installErr !== null &&
                "IOError" in installErr
            ) {
                await message(
                    `Installation failed due to an IO error:\n${(installErr as { IOError: string }).IOError
                    }`,
                    { title: "IO Error", kind: "error" }
                );
            } else {
                await message("An unknown installation error occurred.", {
                    title: "Installation Error",
                    kind: "error",
                });
            }
        } else if ("Io" in err) {
            await message(`A general IO error occurred:\n${(err as { Io: string }).Io}`, {
                title: "IO Error",
                kind: "error",
            });
        } else if ("Unrar" in err) {
            await message(`Failed to extract archive:\n${(err as { Unrar: string }).Unrar}`, {
                title: "Extraction Error",
                kind: "error",
            });
        } else {
            // Fallback for other objects
            await message(`An unknown error occurred: ${JSON.stringify(err)}`, {
                title: "Unknown Error",
                kind: "error",
            });
        }
    } else if (err === "NoParentDirectory") {
        await message(
            "Extraction failed because the parent directory doesn't exist.",
            { title: "Missing Directory", kind: "error" }
        );
    } else if (err === "NoRarFileFound") {
        await message("No RAR file found in the download directory.", {
            title: "Missing Archive File",
            kind: "error",
        });
    } else if (err === "AdminModeError") {
        await message(
            "Installation requires administrator privileges.\nPlease restart FitLauncher as administrator.",
            { title: "Administrator Rights Required", kind: "error" }
        );
    } else {
        await message("An unknown error occurred during extraction.", {
            title: "Unknown Error",
            kind: "error",
        });
    }
}
