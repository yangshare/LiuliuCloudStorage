# Alist Token 会话恢复设计

## 背景

应用在恢复下载队列后，可能连续出现一组误导性的通知：

- “队列已恢复”
- “Alist 认证失效”
- “下载失败”

日志显示底层故障是：

- `AlistService.getDownloadUrl` 返回 `code=401, message=token is expired`。
- `DownloadQueueManager` 检测到认证失败后暂停队列。
- `AutoSyncService` 在真实原因是认证过期时，仍可能继续走到正常的远程扫描结果，并表现为扫描到 `0` 个文件。

代码检查发现两个渲染进程侧的 token 传递缺陷：

- `LoginView` 登录后写入 `authStore` 时使用了 `token: ''`。
- `HomeView` 调用 `initDownloadQueue(authStore.user.id, authStore.token)`，但 store 没有顶层 `token` 字段；真实 token 在 `authStore.user.token`。

这两个渲染进程问题需要修，但更深层的设计问题是：下载队列和自动同步流程会依赖渲染进程传来的 token，而不是由主进程统一管理和校验 Alist 会话。

## 目标

- 让主进程成为 Alist token 有效性的唯一权威来源。
- 防止过期 Alist token 被当成普通下载失败处理。
- 避免仅因认证问题就把批量任务标记为失败。
- 防止自动同步在认证失败时报告正常的空扫描结果。
- 保持用户看到的状态清晰：要么队列真正恢复成功，要么应用明确要求用户重新登录后再恢复。

## 非目标

- 不新增 `auth_waiting` 这类持久化传输状态。
- 不重设计整个队列数据库结构。
- 不在本次改动中处理 `completed=60480` 对应的长期历史清理问题；这是单独的性能加固任务。
- 不做无关的视觉设计改造，只调整本流程必要的通知文案和跳转行为。

## 推荐方案

采用主进程集中式认证恢复。

渲染进程仍应保持 `authStore.user.token` 正确，供必要的 UI 流程使用。但下载队列恢复、排队下载、自动同步这些主流程，在访问 Alist 前都应从 `AuthService` 获取有效 token。

当 Alist 返回认证错误时，收到错误的服务只尝试一次会话恢复。恢复成功则重试被中断的操作一次；恢复失败则暂停队列或将当前高层流程标记为认证失败，而不是继续当作普通传输或扫描失败处理。

## 认证设计

### 渲染进程 token 状态

`LoginView` 必须保存 `auth.login` 返回的 token：

- 登录成功后使用 `result.data.token`。
- 如果仍需要获取当前用户详情用于配额或管理员信息，可以继续调用 `getCurrentUser`，但不能用空 token 覆盖登录结果里的 token。

如果现有 IPC 签名仍需要 token 参数，`HomeView` 应传入 `authStore.user.token`。这能保持当前渲染进程代码自洽，但主进程不能把这个值当作权威 token 来源。

### 主进程会话权威

`AuthService` 应暴露一个内部方法，行为如下：

- 当前内存会话存在且有效时，返回当前会话。
- 如果没有内存会话，从本地 session 数据库恢复。
- 返回恢复出的 token 前，先向 Alist 校验 token 是否仍有效。
- 如果校验失败且存在自动登录凭据，自动重新登录 Alist，保存新 session，然后返回新会话。
- 如果校验失败且无法恢复，返回认证过期结果。

该能力可以通过新增 `ensureValidSession()` 实现，也可以扩展 `checkSession()`，但要保持现有 IPC 返回形状兼容。内部服务应调用明确的内部方法，避免解析面向渲染进程的 IPC 数据结构。

`getCurrentUser()` 继续只负责用户资料查询，不应变成获取 token 的路径。

## 下载队列设计

### 队列初始化

`transfer:download:init-queue` 可以继续接收 `{ userId, userToken }`，以避免大范围修改 preload 和类型声明。但 handler 内部应优先使用主进程会话：

1. 调用会话权威方法，确保 Alist token 有效。
2. 如果有效，使用该 session 初始化队列凭据。
3. 恢复 pending 和 in-progress 下载。
4. 拉取队列状态。
5. 如果无效，不恢复也不启动下载，返回认证类失败，让渲染进程提示“请重新登录后恢复下载”。

### 启动下载

`DownloadQueueManager.startDownload()` 调用 `alistService.getDownloadUrl()` 前：

1. 在主进程确保存在有效 session。
2. 使用有效 session 设置 `alistService` 的 token、base path、user id。
3. 获取下载链接。

如果 `getDownloadUrl()` 因认证错误失败：

1. 立即暂停队列，防止更多任务继续用同一个失效 token 启动。
2. 尝试一次会话恢复。
3. 如果恢复成功，恢复队列并重试当前任务一次。
4. 如果恢复失败，将当前任务保留为 pending 或重新放回队列，发送一次 auth-failed 事件，不发送普通 download-failed 事件。

