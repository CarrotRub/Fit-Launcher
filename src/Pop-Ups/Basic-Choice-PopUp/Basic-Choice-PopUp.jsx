import { createSignal } from "solid-js";
import PopupModal from "../../components/Popup-Modal/PopupModal";
import "./Basic-Choice-PopUp.css";

const BasicChoicePopup = ({ infoTitle, infoMessage, infoFooter, action }) => {
    const [isOpen, setIsOpen] = createSignal(true);

    const closePopup = () => setIsOpen(false);

    return (
        <PopupModal isOpen={isOpen()} onClose={closePopup}>
            <div className="popup-content">
                <div className="popup-text-title">
                    <p className="popup-main-title">{infoTitle || "Please choose :)"}</p>
                </div>

                <div className="popup-text-container">
                    <p innerHTML={infoMessage}></p>
                </div>

                <div className="popup-footer-container">
                    {infoFooter ||
                        "If you have any issues with this, try to close and open the app. If it still persists, please contact us on Discord or GitHub."}
                </div>

                <div className="popup-buttons">
                    <button id="popup-cancel-button" onClick={closePopup}>
                        Cancel
                    </button>
                    <button
                        id="popup-confirm-button"
                        onClick={() => {
                            if (action) action();
                            closePopup();
                        }}
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </PopupModal>
    );
};

export default BasicChoicePopup;