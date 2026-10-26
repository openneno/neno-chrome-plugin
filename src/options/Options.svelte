<script>
    import {onMount} from "svelte";
    import Icon from "../components/Icon.svelte";
    import Logo from "../components/Logo.svelte";
    import Switch from "../components/Switch.svelte";
    import Connect from "../components/Connect.svelte";
    import {fetchAccount} from "../lib/github.js";
    import {ACCENTS, DEFAULT_PREFS, THEMES, getConfig, getLocal, getPrefs, setConfig, setLocal, setPrefs, watch} from "../lib/store.js";
    import {isMac, openTab, repoUrl, send} from "../lib/ui.js";

    const version = chrome.runtime.getManifest().version;

    let loading = $state(true);
    let config = $state(null);
    let account = $state(null);
    let prefs = $state({...DEFAULT_PREFS});
    let commands = $state([]);
    let entries = $state([]);
    let changing = $state(false);
    let confirmDisconnect = $state(false);
    let nenoUrl = $state("");
    let urlSaved = $state(false);

    let pending = $derived(entries.filter((e) => e.status !== "saved").length);

    onMount(async () => {
        [config, prefs, account, entries] = await Promise.all([getConfig(), getPrefs(), getLocal("account", null), getLocal("entries", [])]);
        nenoUrl = prefs.nenoUrl;
        loading = false;
        watch("local", "entries", (value) => (entries = value || []));
        loadCommands();
        //标签页重新显示时刷新快捷键, 用户可能刚去修改过
        document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && loadCommands());
        if (config && !account) refreshAccount();
    });

    async function refreshAccount() {
        try {
            account = await fetchAccount(config.access_token);
            await setLocal("account", account);
        } catch (e) {
            //离线或 Token 失效时只显示仓库
        }
    }

    async function loadCommands() {
        const all = await chrome.commands.getAll();
        const names = {_execute_action: "打开速记", "save-selection": "保存选中的文字"};
        commands = all.filter((c) => names[c.name]).map((c) => ({...c, label: names[c.name]}));
    }

    async function update(patch) {
        prefs = await setPrefs(patch);
    }

    async function saveUrl() {
        let value = nenoUrl.trim().replace(/\/+$/, "");
        if (value && !/^https?:\/\//i.test(value)) value = `https://${value}`;
        if (!value) value = DEFAULT_PREFS.nenoUrl;
        nenoUrl = value;
        if (value === prefs.nenoUrl) return;
        await update({nenoUrl: value});
        urlSaved = true;
        setTimeout(() => (urlSaved = false), 1600);
    }

    async function connected(next, user) {
        config = next;
        account = user;
        changing = false;
    }

    async function disconnect() {
        await setConfig(null);
        config = null;
        account = null;
        confirmDisconnect = false;
    }

    function keys(shortcut) {
        return shortcut ? shortcut.split("+").map((key) => (isMac ? ({Alt: "⌥", Shift: "⇧", Command: "⌘", MacCtrl: "⌃", Ctrl: "⌘"}[key] || key) : key)) : [];
    }
</script>

<div class="page">
    <header class="hero">
        <Logo size={40} />
        <div>
            <h1>neno</h1>
            <p>随手把网页上的文字、链接和想法记到 neno · v{version}</p>
        </div>
    </header>

    {#if !loading}
        <section class="panel">
            <h2>连接</h2>
            {#if !config || changing}
                <div class="body">
                    {#if changing}
                        <button class="back" onclick={() => (changing = false)}><Icon name="arrowLeft" size={14} />取消</button>
                    {/if}
                    <Connect onconnected={connected} />
                </div>
            {:else}
                <div class="body account">
                    {#if account}
                        <img src={account.avatar} alt="" />
                    {:else}
                        <div class="avatar"><Icon name="github" size={22} /></div>
                    {/if}
                    <div class="who">
                        <div class="name">{account ? account.name : config.githubName}<span class="ok">已连接</span></div>
                        <button class="repo" onclick={() => openTab(repoUrl(config))}>
                            <Icon name="github" size={13} />{config.githubName}/{config.repoName}<Icon name="external" size={12} />
                        </button>
                    </div>
                    {#if confirmDisconnect}
                        <div class="confirm">
                            <span>断开后需要重新粘贴 token</span>
                            <button class="btn btn-danger" onclick={disconnect}>断开</button>
                            <button class="btn btn-ghost" onclick={() => (confirmDisconnect = false)}>取消</button>
                        </div>
                    {:else}
                        <button class="btn" onclick={() => (changing = true)}><Icon name="swap" size={14} />更换</button>
                        <button class="btn btn-ghost" onclick={() => (confirmDisconnect = true)}><Icon name="logout" size={14} />断开</button>
                    {/if}
                </div>
                {#if pending > 0}
                    <div class="pending">
                        <Icon name="cloudOff" size={14} />
                        <span>有 {pending} 条笔记还没有保存到 neno</span>
                        <button class="linkish" onclick={() => send({type: "retry"})}>立即重试</button>
                    </div>
                {/if}
            {/if}
        </section>

        <section class="panel">
            <h2>如何使用</h2>
            <div class="body tips">
                <div class="tip">
                    <div class="tip-icon"><Icon name="cursor" size={18} /></div>
                    <div>
                        <h3>选中文字, 右键保存</h3>
                        <p>在网页上选中一段文字, 右键选择「保存选中的文字到 neno」。也可以右键保存链接或整个页面。</p>
                    </div>
                </div>
                <div class="tip">
                    <div class="tip-icon"><Icon name="keyboard" size={18} /></div>
                    <div>
                        <h3>一个快捷键就够了</h3>
                        <p>选中文字后按 {#each keys(commands.find((c) => c.name === "save-selection")?.shortcut) as key}<span class="kbd">{key}</span>{:else}快捷键{/each}, 不用离开正在读的页面。</p>
                    </div>
                </div>
                <div class="tip">
                    <div class="tip-icon"><Icon name="pen" size={18} /></div>
                    <div>
                        <h3>保存之后, 补一句想法</h3>
                        <p>页面右下角会出现提示, 可以立即补充想法、加上 #标签, 或者撤销。离线时笔记会先存在本地, 联网后自动保存。</p>
                    </div>
                </div>
            </div>
        </section>

        <section class="panel">
            <h2>记录</h2>
            <div class="body rows">
                <div class="row">
                    <div class="text">
                        <div class="title">默认附上网页来源</div>
                        <div class="desc">在笔记末尾附上页面标题和链接, 方便以后回到原文</div>
                    </div>
                    <Switch checked={prefs.attachSource} label="默认附上网页来源" onchange={(value) => update({attachSource: value})} />
                </div>
                <div class="row">
                    <div class="text">
                        <div class="title">neno 网页地址</div>
                        <div class="desc">点击「打开 neno」时前往的地址, 自己部署的 neno 可以在这里修改</div>
                    </div>
                    <div class="url">
                        <input class="input" bind:value={nenoUrl} onblur={saveUrl} onkeydown={(event) => event.key === "Enter" && event.currentTarget.blur()} spellcheck="false" />
                        {#if urlSaved}<span class="saved"><Icon name="check" size={14} /></span>{/if}
                    </div>
                </div>
            </div>
        </section>

        <section class="panel">
            <h2>外观</h2>
            <div class="body rows">
                <div class="row">
                    <div class="text"><div class="title">主题色</div></div>
                    <div class="swatches" role="radiogroup" aria-label="主题色">
                        {#each ACCENTS as accent (accent.key)}
                            <button class="swatch" class:active={prefs.accent === accent.key} style:--c={accent.hex}
                                    role="radio" aria-checked={prefs.accent === accent.key} title={accent.name} aria-label={accent.name}
                                    onclick={() => update({accent: accent.key})}>
                                {#if prefs.accent === accent.key}<Icon name="check" size={13} stroke={2.6} />{/if}
                            </button>
                        {/each}
                    </div>
                </div>
                <div class="row">
                    <div class="text"><div class="title">外观</div></div>
                    <div class="segmented" role="radiogroup" aria-label="外观">
                        {#each THEMES as theme (theme.key)}
                            <button class:active={prefs.theme === theme.key} role="radio" aria-checked={prefs.theme === theme.key}
                                    onclick={() => update({theme: theme.key})}>{theme.name}</button>
                        {/each}
                    </div>
                </div>
            </div>
        </section>

        <section class="panel">
            <h2>快捷键</h2>
            <div class="body rows">
                {#each commands as command (command.name)}
                    <div class="row">
                        <div class="text"><div class="title">{command.label}</div></div>
                        <div class="keys">
                            {#each keys(command.shortcut) as key}<span class="kbd">{key}</span>{:else}<span class="unset">未设置</span>{/each}
                        </div>
                    </div>
                {/each}
                <div class="row">
                    <div class="text"><div class="desc">快捷键由浏览器统一管理, 可能与其他扩展冲突</div></div>
                    <button class="btn" onclick={() => openTab("chrome://extensions/shortcuts")}>修改快捷键</button>
                </div>
            </div>
        </section>

        <footer>
            <button class="linkish" onclick={() => openTab(prefs.nenoUrl)}>打开 neno</button>
            <span>·</span>
            <button class="linkish" onclick={() => openTab("https://github.com/openneno/neno-chrome-plugin")}>源代码</button>
        </footer>
    {/if}
</div>

<style>
    .page {
        max-width: 640px;
        margin: 0 auto;
        padding: 56px 24px 64px;
    }

    .hero {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 32px;
    }

    h1 {
        margin: 0;
        font-size: 22px;
        font-weight: 700;
        letter-spacing: 0.02em;
        line-height: 1.2;
    }

    .hero p {
        margin: 2px 0 0;
        color: var(--ink-3);
        font-size: 13px;
    }

    .panel {
        margin-bottom: 26px;
    }

    h2 {
        margin: 0 0 8px 4px;
        color: var(--ink-3);
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.06em;
    }

    .body {
        padding: 20px;
        border: 1px solid var(--line);
        border-radius: 16px;
        background: var(--surface);
        box-shadow: var(--shadow-card);
    }

    .back {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 12px;
        padding: 0;
        border: 0;
        background: none;
        color: var(--ink-3);
        font-size: 12.5px;
        cursor: pointer;
    }

    .account {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
    }

    .account img,
    .avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: var(--surface-2);
        display: grid;
        place-items: center;
        color: var(--ink-3);
    }

    .who {
        flex: 1;
        min-width: 180px;
    }

    .name {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        font-size: 15px;
    }

    .ok {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 0 8px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent-ink);
        font-size: 11.5px;
        font-weight: 500;
        line-height: 20px;
    }

    .ok::before {
        content: "";
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--accent);
    }

    .repo {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        margin-top: 2px;
        padding: 0;
        border: 0;
        background: none;
        color: var(--ink-3);
        font-size: 12.5px;
        cursor: pointer;
    }

    .repo:hover {
        color: var(--ink);
    }

    .confirm {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--ink-3);
        font-size: 12.5px;
    }

    .pending {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
        padding: 10px 14px;
        border-radius: 12px;
        background: var(--accent-soft);
        color: var(--accent-ink);
        font-size: 13px;
    }

    .pending span {
        flex: 1;
    }

    .linkish {
        padding: 0;
        border: 0;
        background: none;
        color: var(--accent-ink);
        font-size: inherit;
        cursor: pointer;
    }

    .linkish:hover {
        text-decoration: underline;
    }

    .tips {
        display: grid;
        gap: 18px;
    }

    .tip {
        display: flex;
        gap: 14px;
    }

    .tip-icon {
        flex: none;
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: var(--accent-soft);
        color: var(--accent-ink);
    }

    .tip h3 {
        margin: 0 0 2px;
        font-size: 14px;
        font-weight: 600;
    }

    .tip p {
        margin: 0;
        color: var(--ink-2);
        font-size: 13px;
    }

    .tip .kbd {
        margin: 0 2px;
    }

    .rows {
        padding: 4px 20px;
    }

    .row {
        display: flex;
        align-items: center;
        gap: 16px;
        min-height: 60px;
        padding: 12px 0;
    }

    .row + .row {
        border-top: 1px solid var(--line);
    }

    .text {
        flex: 1;
        min-width: 0;
    }

    .title {
        font-weight: 500;
    }

    .desc {
        color: var(--ink-3);
        font-size: 12.5px;
    }

    .url {
        position: relative;
        width: 240px;
    }

    .url .input {
        height: 34px;
        font-size: 13px;
    }

    .saved {
        position: absolute;
        right: 10px;
        top: 9px;
        color: var(--accent);
    }

    .swatches {
        display: flex;
        gap: 8px;
    }

    .swatch {
        display: grid;
        place-items: center;
        width: 26px;
        height: 26px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: var(--c);
        color: #fff;
        cursor: pointer;
        transition: transform 0.15s var(--ease), box-shadow 0.15s;
    }

    .swatch:hover {
        transform: scale(1.08);
    }

    .swatch.active {
        box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--c);
    }

    .segmented {
        display: flex;
        padding: 3px;
        border-radius: 10px;
        background: var(--surface-2);
    }

    .segmented button {
        height: 28px;
        padding: 0 12px;
        border: 0;
        border-radius: 7px;
        background: none;
        color: var(--ink-3);
        font-size: 12.5px;
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
    }

    .segmented button.active {
        background: var(--surface);
        color: var(--ink);
        box-shadow: var(--shadow-card), 0 0 0 1px var(--line);
    }

    .keys {
        display: flex;
        gap: 4px;
    }

    .keys .kbd {
        height: 22px;
        padding: 0 7px;
        font-size: 12px;
    }

    .unset {
        color: var(--ink-3);
        font-size: 12.5px;
    }

    footer {
        display: flex;
        justify-content: center;
        gap: 8px;
        color: var(--ink-3);
        font-size: 12.5px;
    }

    footer .linkish {
        color: var(--ink-3);
    }

    @media (max-width: 560px) {
        .row {
            flex-wrap: wrap;
        }

        .url {
            width: 100%;
        }
    }
</style>
