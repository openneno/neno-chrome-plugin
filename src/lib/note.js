//生成与 neno 网页版相同格式的笔记: 仓库中的 YYYY-MM-DD/<_id>.json

//与 neno 相同的 24 位 ObjectId: 时间戳(8) + 机器(6) + 进程(4) + 自增(6)
let increment = Math.floor(Math.random() * 0xffffff);
const pid = Math.floor(Math.random() * 0xffff);
const machine = Math.floor(Math.random() * 0xffffff);

function hex(value, length) {
    return value.toString(16).padStart(length, "0");
}

export function objectId() {
    increment = (increment + 1) % 0x1000000;
    return hex(Math.floor(Date.now() / 1000), 8) + hex(machine, 6) + hex(pid, 4) + hex(increment, 6);
}

//与 dayjs().format() 相同: 2026-10-26T09:30:00+08:00
export function formatTime(date = new Date()) {
    const pad = (n) => String(n).padStart(2, "0");
    const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "-";
    const abs = Math.abs(offset);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

function escapeHtml(text) {
    return text.replace(/[&<>"']/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[c]);
}

//与 neno 编辑器的规则一致: # 开头直到空白
export function extractTags(text) {
    const found = (text || "").match(/#\S+/g) || [];
    return [...new Set(found)];
}

function normalize(text) {
    return (text || "").replace(/\r\n?/g, "\n").replace(/ /g, " ").trim();
}

//只保留 http(s) 链接, 避免把 chrome:// 等内部地址写进笔记
export function isWebUrl(url) {
    return /^https?:\/\//i.test(url || "");
}

export function hostOf(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch (e) {
        return "";
    }
}

//capture: {text 自己的想法, quote 摘录的文字, source {url, title}}
//标签只从自己写的文字里提取, 摘录中偶然出现的 # 不会变成标签
export function buildNote(capture, {_id, created_at, update_at}) {
    const text = normalize(capture.text);
    const quote = normalize(capture.quote);
    const source = capture.source && isWebUrl(capture.source.url) ? capture.source : null;
    const title = source ? normalize(source.title) || hostOf(source.url) : "";

    const html = [];
    const plain = [];
    if (text) {
        text.split("\n").forEach((line) => html.push(line ? `<p>${escapeHtml(line)}</p>` : "<p><br></p>"));
        plain.push(text);
    }
    if (quote) {
        html.push(`<blockquote>${quote.split("\n").map(escapeHtml).join("<br>")}</blockquote>`);
        plain.push(quote);
    }
    if (source) {
        const link = `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a>`;
        html.push(text || quote ? `<p>来自 ${link}</p>` : `<p>${link}</p>`);
        plain.push(text || quote ? `来自 ${title}` : title);
    }

    return {
        content: html.join(""),
        pureContent: plain.join("\n"),
        _id,
        parentId: "",
        source: "chrome",
        tags: extractTags(text),
        images: [],
        created_at,
        sha: "",
        update_at: update_at || created_at,
    };
}

export function notePath(note) {
    return `${note.created_at.substring(0, 10)}/${note._id}.json`;
}

export function serializeNote(note) {
    return JSON.stringify(note, null, "\t");
}

//列表中展示的一行摘要
export function summaryOf(capture) {
    const line = normalize(capture.text) || normalize(capture.quote) || normalize(capture.source && capture.source.title) || (capture.source && capture.source.url) || "";
    return line.replace(/\s+/g, " ");
}

export function isEmptyCapture(capture) {
    return !normalize(capture.text) && !normalize(capture.quote) && !(capture.source && isWebUrl(capture.source.url));
}
