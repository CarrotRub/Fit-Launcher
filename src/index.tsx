/* @refresh reload */
import { render } from "solid-js/web";
import App from "./App";
import "./styles.css";

let savedTheme = localStorage.getItem("theme") || "default-dark-purple";

// Apply the saved theme to the document element
document.documentElement.setAttribute("data-theme", savedTheme);

render(() => <App />, document.getElementById("root")!);
