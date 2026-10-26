//扩展的持久化数据
//  sync.config   连接信息 {access_token, githubName, repoName}, 与旧版插件使用相同的 key, 升级后无需重新配置
//  sync.prefs    偏好设置, 跟随 Chrome 账号同步
//  local.entries 保存记录: 未上传的队列 + 最近保存的笔记, 只由后台写入
//  local.tags    标签补全用的置顶标签和最近用过的标签
//  local.draft   弹窗里还没保存的草稿
export const DEFAULT_PREFS = {
    attachSource: true,
    nenoUrl: "https://neno.pages.dev",
    accent: "green",
    theme: "system",
};

//与 neno 网页版相同的主题色, hex 用于注入到网页中的提示
export const ACCENTS = [
    {key: "green", name: "薄荷绿", hex: "#16a34a"},
    {key: "teal", name: "青碧", hex: "#0d9488"},
    {key: "blue", name: "海湾蓝", hex: "#2563eb"},
    {key: "violet", name: "薰衣草紫", hex: "#7c3aed"},
    {key: "rose", name: "樱花粉", hex: "#e11d48"},
    {key: "orange", name: "暖阳橙", hex: "#ea580c"},
];

export const THEMES = [
    {key: "light", name: "浅色"},
    {key: "dark", name: "深色"},
    {key: "system", name: "跟随系统"},
];

export function accentHex(key) {
    return (ACCENTS.find((accent) => accent.key === key) || ACCENTS[0]).hex;
}

export async function getConfig() {
    const {config} = await chrome.storage.sync.get("config");
    if (config && config.access_token && config.githubName && config.repoName) return config;
    return null;
}

export async function setConfig(config) {
    if (config) {
        await chrome.storage.sync.set({
            config: {access_token: config.access_token.trim(), githubName: config.githubName, repoName: config.repoName},
        });
    } else {
        await chrome.storage.sync.remove("config");
        await chrome.storage.local.remove(["account", "tags"]);
    }
}

export async function getPrefs() {
    const {prefs} = await chrome.storage.sync.get("prefs");
    return {...DEFAULT_PREFS, ...(prefs || {})};
}

export async function setPrefs(patch) {
    const prefs = {...(await getPrefs()), ...patch};
    await chrome.storage.sync.set({prefs});
    return prefs;
}

export async function getLocal(key, fallback) {
    const result = await chrome.storage.local.get(key);
    return result[key] === undefined ? fallback : result[key];
}

export async function setLocal(key, value) {
    await chrome.storage.local.set({[key]: value});
}

//监听某个 key 的变化
export function watch(area, key, callback) {
    const listener = (changes, changedArea) => {
        if (changedArea === area && key in changes) callback(changes[key].newValue);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
}

//最近用过的标签排在前面, 然后是 neno 中的置顶标签
export async function rememberTags(tags) {
    if (tags.length === 0) return;
    const store = await getLocal("tags", {pinned: [], used: []});
    const used = [...tags, ...(store.used || []).filter((tag) => !tags.includes(tag))].slice(0, 50);
    await setLocal("tags", {...store, used});
}

export function suggestionTags(store) {
    if (!store) return [];
    return [...new Set([...(store.used || []), ...(store.pinned || [])])];
}
