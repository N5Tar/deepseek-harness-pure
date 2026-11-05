# AI 产品剥离：模块分支执行计划（临时）

日期：2026-11-05。状态：第 01–05 项已合入 master，第 05 项提交为 `580b762c0a`；第 06 项按用户指示在现有 master 完成实现与本地验收，不新建分支、不推送；第 07–16 项未开始。本文件是中文临时工作清单，不是已实现功能说明，不作为产品文档发布。完成剥离后删除本文件，或将必要验收记录归入执行状态。

## 目标与范围

将仓库从“不启动 AI 服务的桌面模式”收敛为源码、类型、测试、安装和发行产物均不依赖 AI 产品的纯桌面底座，不再维护 product / shell 双模式。

保留 Electron 窗口、菜单、preload、IPC、Host 生命周期和故障恢复；保留 Cordis 插件装配、配置、加载卸载和必要的开发 HMR；保留本地服务、鉴权、RPC、资源与模块加载；保留 Slots、Renderer、基础控件、主题、语言和设置，以及这些能力实际使用的工具库、测试和工程设施。

删除 AI 执行、聊天、模型、Session、Agent 工具、协作与任务、账号、产品遥测等产品功能。终端、SSH、LSP、Office、插件市场和实验能力不因未来可能有用而默认保留。插件扩展能力保留，但插件市场、官方目录和在线安装管理不是同一项能力；如需保留在线安装，须确认其包管理运行依赖。

用户已确认路线 A：保留 Electron + 独立 Host + Client 插件平台及通用通信能力，清除 AI 产品和反向业务依赖；不改造为最小 Electron IPC 架构。

本轮不改 npm scope，不重设计 UI，不触碰已安装 DSH、旧用户数据或凭证。正式应用名、图标、签名和发布渠道另行确认。

## 分支与合并规则

1. 一次处理一个模块或功能，一个分支可以有多个提交，不使用覆盖全部删除工作的长期大分支。
2. 每个分支从最新 master 创建，完成实现、验收和审查，经用户确认合入后，再从更新后的 master 创建下一分支。不提前创建所有分支，不默认建立依赖分支栈。
3. 开始前检查实际反向依赖，先处理消费者再删除提供方。编号是默认顺序，不是忽略依赖的强制删除顺序。
4. 源码、类型、manifest、TypeScript 引用、装配、构建入口、测试、fixture、快照、专属脚本与说明随所属模块一起修改。共享工程配置的相关条目不得全部推迟到末尾。
5. 尚未删除的产品消费者需要更新时，同分支调整其导入或依赖归属，保持可构建；不得通过假 Session、空 Agent 服务或类型占位包维持启动。
6. 保留通用鉴权、取消、资源释放与错误报告语义。不按目录名称整组误删，例如 Connection 使用的通用 scope 能力必须保留或重新归类。
7. 分支完成不代表授权 push 或合并；按用户指示执行。创建分支前确认名称没有冲突。

## 阶段 A：底座解耦

先让保留代码、测试和启动路径独立，不大面积删除 AI 包。阶段结束时重新计算保留清单，覆盖运行导入、类型导入、manifest、编译引用、动态装配、模块表、测试、生成器和发行输入；安装依赖闭包不能替代上述检查。

| 编号 | 分支 | 工作范围 | 验收条件 | 状态 |
|---|---|---|---|---|
| 01 | `pure/settings` | 清理 settings、settings-controller 的 Session / Agent preset 残余依赖和编译引用；设置 UI 改用所属设置类型及必要的 shell 远程声明；替换业务化 fixture | 设置链路不依赖全量业务 API；读写、冲突处理、主题与语言持久化正常 | 已合入 |
| 02 | `pure/connection` | 移除 Connection 的 Session、LLM 消息等业务类型出口和业务声明；保留通用传输与 Peer 生命周期 | RPC、鉴权、取消、断开与资源清理测试通过；剩余消费者引用已调整 | 已合入 |
| 03 | `pure/ui-test-runtime` | 建立无 Session 的 Cordis + Slots + Renderer 测试环境；迁移底座 UI 测试 | 底座测试不借用聊天、Session、Workspace fixture；真实注册、更新和卸载仍被覆盖 | 已合入 |
| 04 | `pure/ui-test-runtime`（沿用当时分支） | 清除 Web 构建中的业务 preview、消息引用及非必要静态输入；收紧启动模块 | 基础页面、主题、语言、设置与插件模块加载正常；源码及构建输入不需要 AI UI | 已合入 |
| 05 | `master`（按用户指示不新建分支） | 桌面 Host 脱离全量产品 CLI；直接使用通用启动能力；移除 Agent、任务、账号等 Host 业务集成 | 无密钥、无账号和旧用户目录可启动；Host 启停、就绪和失败报告正常 | 已合入 |
| 06 | `master`（按用户指示不新建分支） | 纯桌面成为唯一模式；删除双模式、账号 Welcome、产品专属 IPC 和构建入口 | 不设置模式变量也启动底座；窗口、菜单、设置、退出与子进程清理正常 | 已完成（本地） |

UI 远程类型与测试依赖可能交叉，每个分支开始前核实。遇到必须同时修改的消费者，仅纳入使当前模块独立所必需的改动，不提前清理无关功能。

## 阶段 B：产品功能退役

