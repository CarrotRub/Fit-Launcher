import { AnswerComment } from "../../../../bindings"
import { GameCommentAvatar } from "./GameCommentAvatar"
import { GameCommentUser } from "./GameCommentUser";
import { GameCommentAttachments } from "./GameCommentAttachments";

interface Props {
    answerComment: AnswerComment | null
}

export const GameCommentReply = ({ answerComment }: Props) => {

    if (!answerComment || !answerComment.user) return null

    return (
        <div class='flex flex-row gap-5 mt-10'>
            <GameCommentAvatar user={answerComment.user} reply />
            <div class="flex flex-col flex-1">
                <GameCommentUser user={answerComment.user} />
                {answerComment.text_template && <div innerHTML={answerComment.text_template}></div>}
                <GameCommentAttachments attaches={answerComment.attaches} />
            </div>
        </div>
    )
}