import { createSignal } from "solid-js";
import PopupModal from "../../components/Popup-Modal/PopupModal";
import Button from "../../components/UI/Button/Button";

const BasicChoicePopup = (props: PopupProps) => {
    
    const [isOpen, setIsOpen] = createSignal(true);

    const closePopup = () => setIsOpen(false);

    return (
        <PopupModal isOpen={isOpen()} onClose={closePopup}>
            <div class="popup-content">
                <div class="popup-text-title">
                    <p class="popup-main-title">{props.infoTitle || "Please choose :)"}</p>
                </div>

                <div class="popup-text-container">
                    <p innerHTML={props.infoMessage}></p>
                </div>

                <div class="popup-footer-container">
                    {props.infoFooter ||
                        "If you have any issues with this, try to close and open the app. If it still persists, please contact us on Discord or GitHub."}
                </div>

                <div class="popup-buttons">
                    <Button id="popup-cancel-button" onClick={closePopup} label="Cancel" />
                    <Button
                        id="popup-confirm-button"
                        onClick={() => {
                            if (props.action) props.action();
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