先移除入口和上层消费者，再删除执行、会话和模型提供方。每个模块同时删除其独占测试与工程条目；仍被保留侧使用的底层能力不得连带删除。

| 编号 | 分支 | 工作范围 | 验收条件 | 状态 |
|---|---|---|---|---|
| 07 | `master`（按用户指示不新建分支） | 退役 ACP profile、bundle、CLI 入口与专属启动测试；SDK/headless 按依赖证据延后 | 不再存在 ACP 应用启动路径；通用 `dsh <name>` profile 启动与 shell 底座装配可用 | 已完成（本地） |
| 08 | `pure/ai-interface` | 删除聊天、Session、模型设置、轨迹、工具卡片等 AI UI 及专属 BFF | 底座 UI 与设置 API 保持可用；无悬空远程声明、模块表或页面装配 | 待开始 |
| 09 | `pure/account-telemetry` | 删除 DeepSeek 账号、登录、产品遥测、反馈及独占配置 | 无产品登录或上报路径；本地连接鉴权保留并通过验证 | 待开始 |
| 10 | `pure/agent-orchestration` | 删除 subagent、team、workflow、goal、plan、todo、schedule 等业务 | 保留侧无依赖；关联 UI、工具注册、测试与构建入口清理完整 | 待开始 |
| 11 | `pure/agent-tools` | 删除 Agent 文件/命令工具、终端集成、MCP、skill、搜索、浏览器和电脑操作等 | 无工具装配、专属资源或测试残留；底座实际使用的通用库保留 | 待开始 |
| 12 | `pure/session-runtime` | 删除 Agent loop、Session、持久化、迁移、查询、上下文与 compaction | 尚存消费者已移除或解耦；不保留假服务或类型兼容壳 | 待开始 |
| 13 | `pure/model-providers` | 删除 LLM providers、模型凭证接入、token 统计、模型 mock、真实 API 测试等 | 安装、构建、测试不需要模型包或 API key | 待开始 |

若第 08 或第 11 项 diff 过大，应在实现前按功能进一步拆支，并更新本表。可选拆分：聊天/会话 UI、模型/Agent 设置、任务/工具展示；命令与终端、文件与交付、浏览器与电脑操作、MCP 与 skill。每个子分支仍必须独立可构建，不为拆小而留下断裂依赖。

账号、编排、工具、Session 和模型可能存在交叉依赖。模块删除前再次检索生产代码、测试、配置和生成入口；必要时先完成消费者退役，再执行对应删除，不以表格顺序代替依赖证据。

## 阶段 C：运行资源、工程与发行

本阶段处理跨模块剩余项，不替代前面各模块应完成的局部工程清理。

| 编号 | 分支 | 工作范围 | 验收条件 | 状态 |
|---|---|---|---|---|
| 14 | `pure/runtime-payload` | 移除无需求的 Office、Python、primary runtime 业务载荷；识别并独立保留必要的通用运行能力 | 打包不准备业务资源；如需包管理运行时，明确其消费者，不保留整套业务载荷 | 待开始 |
| 15 | `pure/build-tooling` | 清理剩余产品命令、CI、生成器、孤立工具包和失效规则；收紧依赖和测试配置 | 干净安装、构建通过；通用质量检查继续生效，不通过关闭检查掩盖悬空依赖 | 待开始 |
| 16 | `pure/desktop-distribution` | 收紧发行闭包；清理原产品发布配置与协议注册；验证独立桌面产物 | 产物脱离源码启动，设置持久化、插件卸载、故障恢复和退出验收完成 | 待开始 |

## 每个分支的交付记录

开始前记录本次目标、保留能力、影响包与消费者、依赖阻塞和拟执行检查。完成后记录实际修改/删除范围、测试与构建结果、可见行为变化、未解决问题和是否可合并。仅报告实际执行的检查；未经测试的平台和场景明确标为未验证。

状态可使用：待开始、进行中、阻塞、待审查、已合入。只有合入后才标记已合入；阻塞项须写具体依赖与下一动作。实施分支创建后记录其基点和提交，避免将计划中的名称误认为已经存在的分支。

## 分支验收

- 运行受影响模块的针对性测试及依赖、编译引用检查。
- 完成构建产物生成，再执行构建后检查；根据实际变更选择验证范围，不重复执行无关全仓测试。
- 涉及桌面或 UI 行为时执行相应启动、设置或页面验证。
- 检查保留侧没有新增 AI 产品依赖，删除模块不存在悬空引用。
- 保留取消、卸载、进程退出和失败可见性测试；不以窗口能打开代替生命周期验收。
- 检查 diff 不含用户数据、凭证、无关格式化或未经授权的发行身份配置。

## 最终验收

以下项目均为待执行，不代表当前已通过。

- [ ] 干净检出后安装依赖、完整构建和构建后检查通过，不依赖旧构建残留。
- [ ] 保留模块的相关测试通过，无模型 API key 需求。
- [ ] 独立打包产物脱离源码目录运行，不读取已安装 DSH 的数据或配置。
- [ ] 首次启动只有底座，不出现账号、模型、聊天、Agent 或 Office 功能。
- [ ] 主题和语言在冷重启后保持。
- [ ] 最小测试插件能加载和卸载，卸载后注册贡献和副作用消失。
- [ ] Host 异常退出能得到明确提示并恢复。
- [ ] 应用退出后没有遗留子进程。
- [ ] 发行依赖和资源中不存在已删除的 AI 产品内容。
- [ ] 默认工程命令与 CI 只服务保留能力。
- [ ] 增加保留侧不得依赖 AI 产品包的执行检查，覆盖真实依赖关系，不以禁止 session 等普通词语代替检查。
- [ ] 列明实际验证的平台与未验证项，不将本机证据扩展为跨平台保证。

