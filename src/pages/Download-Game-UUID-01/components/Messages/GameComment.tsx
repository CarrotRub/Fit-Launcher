import { Comment, User } from '../../../../bindings'
import { For, Show } from 'solid-js';
import { GameCommentAvatar } from './GameCommentAvatar';
import { GameCommentReply } from './GameCommentReply';
import { BadgeCheckIcon } from 'lucide-solid';

interface Props {
  comment: Comment
}

// TODO: Generate type in rust
interface Attach {
  data: {
    height: number,
    src: string,
    src_o: string,
    type: string,
    width: 600

  }[],
  type: string
}

// TODO: Generate type in rust
interface Rating {
  id: number;
  val: number;
  user_val: number;
}

// TODO: Generate type in rust
interface AnswerComment {
  answer_comment_root_id: number;
  attaches: any[];
  attaches_icons: number[];
  attaches_text: string;
  comment_type: number;
  data_create: string;
  edited: boolean;
  fixed: boolean;
  id: number;
  raiting: Rating;
  sort: number;
  text_template: string;
  user: User;
}

export const GameComment = ({ comment }: Props) => {
  const user = comment.user;
  // TODO: Hack for now, generate type in rust
  const answerComment = comment.answer_comment as AnswerComment | undefined | null;

  return (
    <div class="flex flex-row gap-5">
      <div class='relative'>
        {comment.answer_comment_count > 0 && <div class='absolute top-16 left-1/2 h-[calc(100%-50%)] bg-secondary/30 w-1'></div>}
        <GameCommentAvatar user={user} />
      </div>
      <div class="flex flex-col flex-1 ">
        <div class='flex flex-row items-center gap-2'>
          <span class="font-bold text-md">{user.name}</span>
          {user.admin && <BadgeCheckIcon class={`fill-blue-500 w-4 h-4`} />}
        </div>
        <div innerHTML={comment.text_template}></div>
        <Show when={comment.attaches && comment.attaches.length > 0}>
          <For each={comment.attaches}>
            {(attach) => {
              // @ts-ignore TODO: Genereate type in rust
              const a = attach as Attach;
              return <div>
                <Show when={a.type === "images"}>
                  <div class='grid grid-cols-2 grid-flow-row gap-x-5 gap-y-0'>
                    <For each={a.data}>
                      {(image) => <img src={image.src} class="max-w-full h-auto mt-4 rounded-md" />}
                    </For>
                  </div>
                </Show>
              </div>
            }}
          </For>
        </Show>
        <Show when={answerComment}>
          <GameCommentReply text_template={answerComment?.text_template} user={answerComment?.user} />
        </Show>
      </div>
    </div>
  )
} 