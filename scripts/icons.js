//从 scripts/icon.svg 生成扩展需要的各尺寸图标
import {readFileSync, writeFileSync, mkdirSync} from "node:fs";
import {resolve} from "node:path";
import {Resvg} from "@resvg/resvg-js";

const root = resolve(import.meta.dirname, "..");
const svg = readFileSync(resolve(root, "scripts/icon.svg"), "utf8");
mkdirSync(resolve(root, "public/icons"), {recursive: true});
for (const size of [16, 32, 48, 128]) {
    const png = new Resvg(svg, {fitTo: {mode: "width", value: size}}).render().asPng();
    writeFileSync(resolve(root, `public/icons/${size}.png`), png);
}
console.log("icons generated");