## 下一步

第 01 项在 `pure/settings` 完成，基点为 `bb2dbed99f0992fbe1c8570a36cfb91660f69ec8`，实现提交为 `662ad5a3d1`，已快进合入主干。

第 02 项在 `pure/connection` 完成，基点为 `babab2764becfd190041446c961934ba5e8970f1`，实现提交为 `44d90704e4`，已按用户授权快进合入主干。第 03 项已在 `pure/ui-test-runtime` 实施，基点为 `3720bf415f`，已有本地提交 `120af6519a`，未推送或合并；完整验收尚未通过。

## 第 01 项执行记录

已清理 Host 设置包对 Session、Agent preset、默认模型测试消费者的直接依赖；设置 UI 改用设置服务自有类型和 shell 专属远程声明；语言和主题包移除未使用的全业务 Remote 元数据与开发依赖。补齐 shell-remotes 在声明产物中的类型导出，更新锁文件，并新增五个设置相关包的直接依赖隔离回归检查。

安装声明闭包按 dependencies、optionalDependencies、peerDependencies 递归统计：从 shell-base 可达的 packages 包由此前审计的 49 个降为 36 个。该数字不是运行加载数量，不包含开发依赖，也不代表所有 AI 产品已删除。Connection 类型、共享 UI 测试环境和 Web 的剩余耦合由后续模块处理。

已通过：Host 设置与控制器 7 个测试文件、64 个测试；新增直接依赖隔离检查 5 个测试；设置 Client 独立 TypeScript 编译；离线锁文件更新；完整构建 10 项全部通过；使用新构建产物的真实 shell Loader 装配测试通过。会话输入框原先借用设置链路带入的权限端点声明，现已改为由其自身显式导入，相关 136 个测试通过。

新增依赖守卫已做负向验证：临时把必有的 Cordis 依赖加入禁止项，五个包均按预期被拒绝；随后恢复正式禁止项，五个检查恢复通过。针对变更 TypeScript 的静态检查发现新测试的隐式 any，已补上明确的清单字段类型；该文件复验为零警告、零错误，其余变更 TypeScript 文件在前一轮检查中无错误。依赖规则检查发现语言与主题仍被两条旧策略强制依赖全量 api-remotes，已删除这两条失效要求并同步策略测试；检查器保持启用，策略单测 58 个通过，最新 build:check 两项通过，实际依赖检查覆盖的 97 个包全部符合策略，两个策略文件的最终静态检查为零警告、零错误。

扩展 Client 测试运行覆盖 109 个文件：1442 个测试通过，4 个样式检查失败。失败均指向本轮未修改的 ui-shell 样式：独立拖拽区域、1px 中性边框、焦点环颜色、滚动区域颜色重绑定。相关 CSS 与四个检查文件相对基点无改动；本轮不顺手修改 UI，不将该套测试报告为全绿。这些失败已在交接时告知用户；用户随后授权提交、推送并合入主干。它们继续保留在后续 Web/桌面 Shell 模块的处理范围内。

保留事项：settings 的旧 settings.yaml 迁移及业务条目映射尚未移除；共享 Client 测试环境仍含 Session 依赖，按第 03 项处理。未进行新的 Electron 实机冷启动或跨平台发行验证。

## 第 02 项执行记录

按路线 A 清理 Connection 的业务类型出口：SessionId、SessionEvent、MessageId、ContentBlock、StreamChunk 不再由通信层转导出。API Remotes 与 Liveshare 的现有消费者已改为从类型所属包获取。Connection 的 manifest 与两个编译入口均移除 Session、LLM 和 attachment 依赖；凭据、scope、Peer 与通用 RPC 保留。

Connection 通过只读 maxRequestBodyBytes 公开共享 HTTP 路由的缓冲容量，默认仍为 300 MiB。图片 base64 容量公式及 1 MiB 信封余量归 SessionController 所有，在其构造和服务发布前校验。错误归属有意改变：不匹配时 Session API 不能激活，但通用 Connection 可独立启动；不再承诺图片配置错误会阻止 Connection 路由注册。鉴权、协议、重连、取消、HTTP 413 和流式请求绕过缓冲上限的行为保持原实现。

兼容性说明：内部业务消费者全部同步迁移，具体类型导入路径见 Connection 的包 README。自定义 HostConnectionHandle 实现需要提供真实的 maxRequestBodyBytes；HostConnectionService 的现有三参数构造仍使用原默认上限，可通过第四参数传入配置值。SessionController 显式等待 connection 和 attachments；任一依赖撤下或替换时，沿 Cordis 生命周期撤下并重新校验消费方。

