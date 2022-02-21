# neno-chrome-plugin
用于在浏览器中向neno发送笔记
## 打包安装
> git clone  https://github.com/openneno/neno-chrome-plugin.git
> 
> cd neno-chrome-plugin
> 
> npm install
> 
> npm run build
>

## or下载安装
1. 下载neno-chrome-plugin.zip
2. 将neno-chrome-plugin.zip解压
3. 在chrome中打开[chrome://extensions/](chrome://extensions/) ，点击“加载已解压的扩展程序”，选择解压好的目录

## 使用
1. 第一次使用需要配置neno的token，可以在已经配置了仓库的neno的设置页面找到`复制 neno token`按钮。
2. 点击浏览器右上角的`neno`图标（没有找到可以在扩展程序中把neno置顶）可以打开neno的设置页面，把复制的token粘贴到输入框中，回车即可保存。
3. 当你在浏览器中选择了文本时，可以通过鼠标右键点击文本，可以选择是否将文本发送到neno。
4. 发送成功后会显示发送成功的提示。
