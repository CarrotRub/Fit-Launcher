import { createSignal, createEffect, onCleanup, Show, For, createMemo, type JSX } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { commands } from '../../../../bindings';
import { ChevronLeft, ChevronRight, Star, HardDrive, Languages, Building2, ArrowRight } from 'lucide-solid';
import LoadingPage from '../../../LoadingPage-01/LoadingPage';
import { useGamehub } from '../../GamehubContext';
import LazyImage from '../../../../components/LazyImage/LazyImage';
import { extractCompany, extractLanguage, parseGameSize, formatBytesToSize } from '../../../../helpers/gameFilters';

export default function PopularGames() {
  const { popular, loading } = useGamehub();
  const [selected, setSelected] = createSignal(0);
  const [isHovered, setIsHovered] = createSignal(false);
  const navigate = useNavigate();

  // Auto-cycle through games
  createEffect(() => {
    if (popular().length === 0) return;
    const interval = setInterval(() => {
      if (!isHovered()) setSelected(i => (i + 1) % popular().length);
    }, 10000);
    onCleanup(() => clearInterval(interval));
  });

  const current = createMemo(() => popular()[selected()]);

  const details = createMemo(() => {
    const desc = current()?.details;
    if (!desc) return { tags: 'N/A', companies: 'N/A', language: 'N/A', repackSize: 'N/A' };
    const tagsMatch = desc.match(/Genres\/Tags:\s*([^\n]+)/);
    const repackBytes = parseGameSize(desc, 'repack');
    return {
      tags: tagsMatch?.[1]?.trim() ?? 'N/A',
      companies: extractCompany(desc),
      language: extractLanguage(desc),
      repackSize: repackBytes > 0 ? formatBytesToSize(repackBytes) : 'N/A'
    };
  });

  const displayTitle = createMemo(() =>
    current()?.title
      ?.replace(/(?: - |, | )?(Digital Deluxe|Ultimate Edition|Deluxe Edition)\s*[:\-]?.*|(?: - |, ).*/, '')
      .replace(/\s*[:\-]\s*$/, '')
      .replace(/\(.*?\)/g, '')
      .replace(/[\–].*$/, '') || current()?.title || ''
  );

  const handleGameClick = async () => {
    const game = current();
    if (!game) return;
    const uuid = await commands.hashUrl(game.href);
    navigate(`/game/${uuid}`, { state: { gameHref: game.href, gameTitle: game.title } });
  };

  const prev = () => setSelected(i => (i - 1 + popular().length) % popular().length);
  const next = () => setSelected(i => (i + 1) % popular().length);

  return (
    <div class="relative w-full" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <Show when={loading()}><LoadingPage /></Show>

      <Show when={!loading() && popular().length > 0}>
        <div class="relative h-120 overflow-hidden border-b border-secondary-20 bg-background-70 shadow-lg flex w-full">
          {/* Background */}
          <div class="absolute inset-0 overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-b from-background/70 to-background/30 z-10" />
            <div class="absolute inset-0 bg-secondary-20/50 backdrop-blur-sm" />
            <LazyImage src={current()?.img} class="absolute inset-0 w-full h-full opacity-80" style={{ filter: 'blur(8px)' }} />
          </div>

          {/* Content */}
          <div class="relative z-10 h-full flex items-center justify-center p-6 w-full mx-4 gap-4">
            <NavButton onClick={prev}><ChevronLeft size={20} /></NavButton>

            <div class="w-full max-w-4xl max-h-[650px] gap-8 flex flex-col justify-between bg-background/90 backdrop-blur-sm rounded-xl p-6 border border-secondary-20/50 shadow-xl">
              {/* Title */}
              <div class="mb-4">
                <h2 class="text-3xl font-bold text-text leading-tight">{displayTitle()}</h2>
                <p class="text-muted text-sm">{current()?.title}</p>
              </div>

              {/* Details Grid */}
              <div class="grid grid-cols-2 gap-4">
                <DetailItem icon={<Star size={18} />} label="Genre/Tags" value={details().tags} />
                <DetailItem icon={<Building2 size={18} />} label="Companies" value={details().companies} />
                <DetailItem icon={<Languages size={18} />} label="Languages" value={details().language} />
                <DetailItem icon={<HardDrive size={18} />} label="Repack Size" value={details().repackSize} />
              </div>

              {/* View Button */}
              <button onClick={handleGameClick} class="w-full flex items-center justify-center gap-2 px-6 py-3 bg-accent hover:bg-accent/90 text-text font-medium rounded-lg transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-accent/30">
                View Game Details
                <ArrowRight size={18} />
              </button>
            </div>

            <NavButton onClick={next}><ChevronRight size={24} /></NavButton>
          </div>

          {/* Pagination Dots */}
          <Show when={popular().length > 1}>
            <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
              <For each={popular()}>
                {(_, i) => (
                  <button
                    onClick={() => setSelected(i())}
                    class={`w-3 h-3 rounded-full transition-all duration-300 ${selected() === i() ? 'bg-accent w-6 scale-125 shadow-sm shadow-accent/50' : 'bg-secondary-20 hover:bg-accent/50'}`}
                  />
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

// Helper components
const NavButton = (props: { onClick: () => void; children: JSX.Element }) => (
  <button
    onClick={(e) => { e.stopPropagation(); props.onClick(); }}
    class="w-10 h-10 flex items-center justify-center z-20 rounded-full bg-background/90 backdrop-blur-md border border-secondary-20 shadow-lg hover:bg-accent/20 transition-all duration-300 hover:scale-110 active:scale-95"
  >
    <span class="text-text">{props.children}</span>
  </button>
);

const DetailItem = (props: { icon: JSX.Element; label: string; value: string }) => (
  <div class="flex items-start gap-3">
    <div class="p-2 bg-accent/10 rounded-lg text-accent">{props.icon}</div>
    <div>
      <p class="text-xs text-muted uppercase tracking-wider">{props.label}</p>
      <p class="text-text font-medium line-clamp-2">{props.value}</p>
    </div>
  </div>
);