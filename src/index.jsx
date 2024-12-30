/* @refresh reload */
import { render } from "solid-js/web";
import "./styles.css";
import App from "./App";

let savedTheme = localStorage.getItem("theme") || "default-dark-purple";

// Apply the saved theme to the document element
document.documentElement.setAttribute("data-theme", savedTheme);


render(() => <App />, document.getElementById("root"));