import { For } from "solid-js";
import { Attach } from "../../../../bindings"
import { ImageAttachment } from "./Attachments/ImageAttachment";
import { GiffyAttachment } from "./Attachments/GiffyAttachment";

interface Props {
    attach: Attach;
}

export const GameCommentAttachment = ({ attach }: Props) => {
    return (
        <For each={attach.data}>
            {(data) => {
                if (attach.type === "images") return <ImageAttachment attach={data} />
                if (attach.type === "giffy") return <GiffyAttachment attach={data} />
                // TODO: implement video type
                // if (attach.type === "video") return null
                // Rich Preview not shown since urls are part of the comment.text_template (clickable links)   
                // if (attach.type === "richpreview") return <span>Rich Preview</span>
                return null;
            }}
        </For>
    )
}