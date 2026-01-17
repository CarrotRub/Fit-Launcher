
import { createResource, For, Show } from "solid-js";
import { InfoContainer } from "../components/InfoContainer"
import { commands, Comments } from "../../../bindings";
import { GameComment } from "../components/Messages/GameComment";

interface Props {
  title: string;
  gameHref: string;
}

export const CommentsSection = (props: Props) => {

  const fetchComments = async (url: string): Promise<Comments> => {

    const result = await commands.getGameComments(url);

    if (result.status === "error") {
      throw new Error(result.error);
    }

    return result.data;
  };

  const [comments] = createResource(() => props.gameHref, fetchComments);

  return (
    <div class="flex gap-2 mb-4 border-b items-center transition-all duration-300 border-secondary-20/40 w-full">
      <InfoContainer class="w-full">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-1.5 h-6 bg-linear-to-b from-accent to-primary rounded-full"></div>
          <h2 class="text-xl font-bold bg-linear-to-r from-text to-accent bg-clip-text text-transparent">User Comments</h2>
        </div>
        <Show when={comments()} fallback={<div>
          <span class="text-sm text-secondary-400">No comments available.</span>
        </div>}>
          <section class="flex flex-col gap-10 max-h-200 overflow-y-auto custom-scrollbar">
            <For each={comments()!.data.comments}>
              {(comment) => <GameComment comment={comment} />}
            </For>
          </section>
        </Show>
      </InfoContainer>
    </div>
  )
}