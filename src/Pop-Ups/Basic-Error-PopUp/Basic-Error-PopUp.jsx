import { createSignal } from "solid-js";
import './Basic-Error-PopUp.css'

const BasicErrorPopup = ({errorTitle, errorMessage, errorFooter}) => {

    function closePopup() {
        const fullPopup = document.querySelector('.popup-error-overlay')

        if (fullPopup) {
            fullPopup.remove()
        }
    }
    return (
        <div className="popup-error-overlay">
            <div className="basic-error-popup">
                <div className="popup-content">
                    <div className="popup-text-title">
                        <p className="popup-main-title">{errorTitle ? errorTitle : 'AN ERROR HAPPENED'}</p>
                    </div>

                    <div className="popup-text-container">
                        <p>
                            {errorMessage}
                        </p>
                    </div>

                    <div className="popup-footer-container">
                        {errorFooter ? errorFooter : 'If you have any issues with this try to close and open the app, if it still persists, please contact us on Discord, link in the settings page or on github'}
                    </div>
                </div>
                <div className="popup-buttons">
                    <button id="popup-cancel-button" onClick={closePopup}>Cancel</button>
                    <button id="popup-confirm-button" onClick={closePopup}>Okay</button>
                </div>
            </div>
        </div>

    );
};

export default BasicErrorPopup;