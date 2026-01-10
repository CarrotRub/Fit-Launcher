import { Comment } from '../../../../bindings'
import { Show } from 'solid-js';
import { GameCommentAvatar } from './GameCommentAvatar';
import { GameCommentReply } from './GameCommentReply';
import { GameCommentUser } from './GameCommentUser';
import { GameCommentAttachments } from './GameCommentAttachments';

interface Props {
    comment: Comment
}

export const GameComment = ({ comment }: Props) => {

    if (!comment.user) return null

    const user = comment.user;
    const answerComment = comment.answer_comment

    return (
        <div class="flex flex-row gap-5">
            <div class='relative'>
                {comment.answer_comment_count > 0 && <div class='absolute top-16 left-1/2 h-[calc(100%-50%)] bg-secondary/30 w-1'></div>}
                <GameCommentAvatar user={user} />
            </div>
            <div class="flex flex-col flex-1 ">
                <GameCommentUser user={user} />
                {comment.text_template && <div class='[&_a]:text-blue-400' innerHTML={comment.text_template}></div>}
                <GameCommentAttachments attaches={comment.attaches} />
                <Show when={answerComment}>
                    <GameCommentReply answerComment={answerComment} />
                </Show>
            </div>
        </div>
    )
} 