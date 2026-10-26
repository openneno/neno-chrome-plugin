//后台: 右键菜单, 快捷键, 保存队列(离线时排队, 联网后自动重试), 撤销与补充想法
import {deleteFile, describeError, isRetryable, putFile} from "./lib/github.js";
import {buildNote, formatTime, hostOf, isEmptyCapture, isWebUrl, notePath, objectId, serializeNote, summaryOf} from "./lib/note.js";
import {accentHex, getConfig, getLocal, getPrefs, rememberTags, setLocal} from "./lib/store.js";
import {nenoToast, readSelection} from "./lib/toast.js";

const KEEP_SAVED = 30;
const RETRY_ALARM = "neno-retry";

/* ---------- 右键菜单 ---------- */

function setupMenus() {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({id: "save-selection", title: "保存选中的文字到 neno", contexts: ["selection"]});
        chrome.contextMenus.create({id: "save-link", title: "保存这个链接到 neno", contexts: ["link"]});
        chrome.contextMenus.create({id: "save-page", title: "保存这个页面到 neno", contexts: ["page"]});
    });
}

chrome.runtime.onInstalled.addListener(async ({reason}) => {
    setupMenus();
    //第一次安装时打开设置页完成连接
    if (reason === "install" && !(await getConfig())) chrome.runtime.openOptionsPage();
});
chrome.runtime.onStartup.addListener(() => {
    setupMenus();
    processQueue();
});

//链接没有标题, 用 域名/路径 代替
function linkTitle(url) {
    try {
        const u = new URL(url);
        const path = decodeURIComponent(u.pathname).replace(/\/$/, "");
        return hostOf(url) + (path.length > 40 ? `${path.substring(0, 40)}…` : path);
    } catch (e) {
        return url;
    }
}

//读取选中文字: 优先在页面中读取以保留换行, 读取失败时使用菜单提供的文字
async function selectionIn(tab, fallback) {
    try {
        const results = await chrome.scripting.executeScript({target: {tabId: tab.id, allFrames: true}, func: readSelection});
        const hit = results.map((r) => r.result).find((r) => r && r.text && r.text.trim());
        if (hit) return hit.text;
    } catch (e) {
        //chrome:// 等页面无法注入
    }
    return fallback || "";
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const page = {url: info.pageUrl || (tab && tab.url) || "", title: (tab && tab.title) || ""};
    let capture;
    if (info.menuItemId === "save-selection") {
        capture = {quote: tab ? await selectionIn(tab, info.selectionText) : info.selectionText, source: page};
    } else if (info.menuItemId === "save-link") {
        capture = {source: {url: info.linkUrl, title: (info.selectionText || "").trim() || linkTitle(info.linkUrl)}};
    } else {
        capture = {source: page};
    }
    await saveFromPage(capture, tab);
});

chrome.commands.onCommand.addListener(async (command, tab) => {
    if (command !== "save-selection" || !tab) return;
    const quote = await selectionIn(tab, "");
    await saveFromPage({quote, source: {url: tab.url, title: tab.title}}, tab);
});

//端到端测试使用, 正式构建中会被移除
if (import.meta.env.MODE === "test") globalThis.__nenoTest = {saveFromPage: (capture, tab) => saveFromPage(capture, tab)};

async function saveFromPage(capture, tab) {
    if (!(await getConfig())) {
        chrome.runtime.openOptionsPage();
        return;
    }
    if (isEmptyCapture(capture)) {
        notify("没有可以保存的内容", "这个页面不是网页, 请选中文字后再试");
        return;
    }
    const entry = await enqueue(capture);
    if (tab && tab.id !== undefined) toastTabs.set(entry.id, tab.id);
    await showToast(entry);
    processQueue();
}

/* ---------- 网页中的提示 ---------- */

//记录每条笔记的提示显示在哪个标签页, 保存状态变化时更新提示
const toastTabs = new Map();

async function showToast(entry, extra = {}) {
    const tabId = toastTabs.get(entry.id);
    const prefs = await getPrefs();
    const failed = entry.status === "failed";
    const state = {
        id: entry.id,
        status: entry.status === "pending" || entry.status === "saving" ? "saving" : entry.status,
        summary: summaryOf(entry.capture),
        tags: buildNote(entry.capture, entry).tags,
        error: entry.error,
        retryable: entry.retryable,
        amended: !!entry.amended,
        amending: !!entry.amended,
        accent: accentHex(prefs.accent),
        theme: prefs.theme,
        ...extra,
    };
    if (tabId === undefined) {
        if (failed && !entry.retryable) notify("没能保存到 neno", entry.error);
        return;
    }
    try {
        await chrome.scripting.executeScript({target: {tabId}, func: nenoToast, args: [state]});
    } catch (e) {
        //无法注入的页面(Chrome 内部页面, 应用商店等)使用系统通知
        toastTabs.delete(entry.id);
        if (state.status === "saved") notify("已保存到 neno", state.summary);
        else if (state.status === "failed") notify("没能保存到 neno", state.error);
    }
}

function notify(title, message) {
    chrome.notifications.create({type: "basic", iconUrl: "icons/128.png", title, message: message || "", silent: true});
}

/* ---------- 保存队列 ---------- */

//对 entries 的读写串行执行, 避免并发覆盖
let entriesLock = Promise.resolve();

