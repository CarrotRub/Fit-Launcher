
import PopularGames from "./Gamehub-Components-01/Popular-Games-01/Popular-Games";
import NewlyAddedGames from "./Gamehub-Components-01/Newly-Added-Games-01/Newly-Added-Games";
import RecentlyUpdatedGames from "./Gamehub-Components-01/Recently-Updated-Games-01/Recently-Updated-Games";

function Gamehub() {


    return (
        <div class="flex flex-col gap-4 divide-y divide-accent/70 w-full h-full overflow-y-auto no-scrollbar">
            <PopularGames />
            <NewlyAddedGames />
            <RecentlyUpdatedGames />
        </div>
    )

}

export default Gamehub;