import { message } from "@tauri-apps/plugin-dialog";

export function resolveError(error: unknown): string {
    let errorMessage: string;

    if (typeof error === "string") {
        errorMessage = error;
    } else if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === "object" && error !== null && "message" in error) {
        errorMessage = (error as { message: string }).message;
    } else {
        try {
            errorMessage = JSON.stringify(error);
        } catch {
            return "An unknown error occurred";
        }
    }

    // Translate common internal errors to user-friendly messages
    if (errorMessage.includes("state not managed") && errorMessage.includes("dm")) {
        return "Download service failed to initialize. This may occur if:\n\n• BitTorrent ports are reserved by Windows\n• WSL, Docker, or Hyper-V is reserving the port range\n• Another torrent client is running\n• Windows Firewall is blocking the app\n\nTry restarting your computer or check Windows port exclusions.";
    }

    if (errorMessage.includes("state not managed")) {
        return "A required service is still initializing. Please wait a moment and try again.";
    }

    return errorMessage;
}

export async function showError(error: unknown, title: string = "FitLauncher"): Promise<void> {
    const errorMessage = resolveError(error);
    await message(errorMessage, {
        kind: "error",
        title,
    });
}