新增回归覆盖直接依赖隔离、Host/Client 编译引用和类型出口，以及容量恰好满足、差一字节、晚注入、替换、卸载和真实 Loader 的错误归属。Connection 原有 14 个文件、188 个测试通过；新增隔离检查 4 个测试通过；Host/Client 独立编译通过；Session API 50 个文件、1088 个测试通过；Liveshare 消费者 3 个测试通过。完整构建 10 项通过；使用新产物的真实 shell 组合与 Desktop Host 两项验收通过，覆盖鉴权、语言设置持久化、重启、退出和缺少 Office 载荷的启动。修改过的 TypeScript 文件静态检查在修正测试 void 回调写法后通过，零警告、零错误；最新 build:check 两项通过；依赖策略覆盖的 97 个包检查通过。未运行全仓测试或 Electron 窗口视觉验证，第一模块记录的四个样式失败仍留待 Shell 模块处理。

回归修复：第一模块将通用设置 fixture 去业务化后，三个 Session 模型用例仍依赖其隐式默认模型装配。本模块将真实模型装配放回这些业务测试自身的 profile patch，保留原断言和真实配置写入；未修改模型生产逻辑，也未把 AI 依赖加回通用设置包。

## 第 03 项执行记录

新建 `@deepseek-ai/dsh-client-ui-test-bench`（`packages/test-support/ui-test-bench`）：真实 Cordis Context、SlotRegistry 与生产渲染器的底座 Slot 测试台，不含 Session、Agent、Workspace、模型服务或其 fixture。

拆分依据是依赖边界而不是目录名称：`remote`、`config-form`、`context-menu`、`translate`、`snapshot`、`locale-env`、`access` 七个模块本就不依赖业务包，已移入新包；`sessions`、`workspaces`、`fixtures` 和整机 assembly 留在 `client-runtime`，由其自带测试台继续服务 Session scope。`client-runtime` 改为从新包再导出通用能力，保持其现有消费者 API 不变，也避免复制实现。

访问 Hook 的类型不再从 Session/Workspace 包派生：底座渲染 root scope，为声明合并而导入业务包会把整条业务栈拉回每个底座用例。新包自带 Hook 签名，`allowAllAccess` 的运行时行为不变。

底座迁移：`ui-shell`、`ui-theme`、`locale`、`ui-settings` 的测试与开发依赖改到新包，`ui-shell` 从含 Session 的测试运行时改用 `SlotTestBench`。`ui-renderer` 保留原测试运行时，因为其套件本身就在验证 Session/Workspace scope 绑定，属该包职责。

回归修复：第一模块把 `ui-settings` 的 `dsh.client.inject` 元数据指向 shell 专属装配包后，`web-app` 整机装配测试把它报为悬空 inject 目标。该包只通过 `remote` 服务访问装配，故移除这条元数据。

新增测试覆盖：测试台组装时无业务服务、root 注册经生产入口渲染并在 fiber 释放后移除、缺失必需服务时挂载立即失败、销毁幂等，以及一道依赖守卫断言上述五个底座包及其编译引用不含 Session/Workspace/子代理测试栈。

验证：新包 3 个测试文件、14 个测试通过；`client-runtime` 与底座包合计 16 个文件、144 个测试通过（另 1 个预期失败）；底座四包 1439 个测试通过，另有 4 个先前已记录的 `ui-shell` 样式失败未变。

构建复核：在 master（`3720bf415f`）执行 `pnpm run clean` 后运行 `node --import tsx/esm scripts/compile-referenced-projects.ts host-libraries`，Host 编译出现 6 个 TS2339 错误：`packages/api/remote-access/src/client/state.ts` 的 121、199、200 行缺少 `id`，`packages/client/ui-file-actions/src/client/context-menus.tsx` 的 22、38、53 行缺少 `Context.remote`。返回第 03 项分支执行 `pnpm run build` 后复现相同 6 个错误，结果为 2 项通过、1 项失败、7 项跳过，退出码为 1。master 基线命令经过管道过滤，外层退出码为 0，但编译器明确报告退出码 2，不能视为成功。

当前结论：这 6 个编译错误不是第 03 项新引入，但仍阻止完整构建、构建后检查和新产物装配验收，不能将本分支标为全部通过或可合并。下一步需定位并修复该编译基线问题，再完成构建与产物验证；本轮没有推送或合并，也没有开始第 04 项。

保留事项：`SlotTestBench.declare`/`renderSlot` 在无 Session 适配器下的自动 frame 路径存在差异，本模块未把它作为底座用例依赖；该路径与含 Session 版本共用渲染器行为，留待渲染器模块核对。
## 第 03 项后续：退役细粒度授权与文件操作

用户确认底座只服务本机所有者后，原先的 6 个编译错误按“删除功能而不是修旧产品”处理：直接退役产生错误的两个产品包，不再为旧机制打补丁。

已删除整包：`packages/api/remote-access`（角色、绑定、策略、资源解析、访问快照与全部 access Hook）、`packages/client/ui-file-actions`（原文件另存、下载与图片剪贴板操作）以及随之失去意义的访客分享 `packages/experimental/liveshare` 与其协议包。相关桌面 IPC、preload、菜单、Web e2e 场景与 expected 文本同步清理。

Gateway 不再注入 `remoteAccess`：分发入口统一要求存活的 owner Peer，`gateway/owner-required`（details 含 `{ endpoint }`）在参数解码、lookup 解析和处理器激活之前拒绝非 owner，已释放 Peer 继续返回 `gateway/peer-disposed`。该检查覆盖 unary、stream、`$events` 与 `$events/result`。连接身份验证、浏览器 Cookie 鉴权、请求信任校验与 Peer 生命周期未被削弱，也没有改为全部放行。

