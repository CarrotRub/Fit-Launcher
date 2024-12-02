import { createSignal, onMount } from "solid-js";
import './Basic-Choice-PopUp.css'

const BasicChoicePopup = ({infoTitle, infoMessage, infoFooter, action}) => {

    function closePopup() {
        const fullPopup = document.querySelector('.popup-choice-overlay')

        if (fullPopup) {
            fullPopup.remove()
        }
    }

    onMount(() => {
        console.log(infoMessage)
    })
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