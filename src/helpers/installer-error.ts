import { message } from "@tauri-apps/plugin-dialog";

export async function handleInstallerError(err: unknown) {
    if (typeof err === "object" && err !== null) {
        if ("InstallationError" in err) {
            const installErr = (err as { InstallationError: unknown }).InstallationError;
            if (installErr === "AdminModeError") {
                await message(
                    "Installation requires administrator privileges.\nPlease restart FitLauncher as administrator.",
                    { kind: "error", title: "Administrator Rights Required" }
                );
            } else if (
                typeof installErr === "object" &&
                installErr !== null &&
                "IOError" in installErr
            ) {
                await message(
                    `Installation failed due to an IO error:\n${(installErr as { IOError: string }).IOError
                    }`,
                    { kind: "error", title: "IO Error" }
                );
            } else {
                await message("An unknown installation error occurred.", {
                    kind: "error",
                    title: "Installation Error",
                });
            }
        } else if ("Io" in err) {
            await message(`A general IO error occurred:\n${(err as { Io: string }).Io}`, {
                kind: "error",
                title: "IO Error",
            });
        } else if ("Unrar" in err) {
            await message(`Failed to extract archive:\n${(err as { Unrar: string }).Unrar}`, {
                kind: "error",
                title: "Extraction Error",
            });
        } else {
            // Fallback for other objects
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
    } else if (err === "AdminModeError") {
        await message(
            "Installation requires administrator privileges.\nPlease restart FitLauncher as administrator.",
            { kind: "error", title: "Administrator Rights Required" }
        );
    } else {
        await message("An unknown error occurred during extraction.", {
            kind: "error",
            title: "Unknown Error",
        });
    }
}
