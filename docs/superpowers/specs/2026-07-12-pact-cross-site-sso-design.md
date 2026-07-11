# PACT 跨分站统一登录设计

## 文档状态

本设计已由用户逐节确认，覆盖统一登录方式、分站权限、域名、安全边界、全局退出、源码管理、发布顺序、回滚方式和验收标准。

## 背景

目前 PACT 已有可投入生产使用的账户基础：

- `server/api/login.ts` 校验 PACT 用户名和密码，并把服务端会话写入数据库。
- `server/api/sessionCookie.ts` 使用 `pact_session` Cookie，生产环境带 `HttpOnly`、`Secure`、`SameSite=Lax`，有效期为 8 小时。
- `server/auth/cookieAuth.ts` 在服务端校验会话有效期、用户状态和角色。
- PACT 主站和移动端位于 `www.periopact.cn`，继续复用现有登录流程。

个人站点目前聚合以下分站：

- `xgblog.pages.dev`：博客和工具入口，同时包含标注工作台静态页面。
- `huozi-yinshua.pages.dev`：活字印刷。
- `pactviewbywxg.pages.dev`：PACT View。
- `www.periopact.cn/m`：PACT 移动端。

这些站点现在分属不同主机名，不能也不应直接共享 PACT 的原始会话 Cookie。目标是在保留 PACT 为唯一账户来源的前提下，实现真正的单点登录。

## 目标

1. 用户登录一次 PACT 后，访问获得授权的分站时不再输入密码。
2. PACT 管理员统一分配每个账号可使用的分站。
3. 博客公开内容继续匿名可读，工具介绍继续公开展示。
4. 各工具的实际工作区和所有受保护操作必须通过 PACT 授权。
5. 任一站退出、账号停用或管理员撤权后，所有关联分站授权统一失效。
6. 每个分站只获得最小身份信息，不获得密码、患者资料或无关临床权限。
7. 现有 PACT 登录和临床业务保持兼容，可独立关闭 SSO 并快速回滚。

## 非目标

- 不迁移或复制 PACT 密码到 Cloudflare、GitHub 或分站数据库。
- 不让各分站读取 `pact_session`。
- 不使用 `.periopact.cn` 范围的共享身份凭证 Cookie。
- 不在第一阶段增加细粒度站内角色；只提供每站“允许使用/禁止使用”。
- 不在本项目中公开部署现有本地博客编辑器。内容编辑和 Git 发布仍是独立工作流。
- 不把 PACT、博客和所有工具合并到同一个大型代码仓库。
- 不承诺对已下载到浏览器的纯前端代码进行远程删除；撤权保护的是入口、会话和服务端操作。

## 域名与站点范围

使用现有 `periopact.cn` 的免费一级子域名，不购买新域名：

| 正式地址 | 用途 | 托管位置 |
| --- | --- | --- |
| `https://www.periopact.cn` | PACT 主站与 OIDC 身份中心 | 现有 PACT 服务端 |
| `https://www.periopact.cn/m` | PACT 移动端 | 现有 PACT 服务端 |
| `https://blog.periopact.cn` | 博客、工具入口和公开说明 | xgblog Cloudflare Pages |
| `https://annotate.periopact.cn` | 标注工作台 | xgblog Cloudflare Pages，按主机名重写到工具入口 |
| `https://print.periopact.cn` | 活字印刷 | 独立 Cloudflare Pages 项目 |
| `https://view.periopact.cn` | PACT View | 独立 Cloudflare Pages 项目 |

原有 `pages.dev` 生产地址在正式域名验收完成后执行 `301` 跳转，避免同一应用形成两套 Cookie 和回调地址。Cloudflare 预览域名只允许用于明确登记的测试客户端，不加入生产客户端回调白名单。

## 方案选择

采用 PACT 内置的标准 OpenID Connect 身份中心。

未采用的方案：

- 共享主域 Cookie：实现简单，但任一子域漏洞都可能扩大到 PACT 核心会话，风险不可接受。
- 外部身份平台：协议成熟，但会引入第二套账户来源、账号迁移或绑定流程，不符合 PACT 作为唯一账户系统的要求。

OIDC 服务端使用维护中的标准实现，采用 `oidc-provider` 9.x；Cloudflare Pages Functions 使用支持 Cloudflare Workers 运行时的 `openid-client` 6.x。实施时由锁文件固定已验证的精确版本。不得自行实现 JWT 签名、令牌解析或 OAuth/OIDC 协议状态机。