`@Remote`、`@RemoteScope`、`TypertResourceMap`、`typert.resources` 注册表与转发事件的 `resources` readers 已无消费者，按“需要当前所有者与需求”规则一并删除；lookup、Context、invocation 与 principal 能力保留。`principalOf` 的独立测试移到 `packages/typert/protocol/tests/principal.spec.ts`。

文档工具链仍在退役状态：`scripts/gen-cordis-catalog.ts` 只产出运行时 catalog，不再读写 `docs/`；`packages/typert/generator` 的 Markdown 页面渲染与对应 fixture 已删除；运行时 catalog 与 partition 校验保留，并新增聚焦生成测试。`apps/web` 的插件管理 e2e 删除只服务于已删分享包的可见性场景，通用 hidden-until-running 覆盖仍由既有 bundle 集合承担。

验证：`pnpm run build` 10 项全部通过；Gateway 与 typert 套件 713 通过、28 跳过；`ui-workspace` 501 通过；底座四包与测试台 1457 通过、4 项先前记录的 `ui-theme` 样式失败未变；真实 Loader 组合 `shell-base` e2e 通过（401/303/200 鉴权、18 行激活、无业务服务）；第 03 项测试台与 `client-runtime` 相关套件保持通过。

保留事项：`packages/boot/plugin-manager` 有一个与本轮无关、依赖本机 pnpm 版本的既有失败用例；4 个 `ui-theme` 样式失败仍在 Shell 模块处理范围内。本轮未提交、未推送、未合并。

### Agent Notes 退役整理（2026-11-05）

已归档三组完整中英双语与 sidecar：[whenAccess](../../../.agents/notes/archived/architecture/2026-10-21-when-access.md)、[LiveShare 协议与 owner 界面](../../../.agents/notes/archived/feature/2026-09-13-liveshare-protocol-and-owner-surfaces.md)、[LiveShare 插件方法目录](../../../.agents/notes/archived/feature/2026-11-02-liveshare-plugin-method-catalog.md)。这些链接仅引用历史设计，不代表底座仍支持相应功能。归档正文不变，仅添加归档日期并更新哈希，纳入冻结清单。

[Peer/principal 笔记](../../../.agents/notes/implemented/architecture/2026-10-12-peer-principal-and-remote-access.md) 属于部分退役：显式调用方身份、Peer 生命周期、消息来源与防伪造规则仍有消费者，因此保持 active，删除已退役 RBAC 接口说明并指向本节的移除决策。[Remote 双向流笔记](../../../.agents/notes/implemented/architecture/2026-09-19-remote-duplex-stream.md) 同步改为当前 owner-only 准入说明。没有删除 substantive 决策 triplet，也没有修改既有冻结档案。

提交阶段发现 pre-commit 与 pre-merge-commit 仍调用已删除的 `scripts/verify-translation-pairing.ts`。经用户确认，移除这两处失效 hook；归档、staged lint、空白、provider metadata、vendor guard 与 pre-push typecheck 保留。

归档验证器通过，新增封存 9 个文件、既有封存哈希不变；归档聚焦测试 17 项通过。`doc-sync`、`test:docs` 与 `verify-translation-pairing` 入口已随文档工具链退役，未恢复；active 两组双语记录使用现存 pairing helper 重算。

## 第 05 项执行记录

本项在现有 `master` 上实施，基点 `6c49d13bb2`，不新建分支、不推送。目标是让 Desktop Host 的源码、manifest 和编译引用脱离产品 CLI、Agent、任务、账号、Session 文件与 Office 集成；保留真实 profile 装配、包解析、连接鉴权、插件操作诊断、就绪消息、失败报告与有界关闭。验证使用临时 home/profile、无密钥环境和单 worker，构建最多两个并发任务。

兼容性变化：Host 不再发布账号状态、安装 Office 提供者或执行 Agent 任务检查；Session 文件拖拽和更新任务控制通过现有 IPC 明确返回不支持。Shell 退出检查报告无业务任务；旧产品 profile 返回未知状态错误，保持 Electron 退出前询问。产品 CLI 桥及其 Windows/Office 支持归回 CLI 包，包装脚本同步切换到 `dsh/lib/desktop-cli.js`，不以动态导入或占位服务保留 Host 的产品依赖。桌面默认模式、Welcome、产品 IPC 和发行资源继续由第 06、07、14 项负责，本项不宣称已得到完整纯净发行版。

通用启动实现归入 app-boot 的 `runResolvedProfile`，CLI 仅准备具名 profile 和 overlay 后委托。原 boot 实现移动到 `boot.ts`，逐字节比较确认没有逻辑修改。保留代理安装/释放、profileContext、命令参数、就绪快照、SIGTERM/SIGINT、重复关闭及五秒退出上限。CLI 的本地 profile/overlay 准备现在发生在代理安装前；无效代理配置可能发生在具名 profile 已初始化之后，无效 overlay 不再触发代理安装/释放。Host 原本就先解析私有 profile，不受此顺序调整影响。

验收发现并修复：改用 Host 自身安装锚点后，内置 shell-base 不再从 CLI 的依赖闭包提供，导致根认证路由返回 404。Host 现显式依赖纯底座 shell-base；未恢复 CLI 依赖。真实验收进一步删除临时运行树中的产品 CLI 符号链接，仍能启动、交换认证 Cookie、读写语言设置、重启持久化并正常退出；非法模式和损坏 YAML 均收到致命诊断，YAML 诊断包含配置路径。

