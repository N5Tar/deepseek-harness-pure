---
description: "包工作区：Cordis 桌面底座保留哪些分组、各自负责什么，以及约束它们的约定。"
kind: "package-group"
---

# 包

[English](README.md) | 中文

## 摘要

底座由 `packages/` 下的 npm 包组成，按职责分组。`bundle/shell-base` 是桌面壳挂载的组合，其余分组提供该组合使用的运行时服务。每个包都使用 `@deepseek-ai/dsh-*` 作用域，且只属于一个分组；每个分组 README 是该族包的权威清单。

## 分组

| 分组 | 职责 |
| --- | --- |
| `bundle` | 内核挂载的 `shell-base` 组合 |
| `boot` | 应用启动、命令行解析、插件管理器、HMR |
| `api` | 远程网关、设置控制器、shell 远程服务 |
| `host` | 回环 Web 服务器与静态前端 |
| `client` | 客户端壳包：连接、模块、渲染器、设置、主题、插槽、基础组件 |
| `settings` | 用户设置服务 |
| `credentials` | 凭证与授权 |
| `typert` | 类型图与远程编解码 |
| `util` | 零依赖工具 |
| `session`、`core`、`llm`、`sandbox`、`storage`、`subprocess`、`workspace`、`preset`、`interaction`、`attachment` | 仍被网关与客户端连接引用的传输契约包 |

## 发布预期

除面向外部插件作者发布的包外，其余包均为 `private: true`。发布元数据与打包运行时入口位于各自的 `package.json`。

## 依赖

Harness 包之间使用 `workspace:*`，vendored Cordis 包使用 `workspace:~`。每个 Harness 包都在 `peerDependencies` 与 `devDependencies` 中声明 `@deepseek-ai/cordis`。

## 包 README 约定

每个包 README 说明该包负责什么、公开接口、生命周期与失败约定，以及已知限制。它必须与代码同步更新：调用方在改动包接口前会先读它。

## 开发说明

`pnpm run build:check` 对工作区做类型检查；`pnpm run build:artifacts` 生成运行时 bundle。内核本身由自己的测试套件验证。