## 总体架构

```text
浏览器
  |
  | 1. 访问分站或受保护功能
  v
分站 Cloudflare Pages Function
  |
  | 2. Authorization Code + PKCE
  v
PACT OIDC Provider
  |
  | 3. 复用 pact_session，检查用户状态和分站权限
  | 4. 返回一次性授权码
  v
分站 Cloudflare Pages Function
  |
  | 5. 服务端换码并写入本站 Host-only HttpOnly Cookie
  v
分站页面与受保护接口
```

PACT 是 OpenID Provider。四个分站是独立的 confidential clients。浏览器从不接触客户端密钥，授权码只能由对应分站的 Pages Function 兑换。

OIDC issuer 固定为：

```text
https://www.periopact.cn/oidc
```

## PACT 身份中心

### 与现有登录的关系

- 现有 `pact_session` 继续只属于 `www.periopact.cn`。
- OIDC 授权请求先读取并验证现有 PACT 会话。
- 已登录用户直接进入授权检查，不再次输入密码。
- 未登录用户进入现有 PACT 登录页，成功后返回原授权请求。
- `mustChangePassword` 用户必须先完成密码修改，才能为分站签发授权。
- 已停用、已锁定或会话过期的用户不得获得分站授权。
- 第一方分站不显示冗余同意页；分站访问权由 PACT 管理员预先授予。

### 启用的协议能力

第一阶段只启用必要能力：

- Authorization Code Flow。
- PKCE，且只接受 `S256`。
- OIDC Discovery。
- Opaque access tokens。
- Token Introspection。
- Token Revocation。
- RP-Initiated Logout。
- 必要的 Session 和 Grant 级联撤销。

第一阶段不启用 implicit flow、password grant、device flow、动态客户端注册和 refresh token。分站会话最长不超过 PACT 主会话的剩余时间，最大 8 小时。

### 客户端登记

生产客户端固定为：

| Client ID | 回调地址 |
| --- | --- |
| `wxg-blog` | `https://blog.periopact.cn/auth/callback` |
| `wxg-annotate` | `https://annotate.periopact.cn/auth/callback` |
| `wxg-print` | `https://print.periopact.cn/auth/callback` |
| `wxg-view` | `https://view.periopact.cn/auth/callback` |

回调地址必须完整匹配，禁止通配符、相对地址和请求参数提供的任意跳转地址。客户端密钥只存在于 PACT 生产环境和对应 Cloudflare Secret 中。

四个分站均按 confidential client 配置，使用 `client_secret_basic` 进行 token 和 introspection 端点认证。生产客户端密钥彼此独立，不复用。

## 权限模型

在 PACT 增加独立的分站权限，不复用或扩散现有临床角色：

| 权限 | 作用 |
| --- | --- |
| `blog.access` | 在博客建立 PACT 身份会话，使用未来的受保护账户功能 |
| `annotate.access` | 进入标注工作台 |
| `print.access` | 进入活字印刷工作区 |
| `view.access` | 进入 PACT View 工作区 |

PACT 用户管理界面在每个用户旁提供四个清晰开关。仅 `admin:manageUsers` 权限的管理员可以修改。每次授予和撤销必须写入现有审计日志，记录操作者、目标用户、分站、变更前后状态和时间。

第一阶段不增加 `viewer`、`editor`、`manager` 等站内角色。将来出现真实需求时，通过新增 scope 扩展，不改变现有 `*.access` 语义。

## 数据模型

现有 `users`、`user_roles` 和 `sessions` 表保持不变。新增表均为增量迁移。

### `user_app_access`

```text
user_id       外键到 users.id
client_id     固定分站 Client ID
enabled       当前是否授权
granted_by    最近一次授权管理员
granted_at    最近一次授权时间
revoked_by    最近一次撤权管理员，可空
revoked_at    最近一次撤权时间，可空
updated_at    最后更新时间
```

`(user_id, client_id)` 唯一。撤权保留记录，不物理删除，以便审计和重复授权。

### `oidc_artifacts`

由 `oidc-provider` 的 PostgreSQL adapter 持久化授权码、Grant、Session、AccessToken 等协议对象。使用模型名和标识哈希作为主键，保存必要 payload、过期时间、使用状态及 Grant 索引。生产环境不得使用库默认的内存 adapter。

