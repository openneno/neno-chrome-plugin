//弹窗和设置页共用的界面工具
import {DEFAULT_PREFS, getPrefs, watch} from "./store.js";

const darkQuery = matchMedia("(prefers-color-scheme: dark)");
const CACHE_KEY = "neno-prefs";
let current = DEFAULT_PREFS;

function apply(prefs) {
    current = {...DEFAULT_PREFS, ...prefs};
    const root = document.documentElement;
    root.dataset.accent = current.accent;
    root.classList.toggle("dark", current.theme === "dark" || (current.theme === "system" && darkQuery.matches));
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(current));
    } catch (e) {
        //忽略
    }
}

//先用上次缓存的设置同步应用主题, 避免打开弹窗时闪烁
export function initTheme() {
    try {
        apply(JSON.parse(localStorage.getItem(CACHE_KEY)) || DEFAULT_PREFS);
    } catch (e) {
        apply(DEFAULT_PREFS);
    }
    getPrefs().then(apply);
    watch("sync", "prefs", (prefs) => apply(prefs || {}));
    darkQuery.addEventListener("change", () => apply(current));
}

export function send(message) {
    return chrome.runtime.sendMessage(message);
}

export const isMac = /Mac/i.test(navigator.platform);

export function relativeTime(time) {
    const diff = Math.max(0, Date.now() - time);
    if (diff < 60e3) return "刚刚";
    if (diff < 3600e3) return `${Math.floor(diff / 60e3)} 分钟前`;
    if (diff < 86400e3) return `${Math.floor(diff / 3600e3)} 小时前`;
    const date = new Date(time);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function openTab(url) {
    chrome.tabs.create({url});
}

export function repoUrl(config) {
    return `https://github.com/${config.githubName}/${config.repoName}`;
}
