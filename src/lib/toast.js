//注入到网页中的保存提示, 通过 chrome.scripting.executeScript({func: nenoToast, args: [state]}) 调用
//函数会被序列化后在页面里执行, 因此必须完全自包含, 不能引用外部变量
//state: {id, status: saving|saved|failed|undone, summary, tags, error, retryable, amended, accent, theme}
export function nenoToast(state) {
    const w = window;
    if (!w.__nenoToast) {
        const host = document.createElement("div");
        host.style.cssText = "all:initial;position:fixed;z-index:2147483647;right:20px;bottom:20px;";
        const root = host.attachShadow({mode: "open"});
        root.innerHTML = `<style>
:host{--accent:#16a34a}
[hidden]{display:none!important}
.card{--surface:#fff;--surface-2:#f0f0ec;--line:rgb(28 25 23/.09);--ink:#1d1f23;--ink-2:#565b63;--ink-3:#757a82;
  box-sizing:border-box;width:340px;max-width:calc(100vw - 40px);background:var(--surface);color:var(--ink);
  border:1px solid var(--line);border-radius:14px;overflow:hidden;
  box-shadow:0 18px 40px -12px rgb(28 25 23/.28),0 2px 6px rgb(28 25 23/.06);
  font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei UI","Microsoft YaHei",sans-serif;
  -webkit-font-smoothing:antialiased;animation:in .26s cubic-bezier(.2,.8,.2,1)}
.card.dark{--surface:#1b1d22;--surface-2:#24272d;--line:rgb(255 255 255/.09);--ink:#e7e8ea;--ink-2:#a8adb5;--ink-3:#868c95;
  box-shadow:0 18px 40px -12px rgb(0 0 0/.7),0 2px 6px rgb(0 0 0/.4)}
.card.out{animation:out .2s ease forwards}
@keyframes in{from{opacity:0;transform:translateY(10px) scale(.98)}}
@keyframes out{to{opacity:0;transform:translateY(6px) scale(.98)}}
.body{padding:12px 12px 12px 14px}
.head{display:flex;align-items:center;gap:8px}
.icon{width:18px;height:18px;flex:none;display:grid;place-items:center;color:var(--accent)}
.icon svg{width:18px;height:18px}
.failed .icon{color:#e5484d}
.spin{animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.title{flex:1;font-weight:600;font-size:13.5px;min-width:0}
.close{all:unset;cursor:pointer;width:24px;height:24px;border-radius:7px;display:grid;place-items:center;color:var(--ink-3)}
.close:hover{background:var(--surface-2);color:var(--ink)}
.close svg{width:14px;height:14px}
.detail{margin:2px 0 0 26px;color:var(--ink-3);font-size:12px}
.summary{margin:8px 0 0 26px;padding-left:9px;border-left:2px solid color-mix(in srgb,var(--accent) 45%,transparent);
  color:var(--ink-2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.tags{margin:6px 0 0 26px;display:flex;flex-wrap:wrap;gap:4px}
.tag{font-size:11.5px;padding:0 7px;border-radius:999px;line-height:20px;color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,transparent)}
.actions{display:flex;gap:6px;margin:10px 0 0 26px}
.btn{all:unset;cursor:pointer;font-size:12.5px;font-weight:500;padding:4px 10px;border-radius:8px;color:var(--ink-2);background:var(--surface-2);transition:background .15s,color .15s}
.btn:hover{color:var(--ink);background:color-mix(in srgb,var(--ink) 10%,var(--surface-2))}
.btn.primary{color:#fff;background:var(--accent)}
.btn.primary:hover{background:color-mix(in srgb,#000 12%,var(--accent))}
.btn:focus-visible,.close:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.btn[disabled]{opacity:.5;pointer-events:none}
.kbd{margin-left:auto;align-self:center;color:var(--ink-3);font-size:11.5px}
textarea{all:unset;box-sizing:border-box;display:block;width:calc(100% - 26px);margin:10px 0 0 26px;min-height:64px;max-height:160px;
  padding:8px 10px;border-radius:10px;background:var(--surface-2);color:var(--ink);font:inherit;line-height:1.6;white-space:pre-wrap;overflow:auto;
  border:1px solid transparent;transition:border-color .15s}
textarea:focus{border-color:color-mix(in srgb,var(--accent) 60%,transparent)}
textarea::placeholder{color:var(--ink-3)}
.bar{height:2px;background:var(--accent);opacity:.55;transform-origin:left;transform:scaleX(0)}
.bar.run{animation:bar linear forwards}
.card:hover .bar.run,.card:focus-within .bar.run{animation-play-state:paused}
@keyframes bar{from{transform:scaleX(1)}to{transform:scaleX(0)}}
@media (prefers-reduced-motion:reduce){.card,.card.out,.spin{animation:none}.bar.run{animation:none;transform:scaleX(0)}}
</style><div class="card" role="status" aria-live="polite"><div class="body">
<div class="head"><span class="icon"></span><span class="title"></span>
<button class="close" aria-label="关闭"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
<div class="detail" hidden></div><div class="summary" hidden></div><div class="tags" hidden></div>
<textarea hidden placeholder="写下你的想法, 可以用 #标签" rows="3"></textarea>
<div class="actions" hidden></div></div><div class="bar"></div></div>`;
        document.documentElement.appendChild(host);

        const $ = (selector) => root.querySelector(selector);
        const card = $(".card");
        const ICONS = {
            saving: '<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9" /></svg>',
            saved: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" opacity=".25"/><path d="M8 12.5l2.8 2.8L16.5 9.5"/></svg>',
            failed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9" opacity=".25"/><path d="M12 7.5v5.5M12 16.5v.01"/></svg>',
            undone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
        };
        let current = null;
        let editing = false;
        let timer = null;
        let hovering = false;

        const send = (message) => {
            try {
                chrome.runtime.sendMessage(message);
            } catch (e) {
                //扩展被重新加载后旧页面里的提示无法再通信
                dismiss();
            }
        };

        function dismiss() {
            clearTimeout(timer);
            card.classList.add("out");
            setTimeout(() => {
                host.remove();
                w.__nenoToast = null;
            }, 200);
        }

        //自动关闭: 鼠标悬停或正在输入时暂停
        function schedule(ms) {
            clearTimeout(timer);
            const bar = $(".bar");
            bar.classList.remove("run");
            if (!ms || editing) return;
            void bar.offsetWidth;
            bar.style.animationDuration = `${ms}ms`;
            bar.classList.add("run");
            let left = ms;
            let start = Date.now();
            const tick = () => {
                if (hovering || editing || root.activeElement) {
                    left -= Date.now() - start;
                    start = Date.now();
                    timer = setTimeout(tick, 250);
                    return;
                }
                left -= Date.now() - start;
                start = Date.now();
                if (left <= 0) dismiss();
                else timer = setTimeout(tick, Math.min(left, 250));
            };
            timer = setTimeout(tick, 250);
        }

        function button(label, onClick, primary) {
            const el = document.createElement("button");
            el.className = primary ? "btn primary" : "btn";
            el.textContent = label;
            el.addEventListener("click", onClick);
            return el;
        }

        const textarea = $("textarea");
        const autosize = () => {
            textarea.style.height = "auto";
            textarea.style.height = `${textarea.scrollHeight + 2}px`;
        };
        textarea.addEventListener("input", autosize);

        function submitAmend() {
            const text = textarea.value.trim();
            editing = false;
            if (!text) return render();
            send({type: "amend", id: current.id, text});
            update({...current, status: "saving", amending: true});
        }

        function render() {
            const s = current;
            card.classList.toggle("failed", s.status === "failed");
            $(".icon").innerHTML = ICONS[s.status] || ICONS.saved;
            const titles = {
                saving: s.amending ? "正在更新…" : "正在保存到 neno…",
                saved: s.amended ? "想法已补充" : "已保存到 neno",
                failed: "暂时没能保存",
                undone: "已撤销, 笔记已删除",
            };
            $(".title").textContent = titles[s.status] || "";

            const detail = $(".detail");
            detail.hidden = s.status !== "failed";
            detail.textContent = s.status === "failed" ? `${s.error || "未知错误"}${s.retryable ? " · 联网后会自动重试" : ""}` : "";

            const summary = $(".summary");
            summary.hidden = !s.summary || s.status === "undone";
            summary.textContent = s.summary || "";

            const tags = $(".tags");
            tags.replaceChildren(...(s.tags || []).map((tag) => {
                const el = document.createElement("span");
                el.className = "tag";
                el.textContent = tag;
                return el;
            }));
            tags.hidden = !s.tags || s.tags.length === 0 || s.status === "undone";

            textarea.hidden = !editing;
            const actions = $(".actions");
            actions.replaceChildren();
            if (editing) {
                actions.append(button("保存想法", submitAmend, true), button("取消", () => {
                    editing = false;
                    render();
                }));
                const hint = document.createElement("span");
                hint.className = "kbd";
                hint.textContent = "Enter 保存 · Shift+Enter 换行";
                actions.append(hint);
            } else if (s.status === "saved") {
                actions.append(
                    button("补充想法", () => {
                        editing = true;
                        render();
                        textarea.focus();
                        autosize();
                    }, true),
                    button("撤销", (event) => {
                        event.currentTarget.disabled = true;
                        send({type: "undo", id: s.id});
                    }),
                );
            } else if (s.status === "failed") {
                actions.append(
                    button("重试", () => send({type: "retry", id: s.id}), true),
                    button("放弃", () => {
                        send({type: "undo", id: s.id});
                        dismiss();
                    }),
                );
            }
            actions.hidden = actions.childElementCount === 0;
            schedule({saved: 6000, undone: 1800, failed: 12000}[s.status] || 0);
        }

        function update(state) {
            card.classList.remove("out");
            if (current && current.id !== state.id) {
                editing = false;
                textarea.value = "";
            }
            current = state;
            host.style.setProperty("--accent", state.accent || "#16a34a");
            const dark = state.theme === "dark" || (state.theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
            card.classList.toggle("dark", dark);
            render();
        }

        card.addEventListener("mouseenter", () => (hovering = true));
        card.addEventListener("mouseleave", () => (hovering = false));
        $(".close").addEventListener("click", dismiss);
        //不让网页的快捷键响应提示里的输入
        for (const type of ["keydown", "keyup", "keypress"]) {
            root.addEventListener(type, (event) => event.stopPropagation());
        }
        root.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                if (editing) {
                    editing = false;
                    render();
                } else dismiss();
            } else if (event.key === "Enter" && editing && !event.shiftKey && !event.isComposing) {
                event.preventDefault();
                submitAmend();
            }
        });
        w.__nenoToast = {update};
    }
    w.__nenoToast.update(state);
}

//读取页面中选中的文字(包括输入框里的选区), 保留换行
export function readSelection() {
    let text = "";
    const selection = window.getSelection();
    if (selection) text = selection.toString();
    const el = document.activeElement;
    if (!text && el && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && /^(text|search|url)$/.test(el.type)))) {
        try {
            text = el.value.substring(el.selectionStart, el.selectionEnd);
        } catch (e) {
            text = "";
        }
    }
    return {text, title: document.title, url: location.href};
}
