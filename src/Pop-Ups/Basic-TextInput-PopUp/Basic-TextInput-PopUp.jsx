import { createSignal, onMount } from "solid-js";
import "../Download-PopUp/Download-PopUp.css";
import "./Basic-TextInput-PopUp.css";
const BasicTextInputPopup = ({
 infoTitle,
 infoMessage,
 infoPlaceholder,
 infoFooter,
 action,
}) => {
 const [textInputValue, setTextInputValue] = createSignal("");
 function closePopup() {
  const fullPopup = document.querySelector(".popup-textinput-overlay");

  if (fullPopup) {
   fullPopup.remove();
  }
 }

 onMount(() => {
  console.log(infoMessage);
 });
 return (
  <div class="popup-textinput-overlay">
   <div class="basic-textinput-popup">
    <div class="popup-content">
     <div class="popup-text-title">
      <p class="popup-main-title">
       {infoTitle ? infoTitle : "Fill the input :)"}
      </p>
     </div>

     <div class="popup-text-container">
      <p innerHTML={infoMessage}></p>
     </div>

     <div class="popup-path-input-container">
      <input
       class="popup-path-input"
       placeholder={infoPlaceholder}
       style={{ fontSize: "14px" }}
       value={textInputValue()}
       onchange={e => {
        setTextInputValue(e.target.value);
       }}
      />
     </div>

     <div class="popup-footer-container">
      {infoFooter
       ? infoFooter
       : "If you have any issues with this try to close and open the app, if it still persists, please contact us on Discord, link in the settings page or on github"}
     </div>
    </div>
    <div class="popup-buttons">
     <button id="popup-cancel-button" onclick={closePopup}>
      Cancel
     </button>
     <button
      id="popup-confirm-button"
      onclick={async () => {
       if (action != null) {
        await action(textInputValue());
       }
       closePopup();
      }}
     >
      Confirm
     </button>
    </div>
   </div>
  </div>
 );
};

export default BasicTextInputPopup;