function updateEntries(mutate) {
    const run = entriesLock.then(async () => {
        const entries = await getLocal("entries", []);
        const result = await mutate(entries);
        //只保留最近的已保存记录, 未上传的全部保留
        let saved = 0;
        const kept = entries.filter((e) => e.status !== "saved" || ++saved <= KEEP_SAVED);
        await setLocal("entries", kept);
        return result;
    });
    entriesLock = run.catch(() => {});
    return run;
}

async function getEntry(id) {
    return (await getLocal("entries", [])).find((e) => e.id === id);
}

async function patchEntry(id, patch) {
    return updateEntries((entries) => {
        const entry = entries.find((e) => e.id === id);
        if (entry) Object.assign(entry, typeof patch === "function" ? patch(entry) : patch);
        return entry;
    });
}

async function enqueue(capture) {
    const entry = {
        id: objectId(),
        capture: {
            text: capture.text || "",
            quote: capture.quote || "",
            source: capture.source && isWebUrl(capture.source.url) ? {url: capture.source.url, title: capture.source.title || ""} : null,
        },
        created_at: formatTime(),
        status: "pending",
    };
    await updateEntries((entries) => {
        entries.unshift(entry);
    });
    return entry;
}

//同一时间只处理一轮队列, 处理期间新加入的条目会在本轮结束后继续处理
let processing = null;
let again = false;

function processQueue() {
    if (processing) {
        again = true;
        return processing;
    }
    processing = (async () => {
        do {
            again = false;
            await processOnce();
        } while (again);
    })().finally(() => (processing = null));
    return processing;
}

async function processOnce() {
    const config = await getConfig();
    if (!config) return;
    const entries = await getLocal("entries", []);
    //先保存最早的
    const todo = entries.filter((e) => e.status === "pending" || e.status === "saving" || (e.status === "failed" && e.retryable)).reverse();
    for (const item of todo) {
        const entry = await patchEntry(item.id, {status: "saving"});
        if (!entry) continue;
        const note = buildNote(entry.capture, {_id: entry.id, created_at: entry.created_at, update_at: entry.update_at});
        const path = notePath(note);
        const summary = summaryOf(entry.capture).substring(0, 60);
        try {
            const sha = await putFile(config, path, serializeNote(note), `${entry.sha ? "[UPDATE]" : "[ADD]"} ${summary}`, entry.sha);
            const saved = await patchEntry(entry.id, {status: "saved", sha, path, error: "", retryable: false, savedAt: Date.now()});
            await rememberTags(note.tags);
            if (saved) await showToast(saved);
        } catch (error) {
            const retryable = isRetryable(error);
            const failed = await patchEntry(entry.id, {status: "failed", error: describeError(error), retryable});
            if (failed) await showToast(failed);
            //网络问题时后面的也会失败, 等下次重试
            if (retryable) {
                chrome.alarms.create(RETRY_ALARM, {delayInMinutes: 1});
                break;
            }
        }
    }
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === RETRY_ALARM) processQueue();
});

/* ---------- 撤销 / 补充想法 / 重试 ---------- */

async function undo(id) {
    await processing;
    const entry = await getEntry(id);
    if (!entry) return {ok: true};
    if (entry.status === "saved" && entry.sha) {
        const config = await getConfig();
        try {
            await deleteFile(config, entry.path, entry.sha, `[DELETE] ${summaryOf(entry.capture).substring(0, 60)}`);
        } catch (error) {
            if (error.status !== 404) {
                const message = describeError(error);
                await showToast(entry, {status: "failed", error: `撤销失败: ${message}`, retryable: false});
                return {ok: false, error: message};
            }
        }
    }
    await updateEntries((entries) => {
        const index = entries.findIndex((e) => e.id === id);
        if (index !== -1) entries.splice(index, 1);
    });
    await showToast(entry, {status: "undone"});
    toastTabs.delete(id);
    return {ok: true};
}

async function amend(id, text) {
    await processing;
    const entry = await patchEntry(id, (e) => ({
        capture: {...e.capture, text: e.capture.text ? `${e.capture.text}\n${text}` : text},
        update_at: formatTime(),
        status: "pending",
        amended: true,
    }));
    if (!entry) return {ok: false};
    await processQueue();
    return {ok: true};
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handle = async () => {
        switch (message.type) {
            case "save": {
                const entry = await enqueue(message.capture);
                processQueue();
                return {id: entry.id};
            }
            case "undo":
                if (sender.tab && sender.tab.id !== undefined) toastTabs.set(message.id, sender.tab.id);
                return undo(message.id);
            case "amend":
                if (sender.tab && sender.tab.id !== undefined) toastTabs.set(message.id, sender.tab.id);
                return amend(message.id, message.text);
            case "retry":
                if (message.id) await patchEntry(message.id, {status: "pending"});
                else await updateEntries((entries) => entries.forEach((e) => e.status === "failed" && (e.status = "pending")));
                processQueue();
                return {ok: true};
            case "config-changed":
                //重新连接后, 之前因为 Token 失效没能保存的笔记重新上传
                await updateEntries((entries) => entries.forEach((e) => e.status === "failed" && (e.status = "pending")));
                processQueue();
                return {ok: true};
            case "discard":
                await updateEntries((entries) => {
                    const index = entries.findIndex((e) => e.id === message.id && e.status !== "saved");
                    if (index !== -1) entries.splice(index, 1);
                });
                return {ok: true};
            default:
                return null;
        }
    };
    handle().then(sendResponse, (error) => sendResponse({ok: false, error: error.message}));
    return true;
});
