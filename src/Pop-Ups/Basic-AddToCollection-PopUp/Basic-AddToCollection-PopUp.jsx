import { createSignal, onMount } from "solid-js";
import './Basic-AddToCollection-PopUp.css'
import '../Download-PopUp/Download-PopUp.css'

const BasicAddToCollectioPopup = ({ infoTitle, infoMessage, infoFooter, collectionList, action }) => {

    function closePopup() {
        const fullPopup = document.querySelector('.popup-addtocollection-overlay')

        if (fullPopup) {
            fullPopup.remove()
        }
    }

    onMount(() => {
        console.log(infoMessage)
    })
    return (
        <div className="popup-addtocollection-overlay">
            <div className="basic-addtocollection-popup">
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

export default BasicAddToCollectioPopup;