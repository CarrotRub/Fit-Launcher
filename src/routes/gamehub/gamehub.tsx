import "./gamehub.css";
import NewlyAddedGames from "./newly-added-games";
import PopularGames from "./popular-games";
import RecentlyUpdatedGames from "./recently-updated-games";

export default function GamehubPage() {
 //TODO: For all components of Gamehub, add fallback color to a game and add game color searching in rust backend during startup.

 return (
  <div class="gamehub content-page">
   <PopularGames />
   <NewlyAddedGames />
   <RecentlyUpdatedGames />
  </div>
 );
}
