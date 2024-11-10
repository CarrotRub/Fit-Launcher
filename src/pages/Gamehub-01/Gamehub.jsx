import { createEffect } from "solid-js";
import './Gamehub.css'
import PopularGames from "./Gamehub-Components-01/Popular-Games-01/Popular-Games";
import NewlyAddedGames from "./Gamehub-Components-01/Newly-Added-Games-01/Newly-Added-Games";
import RecentlyUpdatedGames from "./Gamehub-Components-01/Recently-Updated-Games-01/Recently-Updated-Games";

function Gamehub() {


    return (
        <div className="gamehub content-page">
            <PopularGames/>
            <NewlyAddedGames/>
            <RecentlyUpdatedGames/>
        </div>
    )

}

export default Gamehub;