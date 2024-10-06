import { createSignal, Show } from "solid-js";
import './Notification.css';

function Notification(props) {
  const { message, type = "info", autoClose = true, autoCloseTime = 900000 } = props;
  const [isVisible, setIsVisible] = createSignal(true);  // Notification starts visible

  const closeNotification = () => {
    setIsVisible(false);  // Close notification manually
  };

  if (autoClose) {
    setTimeout(() => {
      setIsVisible(false);  // Auto-close after `autoCloseTime`
    }, autoCloseTime);
  }

  return (
    <Show when={isVisible()}>
      <div class={`notification ${type}`}>
        <div class="notification-content">
          <span>{message}</span>
        </div>
        <button class="notification-close" onClick={closeNotification}>
          &times;
        </button>
      </div>
    </Show>
  );
}

export default Notification;
