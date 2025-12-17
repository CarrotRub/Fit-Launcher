import { message } from "@tauri-apps/plugin-dialog";

export function resolveError(error: unknown): string {
    if (typeof error === "string") {
        return error;
    }

    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === "object" && error !== null && "message" in error) {
        return (error as { message: string }).message;
    }

    try {
        return JSON.stringify(error);
    } catch {
        return "An unknown error occurred";
    }
}

export async function showError(error: unknown, title: string = "FitLauncher"): Promise<void> {
    const errorMessage = resolveError(error);
    await message(errorMessage, {
        kind: "error",
        title,
    });
}
