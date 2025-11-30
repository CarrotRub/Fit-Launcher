import { createMemo } from "solid-js";
import PopularGames from "./Gamehub-Components-01/Popular-Games-01/Popular-Games";
import NewlyAddedGames from "./Gamehub-Components-01/Newly-Added-Games-01/Newly-Added-Games";
import RecentlyUpdatedGames from "./Gamehub-Components-01/Recently-Updated-Games-01/Recently-Updated-Games";
import FilterBar from "../../components/FilterBar/FilterBar";
import { GamehubProvider, useGamehubFilters } from "./GamehubContext";

function GamehubContent() {
    const { filters, setFilters, availableGenres, repackSizeRange, originalSizeRange } = useGamehubFilters();

    return (
        <div class="relative flex flex-col gap-4 divide-y divide-accent/70 w-full h-full overflow-y-auto no-scrollbar">
            {/* Filter Bar */}


            <PopularGames />
            <div class="px-4  pb-3">
                <FilterBar
                    availableGenres={availableGenres()}
                    repackSizeRange={repackSizeRange()}
                    originalSizeRange={originalSizeRange()}
                    filters={filters()}
                    onFilterChange={setFilters}
                />
            </div>
            <NewlyAddedGames />
            <RecentlyUpdatedGames />
        </div>
    );
}

function Gamehub() {
    return (
        <GamehubProvider>
            <GamehubContent />
        </GamehubProvider>
    );
}

export default Gamehub;