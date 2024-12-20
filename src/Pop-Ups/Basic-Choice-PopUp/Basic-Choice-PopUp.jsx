import { createSignal, onMount } from "solid-js";
import './Basic-Choice-PopUp.css'
import '../Download-PopUp/Download-PopUp.css'

const BasicChoicePopup = ({ infoTitle, infoMessage, infoFooter, action }) => {

    function closePopup() {
        const popup = document.querySelector('.popup-choice-overlay');
        if (popup) {
            popup.classList.remove('show');
            setTimeout(() => {
                popup.remove();
            }, 300); // Matches transition duration
        }
    }

    onMount(() => {
        const popup = document.querySelector('.popup-choice-overlay');
        if (popup) {
            setTimeout(() => {
                popup.classList.add('show');
            }, 10); // Small delay to trigger transition
        }
    });

    return (
        <div className="popup-choice-overlay">
            <div className="basic-choice-popup">
                <div className="popup-content">
                    <div className="popup-text-title">
                        <p className="popup-main-title">{infoTitle ? infoTitle : 'Please choose :)'}</p>
                    </div>

                    <div className="popup-text-container">
                        <p innerHTML={infoMessage}></p>
                    </div>

                    <div className="popup-footer-container">
                        {infoFooter ? infoFooter : 'If you have any issues with this try to close and open the app, if it still persists, please contact us on Discord, link in the settings page or on github'}
                    </div>
                </div>
                <div className="popup-buttons">
                    <button id="popup-cancel-button" onClick={closePopup}>Cancel</button>
                    <button id="popup-confirm-button" onClick={() => {
                        if (action != null) {
                            action()
                        }
                        closePopup()
                    }}>Confirm</button>
                </div>
            </div>
        </div>

    );
};

export default BasicChoicePopup;