

/**
 * Function to add a scroll effect to a target container.
 * 
 * @param {HTMLCollectionOf<Element>} selectedLeftButton - Element containing the left button that will be used.
 * @param {HTMLCollectionOf<Element>} selectedRightButton - Element containing the right button that will be used.
 * @param {HTMLCollectionOf<Element>} targetContainer - Element containing the targeted container that will be used.
 */
function scrollEffect(selectedLeftButton, selectedRightButton, targetContainer) {
    const container = targetContainer;

    // Check if the buttons are selected before adding event listeners
    if (selectedLeftButton && selectedRightButton) {
        selectedRightButton.addEventListener("click", function () {
            container.scrollLeft += 150;
        });

        selectedLeftButton.addEventListener("click", function () {
            container.scrollLeft -= 150; // Adjusted for left scrolling
        });
    } else {
        console.error("Error: Left or right button not found.");
    }
}
export default scrollEffect;