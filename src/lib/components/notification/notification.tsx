import { createSignal, Show } from "solid-js";
import "./notification.css";

interface NotificationProps {
 message: string;
 type?: "info" | "warning";
 autoClose?: boolean;
 duration?: number;
}

export function Notification({
 message,
 type = "info",
 autoClose = true,
 duration = 900000,
}: NotificationProps) {
 const [isVisible, setIsVisible] = createSignal<boolean>(true); // Notification starts visible

 if (autoClose) {
  setTimeout(() => {
   setIsVisible(false);
  }, duration);
 }

 return (
  <Show when={isVisible()}>
   <div class={`notification ${type}`}>
    <div class="notification-content">
     <span>{message}</span>
    </div>
    <button class="notification-close" onclick={() => setIsVisible(false)}>
     &times;
    </button>
   </div>
  </Show>
 );
}
