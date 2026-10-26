<script>
    //连接 neno: 粘贴 neno token(推荐), 或者使用 GitHub Token 并选择笔记仓库
    import Icon from "./Icon.svelte";
    import {describeError, fetchAccount, fetchRepo, listRepos} from "../lib/github.js";
    import {decodeNenoToken, looksLikeGithubToken} from "../lib/token.js";
    import {getPrefs, setConfig, setLocal} from "../lib/store.js";
    import {openTab, send} from "../lib/ui.js";

    let {onconnected, compact = false} = $props();

    const TOKEN_URL = "https://github.com/settings/tokens/new?scopes=repo&description=neno%20%E6%B5%8F%E8%A7%88%E5%99%A8%E6%8F%92%E4%BB%B6";

    let mode = $state("neno");
    let value = $state("");
    let reveal = $state(false);
    let busy = $state(false);
    let error = $state("");
    //GitHub Token 模式: 校验后选择仓库
    let account = $state(null);
    let repos = $state([]);
    let repoFilter = $state("");
    let selected = $state("");

    let filtered = $derived(repos.filter((repo) => repo.fullName.toLowerCase().includes(repoFilter.trim().toLowerCase())));

    function switchMode(next) {
        mode = next;
        value = "";
        error = "";
        account = null;
        repos = [];
        selected = "";
    }

    async function finish(config, user) {
        const repo = await fetchRepo(config);
        if (!repo.canWrite) throw Object.assign(new Error(), {status: 403});
        await setConfig(config);
        await setLocal("account", user);
        await send({type: "config-changed"});
        onconnected && onconnected(config, user);
    }

    async function connectNeno() {
        const text = value.trim();
        if (!text || busy) return;
        if (looksLikeGithubToken(text)) {
            mode = "github";
            return verifyGithub();
        }
        error = "";
        let config;
        try {
            config = decodeNenoToken(text);
        } catch (e) {
            error = e.message;
            return;
        }
        busy = true;
        try {
            await finish(config, await fetchAccount(config.access_token));
        } catch (e) {
            error = describeError(e);
        } finally {
            busy = false;
        }
    }

    async function verifyGithub() {
        const token = value.trim();
        if (!token || busy) return;
        busy = true;
        error = "";
        try {
            account = await fetchAccount(token);
            repos = await listRepos(token);
            const preferred = repos.find((repo) => repo.name === "neno-data") || repos[0];
            selected = preferred ? preferred.fullName : "";
        } catch (e) {
            error = describeError(e);
            account = null;
        } finally {
            busy = false;
        }
    }

    async function connectGithub() {
        const repo = repos.find((r) => r.fullName === selected);
        if (!repo || busy) return;
        busy = true;
        error = "";
        try {
            await finish({access_token: value.trim(), githubName: repo.owner, repoName: repo.name}, account);
        } catch (e) {
            error = describeError(e);
        } finally {
            busy = false;
        }
    }

    //粘贴后自动校验, 省去一次点击
    function onPaste() {
        setTimeout(() => (mode === "neno" ? connectNeno() : verifyGithub()), 0);
    }

    async function openNeno() {
        openTab((await getPrefs()).nenoUrl);
    }
</script>

