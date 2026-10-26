//把 dist 打包成可以直接上传商店或解压安装的 zip
import {readdirSync, readFileSync, statSync, writeFileSync} from "node:fs";
import {join, relative, resolve} from "node:path";
import {zipSync} from "fflate";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const files = {};
(function walk(dir) {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else files[relative(dist, full).replaceAll("\\", "/")] = readFileSync(full);
    }
})(dist);
const {version} = JSON.parse(readFileSync(resolve(dist, "manifest.json"), "utf8"));
const out = resolve(root, `neno-chrome-plugin-${version}.zip`);
writeFileSync(out, zipSync(files, {level: 9}));
console.log(`packed ${Object.keys(files).length} files -> ${relative(root, out)}`);
