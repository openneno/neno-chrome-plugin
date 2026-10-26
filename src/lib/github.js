//GitHub REST 接口: 校验 Token, 列出仓库, 读写笔记文件
//测试构建可以通过 VITE_GITHUB_API 指向本地模拟的 GitHub, 正式构建中始终是 GitHub
export const GITHUB_API = (import.meta.env.MODE === "test" && import.meta.env.VITE_GITHUB_API) || "https://api.github.com";

export class GithubError extends Error {
    constructor(message, status) {
        super(message);
        this.name = "GithubError";
        this.status = status;
    }
}

export async function rest(token, method, path, body) {
    let response;
    try {
        response = await fetch(GITHUB_API + path, {
            method,
            headers: {
                Accept: "application/vnd.github+json",
                Authorization: `token ${token.trim()}`,
                ...(body === undefined ? {} : {"Content-Type": "application/json"}),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            cache: "no-store",
        });
    } catch (error) {
        throw new GithubError("网络连接失败", 0);
    }
    if (!response.ok) {
        let message = response.statusText;
        try {
            message = (await response.json()).message || message;
        } catch (e) {
            //忽略无法解析的错误内容
        }
        throw new GithubError(message, response.status);
    }
    const data = response.status === 204 ? null : await response.json();
    return {data, headers: response.headers};
}

//把接口错误转换成用户能看懂的提示
export function describeError(error) {
    const status = error && error.status;
    if (status === 401) return "Token 无效或已过期";
    if (status === 403) return "Token 没有写入仓库的权限";
    if (status === 404) return "找不到笔记仓库, 请检查 Token 的访问范围";
    if (status === 409 || status === 422) return "仓库中已存在同名文件";
    if (!status || status >= 500) return "网络连接失败";
    return (error && error.message) || "未知错误";
}

//网络或服务端的临时错误, 可以稍后重试
export function isRetryable(error) {
    const status = error && error.status;
    return !status || status >= 500 || status === 429;
}

export async function fetchAccount(token) {
    const {data} = await rest(token, "GET", "/user");
    return {login: data.login, name: data.name || data.login, avatar: data.avatar_url};
}

export async function fetchRepo(config) {
    const {data} = await rest(config.access_token, "GET", `/repos/${config.githubName}/${config.repoName}`);
    return {
        fullName: data.full_name,
        private: !!data.private,
        canWrite: !data.permissions || !!(data.permissions.push || data.permissions.admin),
    };
}

//Token 可以写入的仓库, 最近更新的在前
export async function listRepos(token) {
    const {data} = await rest(token, "GET", "/user/repos?sort=updated&per_page=100");
    return data
        .filter((repo) => !repo.permissions || repo.permissions.push || repo.permissions.admin)
        .map((repo) => ({owner: repo.owner.login, name: repo.name, fullName: repo.full_name, private: !!repo.private}));
}

function utf8ToBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
}

function base64ToUtf8(base64) {
    const binary = atob(base64.replace(/\s/g, ""));
    return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

function contentsPath(config, path) {
    return `/repos/${config.githubName}/${config.repoName}/contents/${path}`;
}

//创建或更新文件(更新时需要原来的 sha), 返回新的 sha
export async function putFile(config, path, text, message, sha) {
    const {data} = await rest(config.access_token, "PUT", contentsPath(config, path), {
        message,
        content: utf8ToBase64(text),
        ...(sha ? {sha} : {}),
    });
    return data.content.sha;
}

export async function deleteFile(config, path, sha, message) {
    await rest(config.access_token, "DELETE", contentsPath(config, path), {message, sha});
}

//置顶标签, 用于输入 # 时的补全
export async function fetchPinTags(config) {
    try {
        const {data} = await rest(config.access_token, "GET", contentsPath(config, "pinTags/pinTags.json"));
        const tags = JSON.parse(base64ToUtf8(data.content)).tags;
        return Array.isArray(tags) ? tags.filter((tag) => typeof tag === "string") : [];
    } catch (error) {
        if (error.status === 404) return [];
        throw error;
    }
}
