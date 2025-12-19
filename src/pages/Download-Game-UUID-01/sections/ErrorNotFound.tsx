import { useNavigate } from "@solidjs/router";
import { Info } from "lucide-solid"

export const ErrorNotFound = () => {
    const navigate = useNavigate();
    const handleReturn = () => navigate(localStorage.getItem("latestGlobalHref") || "/");
    return (
        <div class="flex flex-col items-center justify-center h-full px-4">
            <div class="text-center p-6 bg-popup-background rounded-lg border border-secondary-20 w-full max-w-sm">
                <Info class="w-10 h-10 text-accent mx-auto mb-3" />
                <h2 class="text-xl font-bold mb-2">Game Not Found</h2>
                <p class="text-sm text-muted mb-4">The game you're looking for couldn't be found in our library</p>
                <button onClick={handleReturn} class="w-full px-4 py-2 bg-accent hover:bg-accent/90 text-background rounded-lg transition-colors text-sm">
                    Back to Library
                </button>
            </div>
        </div>
    )
}