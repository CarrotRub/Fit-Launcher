import { createMemo, Show } from 'solid-js';
import Slider from '../../../../components/Slider-01/Slider';
import { useGamehub } from '../../GamehubContext';

export default function NewlyAddedGames() {
  const { filteredNewlyAdded } = useGamehub();

  // Derive slider data from filtered games
  const sliderData = createMemo(() => ({
    images: filteredNewlyAdded().map(g => g.img),
    titles: filteredNewlyAdded().map(g => g.title),
    hrefs: filteredNewlyAdded().map(g => g.href),
  }));

  return (
    <div class="flex flex-col h-fit pb-4">
      <div class="text-2xl text-text font-bold text-center pl-3">
        <p>Newly Added Games</p>
      </div>
      <Show when={filteredNewlyAdded().length > 0}>
        <Slider
          images={sliderData().images}
          filePath=""
          titles={sliderData().titles}
          hrefs={sliderData().hrefs}
        />
      </Show>
    </div>
  );
}