最终验证：`DSH_GATE_CONCURRENCY=2 pnpm run build` 10/10 通过；单 worker 的 Host 单元与父进程套件 55 项通过，boot 实现/诊断与依赖守卫 101 项通过，最终 runner/信号/关闭/CLI 委托与守卫 27 项通过（这些批次有重叠，不相加）；最终产物的 shell Host 与 shell-base composition e2e 2/2 通过，重试关闭。迁移后的 CLI 构建入口 `--version` 返回 `0.2.2-alpha.3`。消费者任务报告包装/Office 解析/准备包集等 34 项通过、workspace constraints 165 项通过、prepared-runtime smoke 2 项通过，Windows 信号 2 项因本机 macOS 跳过。变更 TypeScript 的完整规则 lint 为零警告、零错误，离线安装/锁文件更新、双语记录和 `git diff --check` 通过。

未验证：真实 Electron 窗口启动、Windows 执行、跨平台或 ASAR 完整打包及实际发行 Host smoke；未运行全仓测试或全仓 lint。没有接触已安装应用、旧用户目录或凭据。用户随后授权提交、推送并合入；本项直接提交至现有 master，不创建额外分支或合并提交。

## 第 04 项执行记录

执行分支沿用 `pure/ui-test-runtime`，基于已合入的 `7d2b72aef9`，没有新建分支。此项只解耦静态 Web 外壳，不提前删除后续阶段负责的产品包及其通用测试设施。

Web 构建只保留 Host 驱动的 `index.html`。移除 Worker preview 入口、页面生成插件、独占浏览器验收与 golden、`build:preview` / `serve:preview` 命令，以及 Web manifest 中的消息引用、Worker runtime / packer 和 `http-server` 依赖。`fflate` 仍有 Office / 交付等存量产品测试消费者，保留到对应模块退役。原 Cloudflare preview 工作流保留不可变安装、缓存和完整构建检查，删除镜像打包、上传、部署凭据和 PR 评论步骤。

Web 构建输入检查在原有实验包隔离之外，要求实际静态模块、CSS、资源和 worker 的 DSH 包归属落在明确的底座库清单中；消息引用、Session 和聊天包均有构建拒绝测试。React、Cordis、Zod、通用 UI 库及其必要工具仍保留；动态插件由 Host graph 加载，不编进 Vite 静态入口。启动必须成功的名单保留 modules、renderer、layout 和 ui-shell，移除 Session Controller、Session UI、chat 与 sidebar 的产品专属要求；可选插件失败仍报告警告，底座必需插件失败仍显示启动错误。

4 个既有样式失败均定位到 `ui-shell` 并修复：标题带使用共享 `data-window-drag` 标记，维持各桌面平台拖拽并在 inert 时复位；语言选择器使用 0.5px 中性边框；焦点环使用共享颜色、宽度与指针模式抑制；设置面板按抬升层重绑滚动条颜色。不放宽原有样式检查，只补充真实新增的 chrome 行及共享选择器。

真实浏览器验收使用独立临时 profile、随机监听端口及真实 Loader / Client bundles；不使用旧用户目录、模型或账号。复用的 Host 夹具改用生产 `mountRootInclude` 与 profile patch 读取链路，从而覆盖配置保存与重新组合，而不仅验证 HTTP 页面可读。Chromium 已验证底座启动、深浅主题切换、语言切换、刷新后持久化、Escape 关闭与焦点恢复。浏览器验收位于 Web lane，不给原 Host-only e2e 增加浏览器运行依赖。

最终本地验证：`DSH_GATE_CONCURRENCY=2 pnpm run build:artifacts` 8/8 通过；最终配置下 `pnpm run build:web` 通过；`DSH_GATE_CONCURRENCY=1 pnpm run build:check` Host / Client 两项通过。单 worker 的 Web 内核、ui-shell、四组样式回归、实际 Vite 输入隔离、Web 构建入口、CI 工作流与 workspace constraints 聚焦测试全部通过。Host composition e2e 与 Web lane 的 Chromium e2e 均通过；最终产物中没有 preview 文件。变更 TypeScript 文件的完整规则 lint（2 threads）为 0 warnings / 0 errors，双语记录一致，`git diff --check` 通过。未重跑已知有无关失败的仓库全量 lint，也未在 Windows 或真实 Electron 窗口复验此次 CSS。本轮未提交、未推送、未合并。


## 第 06 项执行记录

Desktop 与 Desktop Host 不再解析 `DSH_DESKTOP_MODE` 或 `dshDesktopMode`。profile 初始化、恢复和开发启动仅使用 `shell-base`；开发目录沿用隔离的 `shell-development`，不准备 primary-runtime。已有产品 profile 由 `DesktopProfileCompatibilityError` 拒绝，恢复也不得改写其 manifest、patch、包管理配置或 lockfile；用户须选择独立 `DSH_HOME`，不自动迁移旧用户数据。

