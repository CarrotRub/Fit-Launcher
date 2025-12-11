import { Accessor } from "solid-js";
import { Game } from "../../bindings";

export interface CollectionListProps {
  collectionGamesList: Accessor<Game[]>;
  collectionName: string;
  onCollectionRemove?: (name: string) => void;
}
