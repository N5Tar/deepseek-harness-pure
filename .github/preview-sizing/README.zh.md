# PR 构建运行器规格

[English](README.md) | 中文

## 摘要

[Web 底座工作流](../workflows/build-preview-cloudflare.yml) 在 PR 上构建产物并检查 aggregate 程序，通过 `DSH_CI_FAILOVER_LINUX` 选择 Blacksmith 或 GitHub 托管的 Ubuntu。运行器规格选择比较完整作业成本，而非仅比较每分钟价格或核心数。

## 目录

- [比较要求](#comparison-requirements)
- [发布语义](#publication-semantics)
- [开发备注](#dev-note)

<a id="comparison-requirements"></a>

## 比较要求

规格实验保持检出 SHA、锁文件、Node 与 pnpm 版本、工作区构建以及 aggregate 检查命令一致。每个运行器启动时均无构建产物。冷安装不恢复依赖缓存，但 pnpm 引导安装文件可能已存在；热安装恢复同一个精确缓存，不使用前缀回退。记录实际运行器镜像、CPU、内存、磁盘、缓存结果、各阶段耗时、退出状态与内存峰值。GNU time 最大 RSS 表示进程最大值，而非构建进程树同时占用的内存总量。

估算总计算费用时，将每个已完成作业的运行分钟数向上取整，乘以对应运行器费率后求和。纳入设置、缓存恢复、清理、失败及测量数据上传的开销。单独报告缓存预热作业。排队延迟属于延迟观测，不属于作业执行时间。这些估算不是账单总额；标准运行器的套餐内分钟数及存储另行计算。

该工作流不打包 VFS 镜像、不部署预览、不访问 Cloudflare 凭据，也不发布 PR 评论。历史预览测量包含底座构建中不存在的工作，不能作为当前成本估算。

<a id="publication-semantics"></a>

## 发布语义

运行器选择保留 PR 事件、按 PR 取消、不可变安装、只恢复的依赖缓存与完整工作区构建。作业只有仓库只读权限；构建失败会使检查失败。不包含部署或发布步骤。

<a id="dev-note"></a>

## 开发备注

[已归档的运行器决策](../../.agents/notes/archived/process/2026-09-06-preview-hosted-runner-sizing.md) 记录测量、成本估算及镜像/CPU 差异。仅构建实验不验证生产部署。