删除 Welcome 与账号引导、Platform 内嵌页、浏览器 guest、Session 文件拖拽、麦克风特许、任务退出检查、应用更新界面及其私有 IPC、preload、renderer、构建入口、测试和专属快照。Host 协议升至 5，只保留启动身份、认证就绪、致命诊断、插件操作记录、关闭与确认。Electron 默认拒绝权限请求和 webview 附加，应用 IPC 验证归属窗口和主 frame；`dshDesktop` 仅提供协议版本、keyboard 和 shortcuts。

保留窗口、菜单、目录选择、语言与主题、WebSocket 鉴权、故障恢复、通用命令管理和有界进程清理。普通退出不访问 Agent 或计划任务。桌面 manifest 与编译引用移除账号、analytics、sidebar-browser、file-drag、产品设置 UI 和 Welcome React/Vite 依赖；应用打包及冻结输入不再收录旧 renderer/preload，并以四个明确构建入口排除磁盘上的旧产物。

范围边界：CLI 产品入口、运行时包集合与 Office/Python 等发行资源属于 07、14、16；本项不声称安装包依赖闭包已经纯净。发行校验仍使用的 updater 库、签名下载检查、纯政策配置解析和日志工具暂留至 16，但不进入 main 的更新控制或产品 IPC。保留源码消费者都已同步；不保留 unsupported 产品协议占位。

本地验收：最终 `DSH_GATE_CONCURRENCY=2 pnpm run build` 10/10 通过。单 worker 主进程回归 23 项通过；Host/preload/诊断/隔离 48 项通过；profile/dev 45 项通过、1 项 Windows 专用跳过；保留更新工具库与键盘/settings-file 148 项通过；locale/恢复/菜单/目录选择等 135 项通过，命令管理流程另 8 项通过。产物冻结/ASAR 输入 59 项通过；workspace constraints、打包与依赖隔离的组合检查 199 项通过（包含上述部分重叠项，不相加为总数）。最后的产物清单归并另复跑 11 项通过。

真实产物验收：built Desktop Host 与 shell-base composition e2e 2/2 通过，覆盖无产品 CLI 链接启动、真实业务服务缺席、认证 settings RPC、持久化、正常重启和无效配置诊断。另用本地 Electron 与现有 Playwright，在新建临时 home/project/userData 下实际打开单窗口，检查无 Welcome/Platform 桥、无更新菜单、中文及深色主题设置，关闭后再次冷启动确认持久化；两次正常退出，进程检查未发现遗留的测试 Electron/Host。首次验收脚本误把浅色 radio 当成深色导致等待超时，改按 `value=dark` 选择后通过；不是产品故障。

变更源码完整规则 lint 0 warnings / 0 errors（主进程及其测试单独覆盖，其余变更文件按 2 threads 覆盖）；双语 README 与配对记录同步，`git diff --check` 通过。未运行仓库全量 lint/coverage，未在 Windows/Linux 启动真实窗口，未验证签名发行包或安装升级。执行中没有修改已安装应用、旧用户目录或凭证，没有推送远端。

## 第 07 项执行记录

按依赖证据收窄了原计划范围。07 只退役 ACP 应用入口：删除 `packages/bundle/acp-app`（含 patch、locale、tests、README 双语对），从 `PROFILE_TEMPLATES` 移除 `acp` 模板，从 `plugin-manager` 呈现清单移除该 bundle，删除 `apps/cli/tests/profiles/acp` 全套启动测试与 `built-bin` 中 ACP 帮助/会话用例，删除 `apps/cli` 对该 bundle 的依赖、根 `tsconfig` 的路径与工程引用，并清理 `apps/cli`、`apps/cli/reference`、`packages/bundle` 三组双语 README 中的 ACP 说明。

快照按共享消费者保留：`snapshots/acp/cancel-tool-calls/session.v3.jsonl` 与 `session.v4.jsonl` 仍被 `apps/web/tests/bash-abort-row.e2e.ts` 及其 snapshot.yml 引用，`snapshots/acp/escalation-approved/cordis.yml` 仍被 `packages/subagent/subagent-acp/tests/subagent-acp.e2e.ts` 引用；其余 ACP 场景与 `acp.snapshot.ts` 适配器随其唯一消费者删除，语料清单同步收窄。

`packages/acp/acp` 库与 `packages/subagent/subagent-acp` 保留：前者仍是 ACP 协议实现，后者由后续编排模块退役；`packages/sdk/*` 与 Python SDK 保留。

延后项及证据：`sdk`、`sdk-minimal` 模板与 bundle 保留——`packages/sdk/client/src/launch.ts` 默认启动 `sdk` profile，Python SDK 运行时与 `python/sdk` 场景直接使用 `sdk`/`sdk-minimal`，删除会打断保留侧；随 SDK 退役模块处理。`headless` 保留——`snapshots/session/*` 约 150 个 `snapshot.yml` 与 `headless.snapshot.ts` 绑定该 profile，随第 12 项会话运行时退役。`web`/`base` 与 `web-app` 保留，随第 08 项 AI 界面退役。`boot.ts` 的 `requiredStartupEntryIds` 中 `acp` 未删除：`web-failure-matrix.expected.e2e.ts` 用它作 required-entry 故障注入，prune 属于 12/15。

