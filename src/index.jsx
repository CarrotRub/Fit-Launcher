/* @refresh reload */
import { render } from "solid-js/web";
import "./styles.css";
import App from "./App";
import { DM } from "./api/manager/api";
import { initI18n } from "./i18n";

let savedTheme = localStorage.getItem("theme") || "blue-cyan";

// Apply the saved theme to the document element
document.documentElement.setAttribute("data-theme", savedTheme);

await initI18n();
await DM.setup();

render(() => <App />, document.getElementById("root"));