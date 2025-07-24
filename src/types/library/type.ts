import { Accessor } from "solid-js";
import { DownloadedGame, Game } from "../../bindings";

export interface CollectionListProps {
  collectionGamesList: Accessor<Game[]> | Accessor<DownloadedGame[]>;
  collectionName: string;
  onCollectionRemove?: (name: string) => void;
}
