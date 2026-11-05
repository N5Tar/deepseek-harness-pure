# DeepSeek Harness 内核

[English](README.md) | 中文

基于 Cordis 全插件运行时的桌面底座。一个 Cordis 根启动一个页面；页面之外的所有能力都以 Loader 挂载的插件形式加入。

## 运行内容

- `apps/kernel` 启动运行时：一个 HTTP 页面、一份设置文档、一个插件清单和一张客户端模块表。
- `apps/desktop` 在 Electron 进程内运行该内核并渲染其页面。
- `apps/desktop-host` 与 `apps/cli` 提供打包与命令行入口。

## 从源码运行

```sh
pnpm install
pnpm run build
DSH_HOME=/tmp/dsh-home node --import tsx/esm apps/kernel/src/main.ts
```

内核会打印实际绑定的回环地址。使用 `DSH_KERNEL_PORT` 可固定端口。

启动桌面壳：先构建，再用 Electron 加载 `apps/desktop`。

## 扩展

插件在 `<DSH_HOME>/kernel/plugins.json` 中声明：

```json
{ "plugins": [{ "name": "./plugins/health.ts" }] }
```

客户端模块是内核 `assets/ui` 目录下的普通 `*.js` 文件；每个模块在 `window.__DSH_KERNEL_UI__` 上注册自身，页面负责挂载。

## 仓库结构

- `packages/` —— Cordis 底座包，以及它们依赖的传输契约类型。
- `vendor/` —— Cordis 及其官方插件的固定源码副本。
- `native/` —— 桌面构建使用的原生插件源码。
- `docs/` —— 实验计划与执行状态。

面向 agent 的约定见 [AGENTS.md](AGENTS.md)。

## 许可证

[MIT](LICENSE)

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
