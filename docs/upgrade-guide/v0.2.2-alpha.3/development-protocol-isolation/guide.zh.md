---
kind: upgrade-guide
description: "Desktop 开发启动不再注册公共 dsh URL 协议。"
---

# Desktop 开发 URL 隔离

[English](guide.md) | 中文

## 变更

Desktop 开发启动不再接管 `dsh://` 链接。macOS 开发应用包不声明 URL 处理程序，也不显式注册到 Launch Services。浏览器登录仍通过本机回环回调完成，但完成页无法通过 `dsh://open` 将开发窗口置前。打包应用保留现有注册行为。

## 迁移

1. 使用 `pnpm run dev:desktop` 启动开发应用，或构建后运行 `pnpm run start:desktop`。启动器会重建旧的 macOS 开发应用包，移除其 URL 处理程序声明。
2. 浏览器登录完成后，手动将开发窗口置前。
3. 如果此前的开发启动已接管 `dsh://`，启动已安装的打包应用以重新注册其处理程序。确认 `dsh://open` 打开已安装应用而非开发窗口；开发启动不会修复已有的系统注册。
