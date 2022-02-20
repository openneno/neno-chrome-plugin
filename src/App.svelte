<script>

    import './lib/TailwindCSS.svelte'

    let nenoToken = ""
    let config=""
    let history
    import {onMount} from 'svelte'

    onMount(() => {
         chrome.storage.sync.get("config", (value) => {
            console.log(value)
            config = value.config
        });
         chrome.storage.sync.get("history", (value) => {
            console.log(value)
            history = value.history
        });

    })

    function setToken(keyevent) {
        if (nenoToken === "") {
            return
        }
        if (keyevent.key !== "Enter") {
            return
        }

        config = JSON.parse(atob(nenoToken))
        console.log(config)
          chrome.storage.sync.set({config: config});
        chrome.contextMenus.create(
            { contexts: ["selection"], id: "neno_send", title: "发送到neno" },

        )
    }

    function clearToken() {
        config= ""
        console.log(config)
          chrome.storage.sync.set({config: ""});


    }

</script>
<div class="bg-indigo-50 h-full  w-64">
    {#if config===""}
        <div class="flex flex-col p-1 space-y-4 text-sm">
            <input id="token" type="text" class="p-1 rounded focus:outline-none" placeholder="输入你的neno token，回车保存"
                   on:keyup={setToken} bind:value={nenoToken}/>
        </div>
    {:else}
        <div class="flex flex-col p-1 space-y-4 text-sm">
            <button on:click={()=>{clearToken()}}> 清除我的token(包括本地记录)</button>
        </div>
    {/if}

</div>