授权码默认 60 秒过期且只能消费一次。访问令牌为不透明随机值，数据库只保存可验证的哈希或协议 adapter 所需的受保护标识，不在应用日志中记录原值。

### 客户端配置

Client ID、显示名、允许回调地址和启用状态由 PACT 配置声明。客户端密钥从环境变量读取，不写入数据库迁移、源码、构建产物或审计日志。第一阶段不提供管理员动态新增 OIDC 客户端的界面。

## 最小身份声明

分站最多获得：

- `sub`：稳定的 PACT 用户 ID。
- `name`：显示名称。
- `picture`：头像地址或安全的头像标识，可空。
- `aud`：标准 audience，固定为当前 Client ID。
- `https://periopact.cn/claims/app_access`：当前分站的单一访问权限。
- `sid`：用于会话关联和退出的 OIDC Session ID。

不向分站下发密码哈希、密码盐、手机号、患者数据、科室、完整临床角色列表或其他分站权限。

## 分站集成

每个 Cloudflare Pages 项目提供相同职责的认证层：

```text
/auth/login               发起 OIDC 授权
/auth/callback            校验 state 和 PKCE，服务端换码
/auth/logout              发起全局退出
/api/auth/session         返回最小当前用户信息
受保护路由中间件          检查本站会话与对应 app_access
```

### Cookie

每个站使用独立 Cookie 名称，例如 `wxg_blog_session`、`wxg_print_session`。必须满足：

- `HttpOnly`
- `Secure`
- `SameSite=Lax`
- `Path=/`
- Host-only，不设置 `Domain`
- 过期时间不晚于 PACT 主会话和 OIDC Grant

令牌、客户端密钥和 PKCE verifier 不进入 `localStorage` 或可由页面脚本读取的长期存储。短时 `state` 和 PKCE 事务 Cookie 在回调成功或失败后立即清除。

### 自动登录体验

- 工具站的实际工作区是受保护入口。没有本站会话时直接发起 OIDC 授权；若 PACT 已登录且有权限，用户无需输入密码即可返回。
- 博客正文和工具介绍保持公开。博客可通过 `prompt=none` 的同站 iframe 完成静默会话发现；回调只向精确父级 origin 发送结果。
- 静默发现失败、没有 PACT 会话或没有 `blog.access` 时，博客继续匿名展示，不出现重定向循环。
- 浏览器阻止静默 iframe 时不尝试绕过隐私设置；博客保留公开状态，用户进入账户入口或受保护功能时再使用标准顶层跳转。
- 用户主动点击账户入口或受保护功能时，使用顶层 OIDC 跳转；若未登录则展示 PACT 登录页。
- 登录后导航栏统一显示 PACT 头像、姓名和账户菜单。

静默登录仅在正式 `*.periopact.cn` 域名启用。`pages.dev` 地址先跳转到正式域名，不在跨站第三方 Cookie 环境中尝试静默认证。

### 路由保护矩阵

| 站点 | 匿名可访问 | 需要权限 |
| --- | --- | --- |
| 博客 | 首页、文章、历程、工具介绍、公开反馈 | 登录身份功能；本地内容编辑器不在本项目范围内 |
| 标注工作台 | 博客中的介绍与入口说明 | 整个标注工作区需要 `annotate.access` |
| 活字印刷 | 博客中的介绍与入口说明 | 整个工作区需要 `print.access` |
| PACT View | 博客中的介绍与入口说明 | 整个工作区需要 `view.access` |
| PACT 主站与移动端 | 现有公开登录页 | 继续沿用 PACT 现有权限 |

工具站的入口 HTML 和任何服务端 API 必须由认证中间件保护。纯静态资源本身不承载秘密；真正的数据读写和同步接口不得依赖前端按钮隐藏，必须逐请求校验。

## 全局退出与撤权

任一分站点击退出时：

1. 分站清除本站会话 Cookie。
2. 浏览器跳转到 PACT RP-Initiated Logout。
3. PACT 删除当前 `pact_session`，撤销与该主会话关联的全部 OIDC Grant 和访问令牌。
4. 返回发起退出的正式分站地址。
5. 其他分站残留的 Host-only Cookie 即使仍存在，也因中央令牌已撤销而不能通过验证，并在下次会话检查时清除。

管理员撤权或停用账号时，PACT 同样撤销目标用户对应客户端或全部客户端的活动 Grant。所有受保护服务端请求实时 introspect，不缓存写权限。

