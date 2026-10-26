<script>
    import {onMount} from "svelte";
    import Icon from "../components/Icon.svelte";
    import Logo from "../components/Logo.svelte";
    import Switch from "../components/Switch.svelte";
    import Connect from "../components/Connect.svelte";
    import TagTextarea from "../components/TagTextarea.svelte";
    import {fetchPinTags} from "../lib/github.js";
    import {extractTags, hostOf, isWebUrl, summaryOf} from "../lib/note.js";
    import {getConfig, getLocal, getPrefs, setLocal, setPrefs, suggestionTags, watch} from "../lib/store.js";
    import {readSelection} from "../lib/toast.js";
    import {isMac, openTab, relativeTime, send} from "../lib/ui.js";

    let view = $state("loading");
    let prefs = $state(null);
    let entries = $state([]);
    let tagStore = $state(null);

    //当前标签页
    let page = $state(null);
    let quote = $state("");
    let attach = $state(true);
    let text = $state("");
    let editor = $state();

    //保存后的状态
    let savedId = $state(null);
    let lastCapture = null;
    let hovering = $state(false);

    let tags = $derived(suggestionTags(tagStore));
    let canSave = $derived(!!(text.trim() || quote.trim() || (attach && page)));
    let current = $derived(entries.find((e) => e.id === savedId));
    let recent = $derived(entries.filter((e) => e.id !== savedId).slice(0, 4));
    let authBroken = $derived(entries.some((e) => e.status === "failed" && !e.retryable && /Token/.test(e.error || "")));

    onMount(async () => {
        const [config, p] = await Promise.all([getConfig(), getPrefs()]);
        prefs = p;
        attach = p.attachSource;
        entries = await getLocal("entries", []);
        watch("local", "entries", (value) => (entries = value || []));
        if (!config) {
            view = "connect";
            return;
        }
        await loadPage();
        const draft = await getLocal("draft", null);
        if (draft && Date.now() - draft.at < 7 * 86400e3) text = draft.text;
        view = "compose";
        requestAnimationFrame(() => editor && editor.focus());
        loadTags(config);
    });

    async function loadPage() {
        let [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        //端到端测试在普通标签页中打开弹窗, 通过 ?tab= 指定页面
        if (import.meta.env.MODE === "test" && location.search) tab = await chrome.tabs.get(Number(new URLSearchParams(location.search).get("tab")));
        if (!tab || !isWebUrl(tab.url)) return;
        page = {url: tab.url, title: tab.title || hostOf(tab.url), icon: tab.favIconUrl};
        try {
            const results = await chrome.scripting.executeScript({target: {tabId: tab.id, allFrames: true}, func: readSelection});
            const hit = results.map((r) => r.result).find((r) => r && r.text && r.text.trim());
            if (hit) quote = hit.text.trim();
        } catch (e) {
            //无法读取选区的页面
        }
    }

    //置顶标签每小时刷新一次
    async function loadTags(config) {
        tagStore = await getLocal("tags", {pinned: [], used: []});
        if (tagStore.fetchedAt && Date.now() - tagStore.fetchedAt < 3600e3) return;
        try {
            const pinned = await fetchPinTags(config);
            tagStore = {...(await getLocal("tags", {})), pinned, fetchedAt: Date.now()};
            await setLocal("tags", tagStore);
        } catch (e) {
            //离线时使用缓存
        }
    }

    let draftTimer;

    function saveDraft(value) {
        clearTimeout(draftTimer);
        draftTimer = setTimeout(() => setLocal("draft", {text: value, at: Date.now()}), 250);
    }

    async function save() {
        if (!canSave || view !== "compose") return;
        lastCapture = {text, quote, attach};
        const capture = {text: text.trim(), quote: quote.trim(), source: attach && page ? {url: page.url, title: page.title} : null};
        clearTimeout(draftTimer);
        await chrome.storage.local.remove("draft");
        const {id} = await send({type: "save", capture});
        savedId = id;
        view = "saved";
    }

    function toggleAttach(value) {
        setPrefs({attachSource: value});
    }

    //保存成功后自动关闭弹窗, 鼠标停留时暂停
    const CLOSE_AFTER = 2600;
    let closeTimer;
    let closing = $state(false);

    $effect(() => {
        const ready = view === "saved" && current && current.status === "saved";
        clearTimeout(closeTimer);
        closing = ready && !hovering;
        if (closing) closeTimer = setTimeout(() => window.close(), CLOSE_AFTER);
    });

    async function undo() {
        const id = savedId;
        const result = await send({type: "undo", id});
        if (result && result.ok === false) return;
        //撤销后把内容放回输入框, 方便修改后再保存
        savedId = null;
        if (lastCapture) {
            text = lastCapture.text;
            quote = lastCapture.quote;
            attach = lastCapture.attach;
            //关闭弹窗后也不会丢失
            if (text.trim()) saveDraft(text);
        }
        view = "compose";
        requestAnimationFrame(() => editor && editor.focus());
    }

    function writeAnother() {
        savedId = null;
        text = "";
        quote = "";
        view = "compose";
        requestAnimationFrame(() => editor && editor.focus());
    }

    function openNeno() {
        openTab(prefs.nenoUrl);
        window.close();
    }

    function openOptions() {
        chrome.runtime.openOptionsPage();
        window.close();
    }

    function openEntry(entry) {
        if (entry.capture.source) openTab(entry.capture.source.url);
        else openNeno();
    }

    async function connected() {
        await loadPage();
        view = "compose";
        const config = await getConfig();
        requestAnimationFrame(() => editor && editor.focus());
        loadTags(config);
    }
</script>

<main class:wide={view === "connect"}>
    <header>
        <div class="brand"><Logo size={20} /><span>neno</span></div>
        {#if view !== "connect" && view !== "loading"}
            <button class="icon-btn" title="打开 neno" aria-label="打开 neno" onclick={openNeno}><Icon name="external" /></button>
            <button class="icon-btn" title="设置" aria-label="设置" onclick={openOptions}><Icon name="settings" /></button>
        {/if}
    </header>

    {#if view === "connect"}
        <section class="pad"><Connect compact onconnected={connected} /></section>
    {:else if view === "compose"}
        {#if authBroken}
            <button class="banner" onclick={openOptions}>
                <Icon name="alert" size={14} /><span>Token 已失效, 部分笔记还没保存。点击重新连接</span><Icon name="arrowRight" size={14} />
            </button>
        {/if}

        <section class="card">
            <TagTextarea
                    bind:this={editor}
                    bind:value={text}
                    {tags}
                    placeholder={quote ? "写点想法(可选)" : "此刻在想什么?  用 #标签 归类"}
                    onsubmit={save}
                    oninput={saveDraft}
            />

            {#if quote}
                <blockquote>
                    <p>{quote}</p>
                    <button class="icon-btn mini" title="不保存选中的文字" aria-label="不保存选中的文字" onclick={() => (quote = "")}><Icon name="x" size={13} /></button>
                </blockquote>
            {/if}

            {#if page}
                <div class="source" class:off={!attach} role="button" tabindex="0"
                     onclick={() => {
                         attach = !attach;
                         toggleAttach(attach);
                     }}
                     onkeydown={(event) => {
                         if (event.key === " " || event.key === "Enter") {
                             event.preventDefault();
                             attach = !attach;
                             toggleAttach(attach);
                         }
                     }}>
                    {#if page.icon}<img src={page.icon} alt="" />{:else}<Icon name="globe" size={14} />{/if}
                    <div class="meta">
                        <span class="title">{page.title}</span>
                        <span class="host">{hostOf(page.url)}</span>
                    </div>
                    <span class="label">附上来源</span>
                    <Switch bind:checked={attach} label="附上来源" onchange={toggleAttach} />
                </div>
            {/if}

            <footer>
                <button class="icon-btn" title="添加标签" aria-label="添加标签" onclick={() => editor.insertHash()}><Icon name="hash" /></button>
                <span class="shortcut"><span class="kbd">{isMac ? "⌘" : "Ctrl"}</span><span class="kbd">↵</span> 保存</span>
                <button class="btn btn-primary save" disabled={!canSave} onclick={save}>保存</button>
            </footer>
        </section>
    {:else if view === "saved"}
        <section class="card done" onmouseenter={() => (hovering = true)} onmouseleave={() => (hovering = false)} role="status" aria-live="polite">
            {#if !current || current.status === "pending" || current.status === "saving"}
                <div class="badge"><Icon name="loader" size={22} class="spin" /></div>
                <h3>正在保存…</h3>
            {:else if current.status === "saved"}
                <div class="badge ok"><Icon name="check" size={22} stroke={2.4} /></div>
                <h3>已保存到 neno</h3>
            {:else if current.retryable}
                <div class="badge wait"><Icon name="cloudOff" size={20} /></div>
                <h3>已暂存在本地</h3>
                <p class="note">{current.error}, 联网后会自动保存到 neno</p>
            {:else}
                <div class="badge bad"><Icon name="alert" size={20} /></div>
                <h3>没能保存</h3>
                <p class="note">{current.error}</p>
            {/if}

            {#if current}
                <p class="summary">{summaryOf(current.capture)}</p>
                {@const noteTags = extractTags(current.capture.text)}
                {#if noteTags.length}
                    <div class="tags">{#each noteTags as tag}<span class="tag">{tag}</span>{/each}</div>
                {/if}
            {/if}

            <div class="actions">
                {#if current && current.status === "failed" && !current.retryable}
                    <button class="btn btn-primary" onclick={openOptions}>重新连接</button>
                    <button class="btn" onclick={() => send({type: "retry", id: savedId})}><Icon name="refresh" size={14} />重试</button>
                {:else}
                    <button class="btn" disabled={!current || current.status === "saving"} onclick={undo}><Icon name="undo" size={14} />撤销</button>
                    <button class="btn" onclick={writeAnother}><Icon name="pen" size={14} />再记一条</button>
                {/if}
            </div>
            <div class="countdown" class:run={closing} style:animation-duration="{CLOSE_AFTER}ms"></div>
        </section>
    {/if}

    {#if (view === "compose" || view === "saved") && recent.length > 0}
        <section class="recent">
            <div class="recent-head">
                <span>最近</span>
                {#if recent.some((e) => e.status === "failed")}
                    <button class="linkish" onclick={() => send({type: "retry"})}><Icon name="refresh" size={12} />全部重试</button>
                {/if}
            </div>
            <ul>
                {#each recent as entry (entry.id)}
                    <li>
                        <button class="row" onclick={() => openEntry(entry)} title={entry.capture.source ? entry.capture.source.url : "在 neno 中查看"}>
                            <span class="dot {entry.status}">
                                {#if entry.status === "saving" || entry.status === "pending"}<Icon name="loader" size={12} class="spin" />
                                {:else if entry.status === "failed"}<Icon name="alert" size={13} />{/if}
                            </span>
                            <span class="line">{summaryOf(entry.capture)}</span>
                            <span class="when">
                                {#if entry.status === "failed"}{entry.retryable ? "等待联网" : "未保存"}
                                {:else if entry.status === "saved"}{relativeTime(entry.savedAt || Date.parse(entry.created_at))}
                                {:else}保存中{/if}
                            </span>
                        </button>
                    </li>
                {/each}
            </ul>
        </section>
    {/if}
</main>

<style>
    :global(body) {
        width: 380px;
        background: var(--canvas);
    }

    main {
        padding: 10px 12px 12px;
    }

    main.wide {
        padding-bottom: 16px;
    }

    header {
        display: flex;
        align-items: center;
        gap: 2px;
        height: 32px;
        margin-bottom: 8px;
        padding-left: 2px;
    }

    .brand {
        display: flex;
        align-items: center;
        gap: 7px;
        flex: 1;
        font-weight: 650;
        font-size: 14.5px;
        letter-spacing: 0.02em;
    }

    .pad {
        padding: 6px 4px 0;
    }

    .banner {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        margin-bottom: 8px;
        padding: 8px 10px;
        border: 0;
        border-radius: 10px;
        background: color-mix(in oklab, var(--danger) 10%, transparent);
        color: var(--danger);
        font-size: 12.5px;
        text-align: left;
        cursor: pointer;
    }

    .banner span {
        flex: 1;
    }

    .card {
        position: relative;
        padding: 14px 14px 10px;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--surface);
        box-shadow: var(--shadow-card);
        transition: border-color 0.2s, box-shadow 0.2s;
    }

    .card:focus-within {
        border-color: color-mix(in oklab, var(--accent) 45%, var(--line));
        box-shadow: 0 0 0 3px var(--accent-soft);
    }

    blockquote {
        position: relative;
        margin: 12px 0 0;
        padding: 2px 30px 2px 11px;
        border-left: 2.5px solid color-mix(in oklab, var(--accent) 55%, transparent);
        color: var(--ink-2);
        font-size: 13px;
        line-height: 1.65;
    }

    blockquote p {
        margin: 0;
        max-height: 6.6em;
        overflow-y: auto;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
    }

    .mini {
        position: absolute;
        top: -2px;
        right: -4px;
        width: 24px;
        height: 24px;
    }

    .source {
        display: flex;
        align-items: center;
        gap: 9px;
        margin-top: 12px;
        padding: 8px 10px;
        border-radius: 10px;
        background: var(--surface-2);
        color: var(--ink-3);
        cursor: pointer;
        user-select: none;
        transition: opacity 0.2s;
    }

    .source img {
        width: 16px;
        height: 16px;
        border-radius: 3px;
        flex: none;
    }

    .source.off .meta {
        opacity: 0.45;
        text-decoration: line-through;
        text-decoration-color: var(--line-strong);
    }

    .meta {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        line-height: 1.35;
        transition: opacity 0.2s;
    }

    .meta .title {
        color: var(--ink);
        font-size: 12.5px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .meta .host {
        font-size: 11.5px;
    }

    .label {
        font-size: 11.5px;
    }

    footer {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 10px;
        margin-left: -6px;
    }

    .shortcut {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 3px;
        color: var(--ink-3);
        font-size: 11.5px;
    }

    .shortcut .kbd:last-of-type {
        margin-right: 3px;
    }

    .save {
        min-width: 68px;
    }

    /* 保存结果 */
    .done {
        padding: 22px 18px 16px;
        text-align: center;
        overflow: hidden;
        animation: pop 0.28s var(--ease);
    }

    .badge {
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        margin: 0 auto 10px;
        border-radius: 50%;
        background: var(--surface-2);
        color: var(--ink-3);
    }

    .badge.ok {
        background: var(--accent);
        color: #fff;
        animation: pop 0.36s var(--ease);
    }

    .badge.wait {
        background: var(--accent-soft);
        color: var(--accent-ink);
    }

    .badge.bad {
        background: color-mix(in oklab, var(--danger) 12%, transparent);
        color: var(--danger);
    }

    h3 {
        margin: 0;
        font-size: 15px;
        font-weight: 650;
    }

    .note {
        margin: 4px 0 0;
        color: var(--ink-3);
        font-size: 12.5px;
    }

    .summary {
        margin: 10px auto 0;
        max-width: 300px;
        color: var(--ink-2);
        font-size: 13px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        overflow-wrap: anywhere;
    }

    .tags {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 4px;
        margin-top: 8px;
        font-size: 12px;
    }

    .actions {
        display: flex;
        justify-content: center;
        gap: 8px;
        margin-top: 16px;
    }

    .countdown {
        position: absolute;
        left: 0;
        bottom: 0;
        height: 2px;
        width: 100%;
        background: var(--accent);
        opacity: 0.5;
        transform: scaleX(0);
        transform-origin: left;
    }

    .countdown.run {
        animation: countdown linear forwards;
    }

    @keyframes countdown {
        from {
            transform: scaleX(1);
        }
        to {
            transform: scaleX(0);
        }
    }

    @keyframes pop {
        from {
            opacity: 0;
            transform: scale(0.94);
        }
    }

    /* 最近保存 */
    .recent {
        margin-top: 12px;
    }

    .recent-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 4px 4px;
        color: var(--ink-3);
        font-size: 11.5px;
        font-weight: 500;
        letter-spacing: 0.04em;
    }

    .linkish {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 0;
        border: 0;
        background: none;
        color: var(--accent-ink);
        font-size: 11.5px;
        cursor: pointer;
    }

    ul {
        list-style: none;
        margin: 0;
        padding: 0;
    }

    .row {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 6px 6px;
        border: 0;
        border-radius: 8px;
        background: none;
        color: var(--ink-2);
        font-size: 12.5px;
        text-align: left;
        cursor: pointer;
    }

    .row:hover {
        background: var(--surface);
        color: var(--ink);
    }

    .dot {
        flex: none;
        display: grid;
        place-items: center;
        width: 14px;
        height: 14px;
    }

    .dot.saved::before {
        content: "";
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: color-mix(in oklab, var(--accent) 70%, transparent);
    }

    .dot.saving,
    .dot.pending {
        color: var(--ink-3);
    }

    .dot.failed {
        color: var(--danger);
    }

    .line {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .when {
        flex: none;
        color: var(--ink-3);
        font-size: 11.5px;
    }
</style>
