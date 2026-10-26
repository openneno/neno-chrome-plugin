<script>
    let {checked = $bindable(false), label, onchange} = $props();
</script>

<button
        type="button"
        role="switch"
        class="switch"
        class:on={checked}
        aria-checked={checked}
        aria-label={label}
        onclick={(event) => {
            event.stopPropagation();
            checked = !checked;
            onchange && onchange(checked);
        }}
>
    <span></span>
</button>

<style>
    .switch {
        flex: none;
        position: relative;
        width: 32px;
        height: 18px;
        padding: 0;
        border: 0;
        border-radius: 999px;
        background: var(--surface-3);
        cursor: pointer;
        transition: background 0.2s var(--ease);
    }

    .switch span {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 2px rgb(0 0 0 / 0.2);
        transition: transform 0.2s var(--ease);
    }

    .switch.on {
        background: var(--accent);
    }

    .switch.on span {
        transform: translateX(14px);
    }
</style>
