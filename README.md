SPDX-License-Identifier: CC-BY-SA-4.0

# 联考水表机客户端

*Last Update：2026-08-19*

> 本程序在 GNU General Public License, version 3 or later 之下发布，不提供任何担保。完整声明和条款请见 LICENSE 和 COPYING 文件。
>
> 例外：本 README 文件在 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) 协议下发布。

需要与服务端 [juan-ng-server](https://github.com/Waxed-Oxidized-Cut-Copper-Stairs/juan-ng-server) 配套使用。

Firefox 无法使用此插件，因为它不支持 Service Worker。

最低 Chrome/Edge 版本要求为 109。

**服务端修改 `config/data.js` 后，请重新启动客户端以应用更改。**

**本插件与洛谷、CodeForces 和 AtCoder 官方无任何关联。**

**任何因用户修改或滥用所造成的损害，原作者概不负责。**

## 技术简介

客户端是按 Manifest V3 标准编写的浏览器扩展，有 content、popup、Service Worker、offscreen 四个部分。

客户端会从服务端拉取需要爬取的用户数据，并把到洛谷网站的请求通过服务端转发。

## 部署指南

请先检查环境要求并安装服务端。

执行如下命令以克隆仓库。

```bash
git clone --depth=1 -b release https://github.com/Waxed-Oxidized-Cut-Copper-Stairs/juan-ng-client.git
```

Git 克隆相关问题请见 [juan-ng-server 的常见问题 QA](https://github.com/Waxed-Oxidized-Cut-Copper-Stairs/juan-ng-server/blob/main/README.md#%E5%B8%B8%E8%A7%81%E9%97%AE%E9%A2%98-qa)。

**更新时请按 [更新指南](#更新指南) 操作。**

在浏览器扩展页面开启开发者模式，点击“加载解压缩的扩展”，在弹出的对话框中选择 manifest.json 文件所在的目录即可。

开发环境参考：

- 操作系统
  - Ubuntu 20.04.6 LTS
- 扩展使用环境
  - Microsoft Edge 150.0.4078.105
- 前端编译环境
  - Node.js 24.14.0
  - NPM 11.19.0
  - React 19.2.8
  - Vite 8.2.0
  - 详见 package.json 和 package-lock.json

## 更新指南

执行如下命令以更新。

**注意**：如果你修改了源代码，这会覆盖你的修改。

```bash
git fetch --depth=1 origin release
git checkout -fB release FETCH_HEAD
```

## 常见无需担心的问题

> 后端的控制台出现：`Error: Could not establish connection. Receiving end does not exist.`

这一般是正常现象，是由于 Service Worker 尝试与前端通信但前端没有启动或启动后暂未设置监听导致的。总之它通常不影响功能。

> Dark Reader 等暗黑阅读器在 filter 和 static 模式下，本插件的前端颜色效果不正确。

没办法，本插件已全面采用媒体查询来决定显示颜色。只要洛谷支持暗色模式，一切都会好起来的！

## 已知问题

爬取部分洛谷用户的练习页面必须要登录，所以使用代理时无法更新他们的数据。

响应为非成功（2xx）状态码时会在后端控制台打印错误信息。出于避免打扰的想法，这种错误不会触发浏览器通知。

无法爬取未实名或非受信任的用户。

---

网络速度慢的情况下 SPA 页面切换后可能无法显示详细信息。

---

启用分屏时，无法正确对分屏的两个页面实时更新信息。

目前 Chrome、Edge、Firefox 均支持分屏标签页，但 Chrome Extensions API 和 Web Extensions API 均没有提供对应的查询接口，只能查询到分屏标签页中具有焦点的一个。

除了更新前台页面，本插件还在监听 `visibilitychange` 时更新数据，但分屏标签页切换不触发 `visibilitychange`。

