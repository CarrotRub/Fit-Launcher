import { createEffect } from "solid-js";
import './Gamehub.css'
import PopularGames from "./Gamehub-Components-01/Popular-Games-01/Popular-Games";

function Gamehub() {


    return (
        <div className="gamehub content-page">
            <PopularGames/>
        </div>
    )

}

export default Gamehub;