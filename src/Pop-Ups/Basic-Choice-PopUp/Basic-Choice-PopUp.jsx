import { createSignal } from "solid-js";
import PopupModal from "../../components/Popup-Modal/PopupModal";
import Button from "../../components/UI/Button/Button";

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
                    <Button id="popup-cancel-button" onClick={closePopup} label="Cancel" />
                    <Button
                        id="popup-confirm-button"
                        onClick={() => {
                            if (action) action();
                            closePopup();
                        }}
                        label="Confirm"
                    />
                </div>
            </div>
        </PopupModal>
    );
};

export default BasicChoicePopup;