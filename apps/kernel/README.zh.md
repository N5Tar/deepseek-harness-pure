# Harness 内核

[English](README.md) | 中文

## 摘要

内核是可运行的最小 Harness 应用：一个 Cordis 根、一个 HTTP 页面、一份设置文档，不含任何产品服务。其余能力都属于插件，由 Loader 后续挂载。

## 目录

- [运行](#run)
- [启动内容](#what-boots)
- [设置文档](#settings-document)
- [插件](#plugins)
- [客户端模块](#client-modules)
- [验证](#verification)
- [已知限制](#known-limitations)

<a id="run"></a>

## 运行

```sh
DSH_HOME=/tmp/kernel-home pnpm --filter @deepseek-ai/dsh-kernel start
```

`DSH_HOME` 选择设置根目录，未设置时使用 `~/.dsh`。`DSH_KERNEL_PORT` 选择回环端口；`0`（默认）由系统分配，启动后打印实际 URL。`SIGINT` 与 `SIGTERM` 会先关闭监听并释放插件树，再退出进程。

<a id="what-boots"></a>

## 启动内容

`bootKernel` 创建一个 `Context`，挂载服务与设置服务，在 `127.0.0.1` 上监听，再挂载页面插件。页面位于 `/`；设置接口为 `/api/settings`，`GET` 读取、`POST` 合并 JSON 补丁。每条路由都在 `ctx.effect()` 内注册，因此释放插件即移除其路由。

<a id="settings-document"></a>

## 设置文档

存储读写 `<DSH_HOME>/kernel/settings.json`，目录权限为 `0700`，文件权限为 `0600`。文档缺失时解析为 `{ theme: "dark", language: "en" }`；文档不可读或无效时记录警告并回退到同一组默认值，不阻断启动。写入先用当前文档合并补丁，写入临时文件再重命名，并发写入在同一队列中串行执行。

<a id="plugins"></a>

## 插件

内核挂载 Cordis Loader 并读取 `<DSH_HOME>/kernel/plugins.json`：

```json
{ "plugins": [{ "name": "./plugins/health.ts" }] }
```

每个条目就是一个 Loader 条目（`name`，可选 `config` 与 `disabled`）；它们在页面插件之后启动，因此可以注入 `kernelServer` 与 `kernelSettings`。清单缺失时不挂载任何插件；清单格式错误时启动失败，并指出有问题的字段。

插件就是普通的 Cordis 函数插件：通过 `inject` 声明所读服务，并在 `ctx.effect()` 内注册路由或设置键。不依赖 `packages/` 中的产品服务：内核只依赖 `vendor/cordis`、Loader 与 Node 内置模块，因此每增加一个能力都不会把产品运行时重新拉回来。

<a id="client-modules"></a>

## 客户端模块

页面会导入客户端模块目录下的每个 `*.js`，并对注册的插件依次调用 `mount(container)`：

```js
window.__DSH_KERNEL_UI__ ??= { modules: [] }
window.__DSH_KERNEL_UI__.modules.push({ id: 'example', mount(root) { /* draw */ } })
```

`GET /api/modules` 按文件名顺序返回 `{ id, url }`；`GET /ui/<file>.js` 以 JavaScript 内容类型返回模块正文，并拒绝不属于该目录的普通 `.js` 文件名。目录默认使用内核随附的 `assets/ui`，宿主可在内核被打包时传入 `modulesDirectory`。

<a id="verification"></a>

## 验证

```sh
node node_modules/vitest/vitest.mjs run apps/kernel/tests/kernel.spec.ts --maxWorkers=1
```

测试在临时家目录启动内核，断言页面与默认设置，持久化补丁并重新加载，同时拒绝未知路由与非法补丁。

<a id="known-limitations"></a>

## 已知限制

- 尚无鉴权、插件加载与客户端 bundle：页面由内核直接提供的静态标记。
- 设置是单一扁平文档，没有 schema、迁移或命名空间隔离。
- `apps/desktop` 默认在进程内启动该内核；`DSH_DESKTOP_KERNEL=0` 保留已退役的产品 profile 供诊断。
