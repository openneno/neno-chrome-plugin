<script>
    //输入框: 高亮 #标签, 输入 # 时提示已有标签(↑↓ 选择, Tab / Enter 补全)
    let {value = $bindable(""), tags = [], placeholder = "", onsubmit, oninput} = $props();

    let textarea = $state();
    let mirror = $state();
    let caretTag = $state(null);
    let active = $state(0);

    let suggestions = $derived.by(() => {
        if (!caretTag) return [];
        const query = caretTag.query.toLowerCase();
        return tags.filter((tag) => tag.toLowerCase().startsWith(query) && tag.toLowerCase() !== query).slice(0, 6);
    });

    //把文字拆成普通文字和标签两段, 用于背后的高亮层
    let segments = $derived.by(() => {
        const parts = [];
        const re = /#\S+/g;
        let last = 0;
        let match;
        while ((match = re.exec(value))) {
            if (match.index > last) parts.push({text: value.slice(last, match.index)});
            parts.push({text: match[0], tag: true});
            last = match.index + match[0].length;
        }
        parts.push({text: value.slice(last) + "\n"});
        return parts;
    });

    function updateCaret() {
        if (!textarea) return;
        const pos = textarea.selectionStart;
        if (pos !== textarea.selectionEnd) return (caretTag = null);
        const match = value.slice(0, pos).match(/(?:^|\s)(#\S*)$/);
        if (!match) return (caretTag = null);
        const after = value.slice(pos).match(/^\S*/)[0];
        const next = {start: pos - match[1].length, end: pos + after.length, query: match[1]};
        if (!caretTag || caretTag.query !== next.query) active = 0;
        caretTag = next;
    }

    function apply(tag) {
        const {start, end} = caretTag;
        const rest = value.slice(end);
        const insert = rest.startsWith(" ") || rest.startsWith("\n") ? tag : `${tag} `;
        value = value.slice(0, start) + insert + rest;
        caretTag = null;
        const pos = start + insert.length + (insert === tag ? 1 : 0);
        requestAnimationFrame(() => {
            textarea.focus();
            textarea.setSelectionRange(pos, pos);
            oninput && oninput(value);
        });
    }

    function onkeydown(event) {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            onsubmit && onsubmit();
            return;
        }
        if (suggestions.length === 0 || event.isComposing) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const step = event.key === "ArrowDown" ? 1 : -1;
            active = (active + step + suggestions.length) % suggestions.length;
        } else if (event.key === "Tab" || event.key === "Enter") {
            event.preventDefault();
            apply(suggestions[active]);
        } else if (event.key === "Escape") {
            //只关闭提示, 不关闭弹窗
            event.preventDefault();
            event.stopPropagation();
            caretTag = null;
        }
    }

    function syncScroll() {
        if (mirror) mirror.scrollTop = textarea.scrollTop;
    }

    export function focus(atEnd = true) {
        textarea.focus();
        if (atEnd) textarea.setSelectionRange(value.length, value.length);
    }

    export function insertHash() {
        const pos = textarea.selectionStart;
        const before = value.slice(0, pos);
        const prefix = before && !/\s$/.test(before) ? " #" : "#";
        value = before + prefix + value.slice(textarea.selectionEnd);
        requestAnimationFrame(() => {
            textarea.focus();
            textarea.setSelectionRange(pos + prefix.length, pos + prefix.length);
            updateCaret();
        });
    }
</script>

<div class="wrap">
    <div class="mirror" bind:this={mirror} aria-hidden="true">
        {#each segments as part}{#if part.tag}<mark>{part.text}</mark>{:else}{part.text}{/if}{/each}
    </div>
    <textarea
            bind:this={textarea}
            bind:value
            {placeholder}
            rows="3"
            spellcheck="false"
            oninput={() => {
                updateCaret();
                oninput && oninput(value);
            }}
            onkeydown={onkeydown}
            onkeyup={(event) => !["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key) && updateCaret()}
            onclick={updateCaret}
            onblur={() => setTimeout(() => (caretTag = null), 120)}
            onscroll={syncScroll}
    ></textarea>

    {#if suggestions.length > 0}
        <div class="suggest" role="listbox">
            {#each suggestions as tag, index (tag)}
                <button
                        role="option"
                        aria-selected={index === active}
                        class:active={index === active}
                        onmousedown={(event) => {
                            event.preventDefault();
                            apply(tag);
                        }}
                        onmouseenter={() => (active = index)}
                >{tag}</button>
            {/each}
            <span class="hint">Tab 补全</span>
        </div>
    {/if}
</div>

<style>
    .wrap {
        position: relative;
    }

    textarea,
    .mirror {
        display: block;
        width: 100%;
        margin: 0;
        padding: 0;
        border: 0;
        font-size: 15px;
        line-height: 1.7;
        letter-spacing: 0.01em;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
    }

    textarea {
        position: relative;
        field-sizing: content;
        min-height: calc(1.7em * 3);
        max-height: 220px;
        resize: none;
        background: transparent;
        color: var(--ink);
        outline: none;
        overflow-y: auto;
    }

    textarea::placeholder {
        color: var(--ink-3);
    }

    .mirror {
        position: absolute;
        inset: 0;
        overflow: hidden;
        color: transparent;
        pointer-events: none;
    }

    mark {
        color: transparent;
        background: var(--accent-soft);
        border-radius: 4px;
        box-shadow: 0 0 0 1.5px var(--accent-soft);
    }

    .suggest {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
        margin-top: 8px;
        animation: rise 0.16s var(--ease);
    }

    .suggest button {
        height: 24px;
        padding: 0 9px;
        border: 0;
        border-radius: 999px;
        background: var(--surface-2);
        color: var(--ink-2);
        font-size: 12.5px;
        cursor: pointer;
    }

    .suggest button.active {
        background: var(--accent-soft);
        color: var(--accent-ink);
    }

    .hint {
        margin-left: auto;
        color: var(--ink-3);
        font-size: 11px;
    }

    @keyframes rise {
        from {
            opacity: 0;
            transform: translateY(-3px);
        }
    }
</style>
