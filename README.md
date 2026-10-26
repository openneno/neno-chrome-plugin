# neno 浏览器插件

随手把网页上的文字、链接和想法记到 [neno](https://github.com/Mran/neno)。

笔记直接写入你自己的 GitHub 笔记仓库, 格式与 neno 网页版完全一致, 打开 neno 同步后即可看到。

## 怎么用

| 场景 | 操作 |
| --- | --- |
| 摘录一段文字 | 选中文字 → 右键「保存选中的文字到 neno」, 或按 <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> |
| 收藏链接 / 页面 | 在链接或页面空白处右键「保存这个链接 / 页面到 neno」 |
| 写一条想法 | 点击工具栏的 neno 图标, 或按 <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>N</kbd>, 写完 <kbd>Ctrl</kbd>+<kbd>Enter</kbd> 保存 |

- **保存后补一句想法**: 右键保存后页面右下角会出现提示, 可以立即补充想法、加上 `#标签`, 或者撤销。
- **选中文字后打开速记**: 选中的文字会自动作为摘录带入, 页面标题和链接作为来源附在笔记末尾(可以随时关掉)。
- **标签补全**: 输入 `#` 时提示 neno 中的置顶标签和最近用过的标签, <kbd>Tab</kbd> 补全。
- **离线也能记**: 网络不通时笔记先存在本地, 联网后自动保存。
- **撤销**: 保存后可以立即撤销, 内容会回到输入框里。
- 浅色 / 深色 / 跟随系统, 6 种与 neno 网页版一致的主题色。

## 连接 neno

1. 打开 neno 网页版 → 设置 → 同步, 点击「复制 neno token」
2. 安装插件后会自动打开设置页, 把 neno token 粘贴进去即可

也可以直接使用 GitHub Token(需要 `repo` 权限)并选择笔记仓库。Token 只保存在浏览器中, 插件只与 `api.github.com` 通信。

从旧版插件升级的用户无需重新配置。

## 安装

### 下载安装

1. 在 [Releases](https://github.com/openneno/neno-chrome-plugin/releases) 下载 `neno-chrome-plugin-x.y.z.zip` 并解压
2. 打开 `chrome://extensions/`, 开启右上角的「开发者模式」
3. 点击「加载已解压的扩展程序」, 选择解压后的目录

### 自己构建

```bash
bun install        # 或 npm install
bun run build      # 输出到 dist/, 在 chrome://extensions/ 中加载 dist 目录
bun run zip        # 构建并打包成 zip
```

开发时可以使用 `bun run dev`, 修改代码后自动重新构建, 在扩展页面点击刷新即可。

## 项目结构

```
src/
  background.js        右键菜单、快捷键、保存队列(离线重试)、撤销与补充想法
  popup/               点击图标打开的速记弹窗
  options/             设置页: 连接、偏好、外观、快捷键
  components/          Connect(连接向导)、TagTextarea(标签高亮与补全)等
  lib/
    note.js            生成与 neno 相同格式的笔记 (YYYY-MM-DD/<ObjectId>.json)
    github.js          GitHub REST 接口
    toast.js           注入网页的保存提示(Shadow DOM, 不受网页样式影响)
    store.js           chrome.storage 中的配置与偏好
public/manifest.json   Manifest V3
scripts/               图标生成(icon.svg → png)与打包
```