<div class="connect" class:compact>
    {#if mode === "neno"}
        <div class="intro">
            <h2>连接你的 neno</h2>
            <p>只需一次。之后选中文字、右键或按快捷键, 就能把灵感存进 neno。</p>
        </div>

        <ol class="steps">
            <li><span>1</span>打开 <button class="linkish" onclick={openNeno}>neno <Icon name="external" size={12} /></button>, 进入 设置 → 同步</li>
            <li><span>2</span>点击「复制 neno token」</li>
            <li><span>3</span>粘贴到下面</li>
        </ol>

        <div class="field">
            <div class="input-wrap">
                <input
                        class="input"
                        type={reveal ? "text" : "password"}
                        placeholder="粘贴 neno token"
                        autocomplete="off"
                        spellcheck="false"
                        bind:value
                        onpaste={onPaste}
                        onkeydown={(event) => event.key === "Enter" && connectNeno()}
                        autofocus
                />
                <button class="icon-btn eye" onclick={() => (reveal = !reveal)} aria-label={reveal ? "隐藏" : "显示"}>
                    <Icon name={reveal ? "eyeOff" : "eye"} />
                </button>
            </div>
            <button class="btn btn-primary" disabled={!value.trim() || busy} onclick={connectNeno}>
                {#if busy}<Icon name="loader" class="spin" />验证中{:else}连接{/if}
            </button>
        </div>
        {#if error}<div class="error"><Icon name="alert" size={14} />{error}</div>{/if}

        <button class="alt" onclick={() => switchMode("github")}>
            <Icon name="github" size={14} /> 没有 neno token? 使用 GitHub Token 连接
        </button>
    {:else}
        <div class="intro">
            <button class="back" onclick={() => switchMode("neno")}><Icon name="arrowLeft" size={14} />使用 neno token</button>
            <h2>使用 GitHub Token</h2>
            <p>neno 的笔记保存在你自己的 GitHub 仓库里。需要一个有 <code>repo</code> 权限的 Token。</p>
        </div>

        {#if !account}
            <div class="field">
                <div class="input-wrap">
                    <input
                            class="input"
                            type={reveal ? "text" : "password"}
                            placeholder="ghp_… 或 github_pat_…"
                            autocomplete="off"
                            spellcheck="false"
                            bind:value
                            onpaste={onPaste}
                            onkeydown={(event) => event.key === "Enter" && verifyGithub()}
                            autofocus
                    />
                    <button class="icon-btn eye" onclick={() => (reveal = !reveal)} aria-label={reveal ? "隐藏" : "显示"}>
                        <Icon name={reveal ? "eyeOff" : "eye"} />
                    </button>
                </div>
                <button class="btn btn-primary" disabled={!value.trim() || busy} onclick={verifyGithub}>
                    {#if busy}<Icon name="loader" class="spin" />验证中{:else}下一步{/if}
                </button>
            </div>
            {#if error}<div class="error"><Icon name="alert" size={14} />{error}</div>{/if}
            <button class="alt" onclick={() => openTab(TOKEN_URL)}>
                <Icon name="external" size={14} /> 去 GitHub 生成 Token(已预选所需权限)
            </button>
        {:else}
            <div class="account">
                <img src={account.avatar} alt="" />
                <div>
                    <div class="name">{account.name}</div>
                    <div class="sub">@{account.login} · 选择 neno 的笔记仓库</div>
                </div>
            </div>
            {#if repos.length > 6}
                <input class="input filter" placeholder="搜索仓库" bind:value={repoFilter} />
            {/if}
            <div class="repos" role="radiogroup" aria-label="笔记仓库">
                {#each filtered as repo (repo.fullName)}
                    <button class="repo" class:active={selected === repo.fullName} role="radio" aria-checked={selected === repo.fullName}
                            onclick={() => (selected = repo.fullName)} ondblclick={connectGithub}>
                        <span class="radio"></span>
                        <span class="repo-name">{repo.fullName}</span>
                        {#if repo.private}<Icon name="lock" size={13} />{/if}
                    </button>
                {:else}
                    <div class="empty">没有可以写入的仓库, 请先在 neno 中完成同步设置</div>
                {/each}
            </div>
            {#if error}<div class="error"><Icon name="alert" size={14} />{error}</div>{/if}
            <button class="btn btn-primary wide" disabled={!selected || busy} onclick={connectGithub}>
                {#if busy}<Icon name="loader" class="spin" />连接中{:else}连接到 {selected.split("/")[1] || "仓库"}{/if}
            </button>
        {/if}
    {/if}
    <p class="privacy"><Icon name="lock" size={12} /> Token 只保存在你的浏览器中, 仅用于直接访问 GitHub。</p>
</div>

<style>
    .connect {
        display: flex;
        flex-direction: column;
        gap: 14px;
    }

    .intro h2 {
        margin: 0 0 4px;
        font-size: 17px;
        font-weight: 650;
        letter-spacing: 0.01em;
    }

    .intro p {
        margin: 0;
        color: var(--ink-2);
        font-size: 13px;
    }

    .compact .intro h2 {
        font-size: 16px;
    }

    code {
        font-size: 12px;
        padding: 1px 5px;
        border-radius: 5px;
        background: var(--surface-2);
    }

    .steps {
        list-style: none;
        margin: 0;
        padding: 12px 14px;
        border-radius: 12px;
        background: var(--surface-2);
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 13px;
        color: var(--ink-2);
    }

    .steps li {
        display: flex;
        align-items: center;
        gap: 9px;
    }

    .steps span {
        flex: none;
        display: grid;
        place-items: center;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--surface);
        color: var(--ink-3);
        font-size: 11px;
        font-weight: 600;
        box-shadow: inset 0 0 0 1px var(--line-strong);
    }

    .linkish {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        margin: 0 3px;
        padding: 0;
        border: 0;
        background: none;
        color: var(--accent-ink);
        font-weight: 500;
        cursor: pointer;
    }

    .linkish:hover {
        text-decoration: underline;
    }

    .field {
        display: flex;
        gap: 8px;
    }

    .field .btn {
        height: 38px;
        padding: 0 14px;
    }

    .input-wrap {
        position: relative;
        flex: 1;
    }

    .input-wrap .input {
        padding-right: 38px;
    }

    .eye {
        position: absolute;
        top: 4px;
        right: 4px;
    }

    .error {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: -6px;
        color: var(--danger);
        font-size: 12.5px;
    }

    .alt,
    .back {
        align-self: flex-start;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 0;
        border: 0;
        background: none;
        color: var(--ink-3);
        font-size: 12.5px;
        cursor: pointer;
    }

    .alt:hover,
    .back:hover {
        color: var(--ink);
    }

    .back {
        margin-bottom: 10px;
    }

    .account {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .account img {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: var(--surface-2);
    }

    .account .name {
        font-weight: 600;
    }

    .account .sub {
        color: var(--ink-3);
        font-size: 12px;
    }

    .filter {
        height: 34px;
    }

    .repos {
        display: flex;
        flex-direction: column;
        gap: 2px;
        max-height: 196px;
        overflow-y: auto;
        padding: 4px;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--surface);
    }

    .repo {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 7px 10px;
        border: 0;
        border-radius: 8px;
        background: none;
        color: var(--ink-2);
        text-align: left;
        cursor: pointer;
    }

    .repo:hover {
        background: var(--surface-2);
    }

    .repo.active {
        color: var(--ink);
        background: var(--accent-soft);
    }

    .repo-name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .radio {
        flex: none;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        box-shadow: inset 0 0 0 1.5px var(--line-strong);
        transition: box-shadow 0.15s;
    }

    .repo.active .radio {
        box-shadow: inset 0 0 0 4.5px var(--accent);
    }

    .empty {
        padding: 16px;
        color: var(--ink-3);
        font-size: 12.5px;
        text-align: center;
    }

    .wide {
        height: 38px;
    }

    .privacy {
        display: flex;
        align-items: center;
        gap: 5px;
        margin: 2px 0 0;
        color: var(--ink-3);
        font-size: 11.5px;
    }
</style>
