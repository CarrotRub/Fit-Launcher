import { createSignal } from 'solid-js';
import './RefreshContent.css';

import {invoke} from '@tauri-apps/api/tauri';
import { message } from '@tauri-apps/api/dialog';

function RefreshContent() {
  const [isDialogOpen, setIsDialogOpen, isLoadingOpen, setIsLoadingOpen] = createSignal(false);

  function refreshContent() {
   setIsDialogOpen(false); // Close the cookies card when the "Yes" button is clicked

  // delete all content and fetch new content

    invoke ('delete_app_data').then((message) => console.log(message)).catch((error) => console.error(error));

  }

  function closeDialog() {
    setIsDialogOpen(false); // Close the cookies card when the exit button is clicked
  }

  function openDialog() {
    setIsDialogOpen(true);
    // Call refreshContent function when the "Yes" button is clicked
  }

  return (
    <div>
      <div className="refresh-content-container">
        <div className="refresh-content-main" onClick={openDialog}>
          <svg
            id="showRefreshContentIcon"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#000000"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M2.5 2v6h6M21.5 22v-6h-6" />
            <path d="M22 11.5A10 10 0 0 0 3.2 7.2M2 12.5a10 10 0 0 0 18.8 4.2" />
          </svg>
        </div>
      </div>

      {/* Conditionally render the cookies card based on isDialogOpen */}
      {isDialogOpen() && (
        <div class="cookies-card">
          <p class="cookie-heading">Refresh game content?</p>
          <p class="cookie-para">
            By refreshing the content, you will be able to see the latest games and updates. Do you want to proceed?
          </p>
          <div class="button-wrapper">
            <button class="accept cookie-button" onClick={refreshContent}>Yes</button>
            <button class="reject cookie-button" onClick={closeDialog}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default RefreshContent;