本地验证：`DSH_GATE_CONCURRENCY=2 pnpm run build` 首轮 9/10（host aggregate 报 `built-bin.e2e.ts` 一处未使用导入），删除该导入后 `DSH_GATE_CONCURRENCY=1 pnpm run build:check` 2/2 通过。定向单 worker 测试 230 项通过：official-bundles、`apps/cli/tests/args.spec.ts`、`profile-hmr.spec.ts`、workspace constraints。变更 TypeScript 文件 lint 0 warnings / 0 errors；`gen-plugin-packages`、`gen-tsconfig-paths` 重新生成并一致；三组双语 README 与配对记录刷新；`verify-md-links` 未新增 ACP 断链（其余断链为早前文档树退役遗留）。未运行全仓 lint/coverage，未推送。

### 第 08 项删除清单（已核算）

以 `packages/bundle/shell-base/package.json` 的运行时依赖，加上 `packages/client/web`、`apps/web/src` 实际导入的包为存活集，得到客户端存活 13 项：connection、locale、modules、store、ui-dockkit、ui-layout、ui-primitives、ui-renderer、ui-settings、ui-shell、ui-slots、ui-theme、web（另需按构建实测确认 shortcuts、resources、file-upload、hmr、product-analytics 是否仍被底座使用）。

其余 `packages/client/*` 共 42 项进入删除清单：全部聊天与会话呈现（ui-chat、ui-conversation、ui-trajectory、ui-tool、ui-session、ui-attachment、ui-reference、ui-deliverables、ui-secret-mask、ui-user-questions、ui-input-trigger、ui-message-feedback）、编排与任务（ui-plan、ui-goal、ui-schedule、ui-workflow-run、ui-agent-preset、ui-subagent、ui-approval、ui-permission-presets、ui-skill）、外壳扩展（ui-sidebar 系列、ui-open-in-app、ui-context-menu、ui-file-drag、ui-directory-picker-*、ui-entry-customization、ui-brand-official、ui-plugin-manager、ui-plugin-market）与 AI 设置页（ui-settings-general、ui-settings-models、ui-settings-plugin-inventory、ui-settings-plugins、ui-settings-shell、ui-commands、ui-model-selection）。

已删除并验证：ui-settings-account、ui-settings-subagent、ui-settings-agent-loop、ui-settings-web-search、ui-settings-session-log、ui-agent-team、ui-jobs。

连带面（未开始）：`packages/bundle/web-app` 整包与其 113 条装配行、`web` profile 模板、`apps/web/tests` 中的 AI UI e2e 与 expected（含 desktop-onboarding 相关已删项之外的其余场景）、`snapshots/web` 中绑定会话 UI 的场景、`benchmarks/user-text`、`packages/api/remotes` 的客户端导出、`packages/extensions/cordis-client-runner` 的 slot 目录（生成物）、`packages/experimental` 中仅依赖上述 UI 的插件包。

顺序约束：这些 UI 互相引用（ui-conversation 被 261 个文件引用），必须整组一次性删除并同步删测试，无法再按小批独立提交。

### 第 08 项耦合发现与修订顺序

整组删除试运行得到 119 个类型错误后已回退，暴露出底座 UI 仍直接引用 AI 界面包：`ui-layout` 引入 `ui-session`（会话界面）与 `client-shortcuts`，`ui-theme` 引入 `client-shortcuts`；`client-shortcuts` 是键盘快捷键协议、属底座依赖需保留。因此 08 必须分三步，不能直接删包：

1. **解耦**：从 `ui-layout` 移除对 `ui-session` 的依赖（改用槽位或注入取会话信息），保留 `client-shortcuts`；确认 `ui-shell`/`ui-settings`/`ui-renderer` 只依赖底座包。
2. **整组删除**：41 个客户端 AI 界面包 + `web-app` 包与装配行 + `web` 模板；`client-shortcuts` 移入存活集。
3. **收尾**：删除绑定这些 UI 的 `apps/web/tests` e2e/expected、`snapshots/web` 场景、`benchmarks/user-text`，修复 `api/remotes` 客户端导出与 `cordis-client-runner` 生成目录，直至 `build:check` 通过。

上表“存活 13 项”相应修订为 14 项（加入 `client-shortcuts`）。

### 第 08 项阻塞点与顺序建议

第 5 轮尝试只把 `ui-layout` 对 `ui-session` 的类型导入与依赖删掉，`build:artifacts` 能过，但 `AppFrame` 的 props 契约本身由声明合并提供会话钩子：`useSessions`、`useSessionStatus`、`useSessionRetainInfo`、`useWorkspaces`、`useContextMenu`、`useResource` 等，其 76 项测试固定住这些钩子与“浏览器标题跟随会话标题”的行为。删掉导入后标题行为改变、测试夹具需要重写，已回退，工作树保持干净。

结论：08 不是“删包”而是“改写底座外壳的 props 契约”。更有效的顺序是先把提供这些钩子的上层功能退役，再删 UI：

1. 第 10 项（编排：subagent/team/plan/goal/schedule）与第 11 项（工具与终端）先移除对应钩子与槽位贡献。
2. 第 12 项（会话运行时）移除会话投影、`ui-session` 的钩子与标题投影，`AppFrame` 自然只剩布局、面板与主题。
3. 之后再执行本节的 41 包整组删除，测试与快照范围也随之缩小。

因此建议把 08 排到 10–12 之后，而不是继续在 08 内部做外壳重构；若坚持先做 08，则 08 需扩张为“外壳 props 契约重构 + UI 删除 + 测试重写”，工作量显著大于原计划。
