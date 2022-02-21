var ObjectId = (function () {
    var increment = Math.floor(Math.random() * (16777216));
    var pid = Math.floor(Math.random() * (65536));
    var machine = Math.floor(Math.random() * (16777216));

    var setMachineCookie = function() {
       chrome.storage.sync.set({mongoMachineId: machine});
};

     chrome.storage.sync.get("mongoMachineId", (value) => {
        if (value.mongoMachineId) {
            machine = value.mongoMachineId;
        } else {
            setMachineCookie();
        }

    });

    function ObjId() {
        if (!(this instanceof ObjectId)) {
            return new ObjectId(arguments[0], arguments[1], arguments[2], arguments[3]).toString();
        }

        if (typeof (arguments[0]) == 'object') {
            this.timestamp = arguments[0].timestamp;
            this.machine = arguments[0].machine;
            this.pid = arguments[0].pid;
            this.increment = arguments[0].increment;
        }
        else if (typeof (arguments[0]) == 'string' && arguments[0].length == 24) {
            this.timestamp = Number('0x' + arguments[0].substr(0, 8)),
                this.machine = Number('0x' + arguments[0].substr(8, 6)),
                this.pid = Number('0x' + arguments[0].substr(14, 4)),
                this.increment = Number('0x' + arguments[0].substr(18, 6))
        }
        else if (arguments.length == 4 && arguments[0] != null) {
            this.timestamp = arguments[0];
            this.machine = arguments[1];
            this.pid = arguments[2];
            this.increment = arguments[3];
        }
        else {
            this.timestamp = Math.floor(new Date().valueOf() / 1000);
            this.machine = machine;
            this.pid = pid;
            this.increment = increment++;
            if (increment > 0xffffff) {
                increment = 0;
            }
        }
    };
    return ObjId;
})();

ObjectId.prototype.getDate = function () {
    return new Date(this.timestamp * 1000);
};

ObjectId.prototype.toArray = function () {
    var strOid = this.toString();
    var array = [];
    var i;
    for(i = 0; i < 12; i++) {
        array[i] = parseInt(strOid.slice(i*2, i*2+2), 16);
    }
    return array;
};

/**
 * Turns a WCF representation of a BSON ObjectId into a 24 character string representation.
 */
ObjectId.prototype.toString = function () {
    if (this.timestamp === undefined
        || this.machine === undefined
        || this.pid === undefined
        || this.increment === undefined) {
        return 'Invalid ObjectId';
    }

    var timestamp = this.timestamp.toString(16);
    var machine = this.machine.toString(16);
    var pid = this.pid.toString(16);
    var increment = this.increment.toString(16);
    return '00000000'.substr(0, 8 - timestamp.length) + timestamp +
        '000000'.substr(0, 6 - machine.length) + machine +
        '0000'.substr(0, 4 - pid.length) + pid +
        '000000'.substr(0, 6 - increment.length) + increment;
};


let config=""
const initStorageCache = getConfigSyncData().then(items => {
    // Copy the data retrieved from storage into storageCache.

    Object.assign(config, items.config);
});
function getConfigSyncData() {
    // Immediately return a promise and start asynchronous work
    return new Promise((resolve, reject) => {
        // Asynchronously fetch all data from storage.sync.
        chrome.storage.sync.get("config", (value) => {

            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            resolve(value);
        });

    });
}
function b64EncodeUnicode(str) {
    // first we use encodeURIComponent to get percent-encoded UTF-8,
    // then we convert the percent encodings into raw bytes which
    // can be fed into btoa.
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) {
            return String.fromCharCode('0x' + p1);
        }));
}

chrome.runtime.onInstalled.addListener(async () => {
    config=(await getConfigSyncData()).config
    console.log(config)
    if (config){
        chrome.contextMenus.create(
            { contexts: ["selection"], id: "neno_send", title: "发送到neno" },

        )
    }
});
chrome.contextMenus.onClicked.addListener(
    async (data) => {
        console. log(data);
        let selectionText=data.selectionText;
        let pageUrl=data.pageUrl;
        await sendNenoToGithub(selectionText,pageUrl);
    }
)
async function sendNenoToGithub(content,url){

    config=(await getConfigSyncData()).config
    console.log(config)
    let date = new Date()
    let created_at = `${date.getFullYear()}-${(date.getMonth() + 1) < 10 ? '0' + (date.getMonth() + 1) : (date.getMonth() + 1)}-${date.getDate() < 10 ? '0' + date.getDate()  : date.getDate() }T${date.getHours() < 10 ? '0' + date.getHours()  : date.getHours() }:${date.getMinutes() < 10 ? '0' + date.getMinutes()  : date.getMinutes() }:${date.getSeconds() < 10 ? '0' + date.getSeconds()  : date.getSeconds() }+08:00`
    let datefile = `${date.getFullYear()}-${(date.getMonth() + 1) < 10 ? '0' + (date.getMonth() + 1) : (date.getMonth() + 1)}-${date.getDate() < 10 ? '0' + date.getDate()  : date.getDate() }`
    let _id = (new ObjectId()).toString()
    let tags = [];

    let mt = content.match(/#\S*/g);
    if (mt != null) {
        tags = [...tags, ...mt];
    }
    let neno = {
        "content": `<p>${content}</p><br/><p>来自<a href="${url}">${url}</a></p>`,
        "pureContent": content,
        "_id": _id,
        "parentId": "",
        "source": "chrome",
        "tags": tags,
        "images": [],
        "created_at": created_at,
        "sha": "",
        "update_at": created_at
    }
    // let buff = new Buffer(JSON.stringify(neno, null, "\t"));
    let base64content = b64EncodeUnicode(JSON.stringify(neno, null, "\t"));
    var raw = JSON.stringify({
        "content": base64content,
        "message": `[ADD] ${content}`
    }, null, "\t");
    console.log(raw);

    var requestOptions = {
        method: 'PUT',
        headers: {
            authorization: `token ${config.access_token}`,
            accept: "application/vnd.github.v3+json"
        },
        body: raw,
        redirect: 'follow'
    };

    await fetch(`${config.gitUrl}/repos/${config.githubName}/${config.repoName}/contents/${datefile}/${_id}.json`, requestOptions)

    chrome.notifications.create(
        "neno_send",
        {
            type: "basic",
            iconUrl: "/images/neno.png",
            title: "发送成功",
            message: content,
            priority: 1,
            silent: true
        },
        function (id) {
            console.log(id);
        }
    )
}
