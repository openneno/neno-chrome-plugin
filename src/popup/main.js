import {mount} from "svelte";
import "../lib/theme.css";
import {initTheme} from "../lib/ui.js";
import Popup from "./Popup.svelte";

initTheme();
mount(Popup, {target: document.getElementById("app")});
