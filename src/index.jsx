/* @refresh reload */
import { render } from "solid-js/web";
import { Route, Router } from "@solidjs/router";
import "./styles.css";
import App from "./App";
const Mylibrary = lazy(() => import("./templates/mylibrary-01/Mylibrary"))
import { lazy } from "solid-js";

render(() => ( 
    <Router root={App}>
        <Route path="/mylibrary" component={Mylibrary} />
    </Router>
    ), document.getElementById("root"));