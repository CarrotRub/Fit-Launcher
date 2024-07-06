import { createSignal, createEffect, onCleanup } from 'solid-js';
import Gamehorizontalslide from '../Gamehorizontal-01/Gamehorizontal';
import { render } from 'solid-js/web'; 
import { invoke } from '@tauri-apps/api/tauri';
import './Slider.css'

const Slider = (props) => {
  const { containerClassName, imageContainerClassName, slides, filePath } = props;
  const [currentSlideIndex, setCurrentSlideIndex] = createSignal(0);
  const [lastSlideVisible, setLastSlideVisible] = createSignal(false);

  let scrollIntervalId;

  const handleNextSlide = () => {
    setCurrentSlideIndex((prevIndex) => {
      const nextIndex = prevIndex === slides.length - 1 ? prevIndex : prevIndex + 1;
      if (nextIndex === slides.length - 1) {
        clearInterval(scrollIntervalId);
      }
      return nextIndex;
    });
  };

  const handlePrevSlide = () => {
    setCurrentSlideIndex((prevIndex) => {
      const nextIndex = prevIndex === 0 ? 0 : prevIndex - 1;
      if (prevIndex === 0) {
        clearInterval(scrollIntervalId);
      }
      return nextIndex;
    });
  };

  const handleIntersection = (entries) => {
    entries.forEach((entry) => {
      setLastSlideVisible(entry.isIntersecting && entry.intersectionRatio === 1);
    });
  };

  createEffect(() => {
    const container = document.querySelector(`.${imageContainerClassName}`);
    if (container) {
      container.style.transition = 'transform 0.5s ease-in-out';

      // Retrieve slide image width
      const slideImage = container.querySelector('.slide img');

      // Slide to a direction by making calculations of how it will work.
      if (slideImage) {
        const slideImageWidth = slideImage.offsetWidth;
        const gapSize = parseFloat(window.getComputedStyle(container).gap) * 2;
        const totalSlideWidth = slideImageWidth * 2 + gapSize;
        container.style.transform = `translateX(-${currentSlideIndex() * totalSlideWidth}px)`;
      }

      // Not sure if it is the best way to do so.
      const observer = new IntersectionObserver(handleIntersection, {
        threshold: 1 // Trigger callback when the last slide is fully visible
      });
      const lastSlide = container.lastElementChild;
      if (lastSlide) {
        observer.observe(lastSlide);
      }

      // Cleanup function
      onCleanup(() => {
        clearInterval(scrollIntervalId);
        observer.disconnect();
      });
    }
  });

  const mainContentDiv = document.querySelector('.main-content')

  function resetHorizontalSlide(){
    const horSlide = document.querySelector('.horizontal-slide')
    if (horSlide) {
      try {
        horSlide.remove()
      } catch(error) {
        throw new Error(error);
      }
    }
  }


  return (
    <>
      <div className={containerClassName}>
        <div className={imageContainerClassName}>
          {slides.map((slide, index) => (
            <div class="slide" key={index}>
              <img
                src={slide.img}
                alt={slide.title}
                href-link={slide.href}
                file-path={filePath}
                onClick={() => {
                  invoke(`get_games_images`,{ gameLink: slide.href });
                  resetHorizontalSlide()
                  render(
                    
                    <Gamehorizontalslide
                      gameTitlePromise={slide.title}
                      filePathPromise={filePath}
                    />,
                    mainContentDiv
                  );

                }}
              />
            </div>
          ))}
        </div>
      </div>
      
      <div className='controls-buttons'>
        <button onClick={handlePrevSlide} class="scroll-button --prev" style={"background-color: transparent; border: none;"}>
          <svg height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g stroke-width="0"/>
            <g stroke-linecap="round" stroke-linejoin="round"/>
            <path d="m11 9-3 3m0 0 3 3m-3-3h8m5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button onClick={handleNextSlide} class="scroll-button --next" style={"background-color: transparent; border: none;"} disabled={lastSlideVisible()} >
          <svg height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path transform="translate(24, 0) scale(-1, 1)" d="m11 9-3 3m0 0 3 3m-3-3h8m5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </>
  );
};

export default Slider;
