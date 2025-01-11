import { onMount } from "solid-js";
import "../Download-PopUp/Download-PopUp.css";
import "./Basic-Choice-PopUp.css";

const BasicChoicePopup = ({ infoTitle, infoMessage, infoFooter, action }) => {
 function closePopup() {
  const popup = document.querySelector(".popup-choice-overlay");
  if (popup) {
   popup.classList.remove("show");
   setTimeout(() => {
    popup.remove();
   }, 300); // Matches transition duration
  }
 }

 onMount(() => {
  const popup = document.querySelector(".popup-choice-overlay");
  if (popup) {
   setTimeout(() => {
    popup.classList.add("show");
   }, 10); // Small delay to trigger transition
  }
 });

 return (
  <div class="popup-choice-overlay">
   <div class="basic-choice-popup">
    <div class="popup-content">
     <div class="popup-text-title">
      <p class="popup-main-title">
       {infoTitle ? infoTitle : "Please choose :)"}
      </p>
     </div>

     <div class="popup-text-container">
      <p innerHTML={infoMessage}></p>
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
      onclick={() => {
       if (action != null) {
        action();
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

export default BasicChoicePopup;
