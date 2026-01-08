import { BadgeCheckIcon } from "lucide-solid"
import { User } from "../../../../bindings"
import { GameCommentAvatar } from "./GameCommentAvatar"

interface Props {
  user?: User,
  text_template?: string
}

// TODO: Hack for now
export const GameCommentReply = ({ user, text_template }: Props) => {
  if (!user || !user.name || !text_template) return null
  return (
    <div class='flex flex-row gap-5 mt-10'>
      <GameCommentAvatar user={user} reply />
      <div>
        <div class="flex flex-row gap-2 items-center">
          <span class="font-bold text-md">{user.name}</span>
          {user.admin && <BadgeCheckIcon class={`fill-blue-500 w-4 h-4`} />}
        </div>
        <div innerHTML={text_template}></div>
      </div>
    </div>
  )
}