只有非认证错误才应把任务标记为 `failed` 并发送 `transfer:download:failed`。

### 恢复队列按钮行为

用户点击“恢复队列”时：

- 如果 session 可以校验或刷新成功，恢复队列并显示“队列已恢复”。
- 如果 session 无效且无法刷新，队列保持暂停，并显示“Alist 登录已过期，请重新登录后恢复下载”。

这样可以避免 UI 先提示“队列已恢复”，随后马上提示认证失败和文件失败的误导组合。

## 自动同步设计

自动同步应把认证失败视为工作流级失败，而不是一次正常的空扫描。

以下阶段开始前，自动同步应先确保 session 有效：

- 需要后续访问 Alist 的分享转存执行。
- 远程根目录扫描。
- 递归远程目录扫描。
- 差异文件加入下载队列。

如果 Alist 操作失败，且错误属于 `token is expired`、`401` 或 guest/未认证用户：

1. 尝试一次会话恢复。
2. 如果恢复成功，重试被中断的阶段一次。
3. 如果恢复失败，将本次同步 run 标记为 `failed`。
4. 发送明确进度消息：`Alist 登录已过期，请重新登录后重试同步`。
5. 不再记录或发送“扫描 0 个目录，发现 0 个文件”这类正常完成信息。

全局自动同步进度卡片应显示失败状态。点击认证失败的同步卡片时，应跳转到登录页或会话恢复入口，而不是只跳到分享转存页。

## 错误分类

在主进程引入一个小型 Alist 认证错误分类器，识别：

- HTTP 状态码 `401`。
- Alist 响应 code `401`。
- 包含 `token is expired` 的消息。
- 表示 guest 或未认证用户的消息。

下载队列和自动同步都应使用同一个分类器，避免认证处理逻辑在不同功能里逐渐分叉。

## 通知行为

下载认证失败应产生一条常驻通知：

- 标题：`Alist 认证失效`
- 内容：`Alist 登录已过期，请重新登录后恢复下载`

重新登录成功或队列恢复成功后，应用应尽量替换或关闭旧的认证失败通知。如果当前通知 API 不方便关闭旧通知，至少要避免再为纯认证失败追加普通的 `下载失败 N 个文件` 通知。

批量通知中，认证阻塞任务应与真实失败任务分开处理。本次变更中，认证阻塞的单文件任务保持静默，因为全局认证通知已经解释了阻塞原因。

## 测试

### 单元测试

新增或更新 `AuthService` 测试：

- 本地 session 恢复后 Alist token 有效时，返回有效 session。
- 本地 session 未过期但 Alist token 已失效，且存在自动登录凭据时，刷新 token 并返回新 session。
- 本地 session 未过期但 Alist token 已失效，且没有可用凭据时，返回认证过期结果。

新增或更新 `DownloadQueueManager` 测试：

- `getDownloadUrl()` 返回认证失败时，暂停队列并只发送一次 auth-failed 事件。
- session 恢复失败时，认证失败不会把任务标记为普通 `failed`。
- session 恢复成功时，当前任务重试一次并继续队列。
- 非认证类 `getDownloadUrl()` 失败仍按普通失败处理。

新增或更新 `AutoSyncService` 测试：

- 远程扫描认证失败时，不产生正常的零文件扫描成功结果。
- session 恢复成功时，重试失败的扫描阶段一次。
- session 恢复失败时，将 run 标记为 failed，并使用认证过期消息。

### 渲染进程测试

更新渲染进程测试：

- `LoginView` 将登录结果里的 token 写入 `authStore`。
- 如果 IPC 签名仍接收 token，`HomeView` 使用 `authStore.user.token` 初始化下载队列。
- 纯认证失败不会额外显示 `下载失败 N 个文件` 通知。

## 验收标准

- 登录响应包含 token 时，登录后 `authStore.user.token` 非空。
- 下载队列初始化不再依赖不存在的 `authStore.token`。
- 本地 session 未过期但 Alist token 已过期时，会在恢复队列启动下载前被检测出来。
- 如果自动登录能刷新 token，下载和自动同步可在无需用户操作的情况下继续。
- 如果自动登录无法刷新 token，队列保持暂停，任务不会仅因认证过期被标记为普通失败。
- 自动同步遇到认证过期时，run 结果为带认证消息的 failed，而不是成功的空扫描。
- 用户不再看到纯认证失败场景下“队列已恢复”随后又“下载失败”的误导序列。

## 实现边界

实现只应触及认证、下载队列、自动同步，以及直接相关的渲染进程通知路径。不做无关 UI 改造、队列 schema 扩展或历史任务清理。
