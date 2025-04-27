import { createSignal } from "solid-js";
import PopupModal from "../../components/Popup-Modal/PopupModal";
import "./Basic-TextInput-PopUp.css";
import Button from "../../components/UI/Button/Button";

const BasicTextInputPopup = ({ infoTitle, infoMessage, infoPlaceholder, infoFooter, action }) => {
    const [textInputValue, setTextInputValue] = createSignal("");
    const [isOpen, setIsOpen] = createSignal(true);

    const closePopup = () => setIsOpen(false);

    return (
        <PopupModal isOpen={isOpen} onClose={closePopup}>
            <div className="popup-content">
                <div className="popup-text-title">
                    <p className="popup-main-title">{infoTitle || "Fill the input :)"}</p>
                </div>

                <div className="popup-text-container">
                    <p innerHTML={infoMessage}></p>
                </div>

                <div className="popup-path-input-container">
                    <input
                        className="popup-path-input"
                        placeholder={infoPlaceholder}
                        style={{ fontSize: "14px" }}
                        value={textInputValue()}
                        onInput={(e) => setTextInputValue(e.target.value)}
                    />
                </div>

                <div className="popup-footer-container">
                    {infoFooter ||
                        "If you have any issues with this, try to close and open the app. If it still persists, please contact us on Discord or GitHub."}
                </div>

                <div className="popup-buttons">
                    <Button id="popup-cancel-button" onClick={closePopup} label="Cancel" />
                    <Button
                        id="popup-confirm-button"
                        onClick={async () => {
                            if (action) {
                                await action(textInputValue());
                            }
                            closePopup();
                        }}
                        label="Confirm"
                    />
                </div>
            </div>
        </PopupModal>
    );
};

export default BasicTextInputPopup;