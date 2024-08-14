import { createSignal, createEffect, onCleanup } from 'solid-js';
import Gamehorizontalslide from '../Gamehorizontal-01/Gamehorizontal';
import { render } from 'solid-js/web';
import { invoke } from '@tauri-apps/api/tauri';
import './Slider.css';

const Slider = (props) => {
  const { containerClassName, imageContainerClassName, slides, filePath } = props;
  const [currentSlideIndex, setCurrentSlideIndex] = createSignal(0);
  const [lastSlideVisible, setLastSlideVisible] = createSignal(false);
  const [hoveredTitle, setHoveredTitle] = createSignal('');
  const [mousePosition, setMousePosition] = createSignal({ y: 0 });

  let scrollIntervalId;

  console.log("Rendering Slider Component");

  function cutTheDescription(description) {
    if (!description) {
      return { repackDescription: 'Description not available', officialDescription: 'Description not available' };
    }

    const repackIndex = description.indexOf('Repack Features');
    const gameDescriptionIndex = description.indexOf('\nGame Description\n');

    if (repackIndex !== -1 && gameDescriptionIndex !== -1) {
      const repackDescription = description.substring(repackIndex, gameDescriptionIndex).trim();
      const officialDescription = description.substring(gameDescriptionIndex + '\nGame Description\n'.length).trim();
      return { repackDescription, officialDescription };
    } else {
      return { repackDescription: description.trim(), officialDescription: '' };
    }
  }

  function extractDetails(description) {
    if (!description) return {
      'Genre/Tags:': 'N/A',
      Companies: 'N/A',
      Language: 'N/A',
      OriginalSize: 'N/A',
      RepackSize: 'N/A',
    };

    let genresTagsMatch = description.match(/Genres\/Tags:\s*([^\n]+)/);
    let companiesMatch = description.match(/Company:\s*([^\n]+)/);
    if (companiesMatch === null) {
      companiesMatch = description.match(/Companies:\s*([^\n]+)/);
    }
    const languageMatch = description.match(/Languages:\s*([^\n]+)/);
    const originalSizeMatch = description.match(/Original Size:\s*([^\n]+)/);
    const repackSizeMatch = description.match(/Repack Size:\s*([^\n]+)/);

    return {
      'Genre/Tags:': genresTagsMatch ? genresTagsMatch[1].trim() : 'N/A',
      Companies: companiesMatch ? companiesMatch[1].trim() : 'N/A',
      Language: languageMatch ? languageMatch[1].trim() : 'N/A',
      OriginalSize: originalSizeMatch ? originalSizeMatch[1].trim() : 'N/A',
      RepackSize: repackSizeMatch ? repackSizeMatch[1].trim() : 'N/A',
    };
  }

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

      const slideImage = container.querySelector('.slide img');
      if (slideImage) {
        const slideImageWidth = slideImage.offsetWidth;
        const gapSize = parseFloat(window.getComputedStyle(container).gap) * 2;
        const totalSlideWidth = slideImageWidth * 2 + gapSize;
        container.style.transform = `translateX(-${currentSlideIndex() * totalSlideWidth}px)`;
      }

      const observer = new IntersectionObserver(handleIntersection, {
        threshold: 1
      });
      const lastSlide = container.lastElementChild;
      if (lastSlide) {
        observer.observe(lastSlide);
      }

      onCleanup(() => {
        clearInterval(scrollIntervalId);
        observer.disconnect();
      });
    }
  });

  const mainContentDiv = document.querySelector('.main-content');

  function resetHorizontalSlide() {
    const horSlide = document.querySelector('.horizontal-slide');
    if (horSlide) {
      try {
        horSlide.remove();
      } catch (error) {
        console.error(error);
      }
    }
  }

  const handleMouseMove = (event) => {
    setMousePosition({ y: event.clientY });
  };

  return (
    <>
      <div className={containerClassName}>
        <div className={imageContainerClassName}>
          {slides.map((slide, index) => {
            // If no description, skip processing
            const { repackDescription, officialDescription } = slide.desc
              ? cutTheDescription(slide.desc)
              : { repackDescription: 'Description not available', officialDescription: '' };

            const details = slide.desc
              ? extractDetails(slide.desc)
              : {
                'Genre/Tags:': 'N/A',
                Companies: 'N/A',
                Language: 'N/A',
                OriginalSize: 'N/A',
                RepackSize: 'N/A',
              };

            return (
              <div class="slide" key={index} style={{ position: 'relative' }}>
                <img
                  src={slide.img}
                  alt={slide.title}
                  href-link={slide.href}
                  file-path={filePath}
                  onClick={() => {
                    invoke(`get_games_images`, { gameLink: slide.href });
                    resetHorizontalSlide();
                    render(
                      <Gamehorizontalslide
                        gameTitlePromise={slide.title}
                        filePathPromise={filePath}
                        gameLinkPromise={slide.href}
                      />,
                      mainContentDiv
                    );
                  }}
                  onMouseEnter={() => setHoveredTitle(slide.title)}
                  onMouseLeave={() => setHoveredTitle('')}
                  onMouseMove={handleMouseMove}
                />
                {hoveredTitle() === slide.title && (
                  <div
                    class="hover-title"
                  >
                    <div class="title">{slide.title}</div>
                    <div class="detail"><strong>Genres/Tags:</strong> {details['Genre/Tags:']}</div>
                    <div class="detail"><strong>Company:</strong> {details.Companies}</div>
                    <div class="detail"><strong>Language:</strong> {details.Language}</div>
                    <div class="detail"><strong>Original Size:</strong> {details.OriginalSize}</div>
                    <div class="detail"><strong>Repack Size:</strong> {details.RepackSize}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="controls-buttons">
        <button onClick={handlePrevSlide} class="scroll-button --prev" style="background-color: transparent; border: none;">
          <svg height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="m11 9-3 3m0 0 3 3m-3-3h8m5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <button onClick={handleNextSlide} class="scroll-button --next" style="background-color: transparent; border: none;" disabled={lastSlideVisible()}>
          <svg height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path transform="translate(24, 0) scale(-1, 1)" d="m11 9-3 3m0 0 3 3m-3-3h8m5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
    </>
  );
};

export default Slider;