当前工具主要是前端应用，已经加载进浏览器的代码无法被服务器远程删除。因此：

- 工具启动时必须验证会话。
- 页面重新获得焦点时重新验证。
- 页面每 60 秒进行一次会话心跳；撤权后最迟 60 秒锁定已打开的纯前端工作区。
- 任何服务端读取、保存、同步、上传或管理操作每次请求都实时验证，撤权后下一次请求立即拒绝。

## 安全要求

- 所有生产地址只允许 HTTPS。
- 授权请求必须使用随机 `state`、`nonce` 和 PKCE `S256`。
- 授权码只能使用一次，过期或重放返回通用错误并写安全审计。
- 客户端认证只在服务端进行。
- 回调地址、退出后地址和 iframe 父级 origin 均使用静态白名单。
- OIDC 交互页面和回调配置严格 CSP；静默 iframe 只允许约定的 `*.periopact.cn` 客户端 origin，不使用 `*`。
- PACT 现有 CSRF 检查继续保护状态变更接口；OIDC 端点采用库提供的协议防护。
- 每个分站的状态变更 Function 必须校验同源 `Origin`/`Referer` 和独立 CSRF token，不能只依赖 `SameSite` Cookie。
- token、code、client secret、Cookie 内容和患者数据不得进入日志。
- 登录失败、权限拒绝、授权码重放、撤权、退出和客户端配置变化写入安全审计。
- token、introspection 和授权入口分别配置速率限制。
- Cloudflare Secret 和 PACT 环境变量支持独立轮换；轮换期间允许短暂的双密钥过渡。
- 受保护能力故障时 fail closed，不回退为匿名写入或仅靠前端权限判断。

## 错误处理

| 场景 | 行为 |
| --- | --- |
| PACT 未登录 | 工具进入 PACT 登录页；博客保持匿名或在用户主动登录时进入登录页 |
| 用户无分站权限 | 返回明确的“当前 PACT 账户未获授权”，不暴露内部角色细节 |
| 授权码过期或已使用 | 清理临时事务 Cookie，允许用户重新发起一次登录 |
| `state`、PKCE 或回调不匹配 | 拒绝请求、写安全审计，不自动重试 |
| PACT 身份服务不可用 | 博客公开内容继续展示；工具和受保护操作显示服务暂不可用 |
| Introspection 返回失效 | 清除本站 Cookie，受保护请求返回 `401`，界面回到登录状态 |
| 权限被撤销 | 清除本站 Cookie，返回 `403`，显示无权限提示 |
| 连续回调失败 | 停止自动跳转，显示可重试错误，避免登录循环 |

## 源码与仓库前置工作

当前已确认 GitHub 中存在 PACT 私有仓库和 `xgblog` 仓库。活字印刷、PACT View 的可维护源码尚未在本机或 GitHub 定位到，不能直接基于线上压缩产物实施身份改造。

实施前必须：

1. 搜索 Windows 同步目录、历史备份和 Cloudflare 构建来源，优先找回原始源码。
2. 保存现有线上部署快照和行为基线。
3. 若原始源码确实无法找回，基于现有功能重新建立可维护源码，不直接长期编辑压缩 bundle。
4. 分别创建 `huozi-yinshua` 和 `pact-view` 私有 GitHub 仓库。
5. 为两个仓库建立可重复的 Cloudflare Pages 构建和发布流程。
6. 确认源码构建结果与现网核心功能一致后，再加入 SSO。

标注工作台继续由 `xgblog` 仓库维护。PACT、xgblog、活字印刷和 PACT View 保持独立仓库与独立部署。

## 发布顺序

采用全范围设计、分批上线：

### 阶段 0：源码和基线

- 完成活字印刷与 PACT View 源码恢复、私有仓库和可重复构建。
- 记录四个站点现有 URL、构建产物、关键功能和 Cloudflare 项目。
- 为现网部署建立可回退版本。

### 阶段 1：PACT 身份中心

- 增加 PostgreSQL 增量迁移、OIDC provider adapter 和用户分站权限。
- 增加 PACT 管理界面开关和审计。
- 通过 `PACT_SSO_ENABLED=0` 默认关闭新入口。
- 建立测试客户端，验证协议、安全和撤销，不改变现有登录路径。

### 阶段 2：博客与标注工作台

