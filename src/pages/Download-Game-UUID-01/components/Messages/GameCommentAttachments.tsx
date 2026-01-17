import { For, Show } from "solid-js";
import { Attach } from "../../../../bindings"
import { GameCommentAttachment } from "./GameCommentAttachment";

interface Props {
    attaches: Attach[] | [] | null | undefined;
}

export const GameCommentAttachments = ({ attaches }: Props) => {
    return (
        <Show when={attaches && attaches.length > 0}>
            <div class='grid grid-cols-2 grid-flow-row gap-x-5 gap-y-0'>
                <For each={attaches}>
                    {(attach) => {
                        return <GameCommentAttachment attach={attach} />
                    }}
                </For>
            </div>
        </Show>
    )
}