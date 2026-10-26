import {mount} from "svelte";
import "../lib/theme.css";
import {initTheme} from "../lib/ui.js";
import Options from "./Options.svelte";

initTheme();
mount(Options, {target: document.getElementById("app")});
