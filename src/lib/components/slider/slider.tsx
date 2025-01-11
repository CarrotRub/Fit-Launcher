import { setDownloadGamePageInfo } from "@/store/global.store";
import ArrowLeft from "lucide-solid/icons/arrow-left";
import { createEffect, createSignal, For } from "solid-js";
import "./slider.css";

interface SliderProps {
 filePath: string;
 images?: string[];
 titles?: string[];
 hrefs?: string[];
}

export function Slider({
 filePath,
 images = [],
 titles = [],
 hrefs = [],
}: SliderProps) {
 const [clicked, setClicked] = createSignal<boolean>(false);
 const [currentIndex, setCurrentIndex] = createSignal<number>(0);

 // Generate a unique ID for each slider instance.
 const sliderId = `slider-${crypto.randomUUID()}`;

 function goPrevious() {
  setCurrentIndex(prevIndex => Math.max(prevIndex - 1, 0));
 }

 function goNext() {
  setCurrentIndex(prevIndex => Math.min(prevIndex + 1, images.length - 1));
 }

 createEffect(() => {
  // FIXME: Use states
  const container: HTMLElement = document.querySelector(
   `#${sliderId} .slider-container`,
  )!;
  const linearGradientContainer: HTMLElement = document.querySelector(
   `#${sliderId} .image-slider-gradient`,
  )!;
  const skipperRight: HTMLElement = document.querySelector(
   `#${sliderId} .skipper.right`,
  )!;

  let distance = 375 * 0.5; // This is the width of the image container calc(375px * 0.5);
  const offset = -currentIndex() * distance;
  let containerWidth;
  if (container) {
   containerWidth = container.offsetWidth;
  }

  let screenWidth = screen.width;
  let traveledOffset = 0;

  if (currentIndex() > 0 && linearGradientContainer != null) {
   linearGradientContainer.style.webkitMaskImage = `linear-gradient(to right, var(--background-color) 0%, transparent 30%, transparent 70%, var(--background-color) 100%)`;
   linearGradientContainer.style.maskImage = `linear-gradient(to right, var(--background-color) 0%, transparent 30%, transparent 70%, var(--background-color) 100%)`;
  } else if (currentIndex() === 0 && linearGradientContainer != null) {
   linearGradientContainer.style.webkitMaskImage = `linear-gradient(to right, transparent 70%, var(--background-color) 100%)`;
   linearGradientContainer.style.maskImage = `linear-gradient(to right, transparent 70%, var(--background-color) 100%)`;
  }

  if (container) {
   container.style.transform = `translateX(${offset}px)`;
   traveledOffset += offset;
   let visibleWidthContainer = Math.abs(traveledOffset) + screenWidth;

   if (
    visibleWidthContainer >= containerWidth! &&
    linearGradientContainer != null
   ) {
    skipperRight.style.display = "none";
    linearGradientContainer.style.webkitMaskImage = `linear-gradient(to left, transparent 70%, var(--background-color) 100%)`;
    linearGradientContainer.style.maskImage = `linear-gradient(to left, transparent 70%, var(--background-color) 100%)`;
   } else if (visibleWidthContainer < containerWidth!) {
    if (skipperRight.style.display === "none") {
     skipperRight.style.display = "flex";
    }
   }
  }
 });

 return (
  <div id={sliderId} class="slider-wrapper">
   <div class="skipper-slider-container">
    <div
     class={`skipper left ${currentIndex() === 0 ? "hidden" : ""}`}
     onclick={goPrevious}
    >
     <ArrowLeft />
    </div>
    <div
     class="skipper right"
     classList={{ hidden: currentIndex() == images.length - 1 }}
     onclick={goNext}
    >
     {/* Right Arrow SVG */}
     <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
     >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8m-4 4 4-4-4-4" />
     </svg>
    </div>
   </div>
   <div class="image-slider-gradient" />
   <div class="slider-container">
    <For each={images} fallback={<p>No images to display</p>}>
     {(image, index) => (
      <div
       class="slider-image-container"
       onclick={() => {
        if (!clicked()) {
         setClicked(true);
         const uuid = crypto.randomUUID();
         setDownloadGamePageInfo({
          gameTitle: titles[index()],
          gameHref: hrefs[index()],
          filePath,
         });
         window.location.href = `/game/${uuid}`;
        }
       }}
      >
       <img
        src={image}
        alt={Array.isArray(titles) ? titles[index()] : titles}
        data-filepath={filePath}
        style={{
         width: "100%",
         height: "100%",
         cursor: "pointer",
         "object-fit": "cover",
        }}
       />
      </div>
     )}
    </For>
   </div>
  </div>
 );
}
