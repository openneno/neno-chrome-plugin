//neno token: neno 设置页 "复制 neno token" 得到的配置, base64(JSON{access_token, githubName, repoName, gitUrl})
//也支持直接粘贴同步链接(…#neno-config=xxx)

function decodeBase64Utf8(text) {
    const binary = atob(text.replace(/\s/g, ""));
    return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

//GitHub 自己的 Token 前缀: 经典 Token / 细粒度 Token / OAuth
export function looksLikeGithubToken(text) {
    return /^(ghp_|github_pat_|gho_|ghu_)[A-Za-z0-9_]+$/.test(text.trim());
}

export function decodeNenoToken(text) {
    let value = text.trim();
    const index = value.indexOf("#neno-config=");
    if (index !== -1) value = decodeURIComponent(value.substring(index + "#neno-config=".length));
    let data;
    try {
        data = JSON.parse(decodeBase64Utf8(value));
    } catch (e) {
        throw new Error("无法识别, 请粘贴完整的 neno token");
    }
    if (data.gitUrl && data.gitUrl !== "https://api.github.com") {
        throw new Error("neno 已不再支持 Gitee, 请在 neno 中改用 GitHub 后重新复制");
    }
    if (!data.access_token || !data.githubName || !data.repoName) {
        throw new Error("neno token 不完整, 请重新复制");
    }
    return {access_token: data.access_token, githubName: data.githubName, repoName: data.repoName};
}