- 为 xgblog 增加 Pages Functions 认证层。
- 先接入博客身份显示和 `annotate.access` 工作区保护。
- 绑定并验证 `blog.periopact.cn`、`annotate.periopact.cn`。
- 小范围账号试用后再面向全部授权用户启用。

### 阶段 3：活字印刷与 PACT View

- 分别接入 OIDC 客户端和路由保护。
- 绑定 `print.periopact.cn`、`view.periopact.cn`。
- 验证文件加载、导出、三维渲染等原有功能不受认证中间件影响。

### 阶段 4：正式切换

- 完成所有浏览器和移动端验收。
- 开启生产客户端和正式权限分配。
- 对原 `pages.dev` 生产地址启用 `301` 跳转。
- 保留监控和回滚开关，观察审计日志和错误率。

## 功能开关与回滚

- PACT 全局开关：`PACT_SSO_ENABLED`。
- 每个 OIDC 客户端有独立启用状态。
- 每个分站有独立 `SSO_ENABLED` 配置。
- 所有数据库变更为新增表或索引，不改变现有密码和 PACT 主会话结构。
- 在正式切换前，关闭单个客户端即可让对应站恢复原公开模式；其他站不受影响。
- 原 `pages.dev` 地址在验收完成前保持可用。
- 正式跳转后若出现严重问题，可先撤销跳转并关闭对应客户端，再回退该站部署。
- PACT 身份中心回滚不得删除新增表，以保留审计和避免破坏旧部署；只关闭路由和功能开关。

## 测试策略

### PACT 服务端

- 现有 PACT 会话复用和未登录交互。
- 活跃、停用、锁定、必须修改密码用户的授权结果。
- 每个客户端的权限矩阵。
- 精确回调地址校验。
- PKCE、`state`、`nonce` 和授权码单次消费。
- 60 秒授权码过期。
- Opaque token introspection 和 revocation。
- 单客户端撤权、账号停用和全局退出的级联撤销。
- PostgreSQL adapter 的过期清理、消费状态和并发兑换。
- 审计内容不包含敏感令牌。

### 分站 Functions

- 登录事务 Cookie 的创建、校验和清理。
- 服务端换码与错误处理。
- Host-only Cookie 属性。
- 匿名公开路由和受保护路由矩阵。
- `401`、`403` 和身份服务不可用状态。
- 无权限和失效会话不会触发重定向循环。
- 客户端密钥不进入前端构建产物。

### 端到端

- 在 PACT 登录一次，依次打开四个分站，不再输入密码。
- 未登录用户访问博客保持公开，进入工具时才登录。
- 未获授权账号无法进入对应工具。
- 管理员在线撤权后，下一次受保护请求拒绝，已打开纯前端工具在 60 秒内锁定。
- 任一站退出后，PACT 与所有分站会话均失效。
- PACT 暂停时博客公开内容仍可访问，工具 fail closed。
- Chrome、Safari 和移动端浏览器完成真实自定义域名测试。
- 验证 GA 不因 OIDC 回调产生重复页面浏览事件。

## 监控与审计

至少记录以下聚合指标：

- 按客户端统计授权成功、登录要求、权限拒绝和协议错误。
- token 兑换、introspection 和退出的成功率与延迟。
- 各分站 `401`、`403`、`5xx` 数量。
- 授权码重放、非法回调和速率限制命中次数。

日志使用 trace ID 关联 PACT 和分站请求。不得记录 code、token、client secret、Cookie 或完整个人数据。

## 验收标准

1. 登录一次 PACT 后，进入四个获授权分站均不再输入密码。
2. PACT 管理员可以独立授予和撤销四个分站权限，操作有审计记录。
3. 未授权用户无法进入工具工作区，但可浏览博客和工具介绍。
4. PACT 原有主站、移动端、账户登录和临床权限无行为回归。
5. 授权码重放、伪造回调、错误 PKCE、错误 `state` 和跨站写请求均被拒绝。
6. 任一站全局退出、账号停用或撤权后，服务端保护立即生效；已加载纯前端工具在 60 秒内锁定。
7. PACT 不可用时公开内容仍可访问，受保护能力不会降级为匿名操作。
8. 浏览器中不存在跨子域共享的身份凭证 Cookie。
9. 前端产物、GitHub 和日志中不存在客户端密钥或令牌。
10. 正式子域名、HTTPS、回调白名单、`pages.dev` 跳转和 Cloudflare 部署均通过线上验证。
