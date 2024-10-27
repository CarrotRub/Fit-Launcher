/* @refresh reload */
import { render } from "solid-js/web";
import "./styles.css";
import App from "./App";

// TODO: Add file checking from settings.toml to check the data-theme used.
document.documentElement.setAttribute('data-theme', 'default-dark-purple');

render(() => <App />, document.getElementById("root"));