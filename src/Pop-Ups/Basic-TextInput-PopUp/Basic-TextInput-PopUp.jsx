import { createSignal, onMount } from "solid-js";
import './Basic-TextInput-PopUp.css'
import '../Download-PopUp/Download-PopUp.css'
const BasicTextInputPopup = ({infoTitle, infoMessage, infoPlaceholder, infoFooter, action}) => {
    const [textInputValue, setTextInputValue] = createSignal("")
    function closePopup() {
        const fullPopup = document.querySelector('.popup-textinput-overlay')

        if (fullPopup) {
            fullPopup.remove()
        }
    }

    onMount(() => {
        console.log(infoMessage)
    })
    return (
        <div className="popup-textinput-overlay">
            <div className="basic-textinput-popup">
                <div className="popup-content">
                    <div className="popup-text-title">
                        <p className="popup-main-title">{infoTitle ? infoTitle : 'Fill the input :)'}</p>
                    </div>

                    <div className="popup-text-container">
                        <p innerHTML={infoMessage}></p>
                    </div>

                    <div className="popup-path-input-container">
                        <input 
                            className="popup-path-input" 
                            placeholder= {infoPlaceholder} 
                            style={{ fontSize: '14px' }} 
                            value={textInputValue()}
                            onChange={(e) => {
                                setTextInputValue(e.target.value)
                            }} 
                        />
                    </div>

                    <div className="popup-footer-container">
                        {infoFooter ? infoFooter : 'If you have any issues with this try to close and open the app, if it still persists, please contact us on Discord, link in the settings page or on github'}
                    </div>
                </div>
                <div className="popup-buttons">
                    <button id="popup-cancel-button" onClick={closePopup}>Cancel</button>
                    <button id="popup-confirm-button" 
                        onClick={async() => {
                            if (action != null) {
                                await action(textInputValue())
                            }
                            closePopup()
                        }}
                    >Confirm</button>
                </div>
            </div>
        </div>

    );
};

export default BasicTextInputPopup;