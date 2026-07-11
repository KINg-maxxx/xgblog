# 评论/问题收集功能:一次性开通步骤

评论前端和接口代码已随站点一起部署(`functions/` 目录会被 `npm run deploy` 自动打包成 Pages Functions)。
但数据存储需要一次性开通 Cloudflare KV,大约 3 分钟:

## 1. 创建 KV namespace

```bash
cd 项目目录
npx wrangler kv namespace create COMMENTS
```

输出里有一个 `id = "xxxxxxxx"`。

## 2. 启用 wrangler.toml

把 `wrangler.toml.example` 重命名为 `wrangler.toml`,并把上一步的 id 填进去。
之后每次 `npm run deploy` 都会自动带上 KV 绑定。

## 3. 设置后台管理口令

评论收件箱接口(`/api/comments/all`、删除评论)用一个口令保护:

```bash
npx wrangler pages secret put COMMENTS_ADMIN_TOKEN --project-name xgblog
# 输入一个自己记得住的长口令
```

在本地后台(`npm run admin`)的「评论收件箱」设置里填同一个口令即可拉取线上评论。

## 4. 重新部署

```bash
npm run deploy
```

## 工作原理速记

- 访客第一次留言需填 昵称 + 邮箱(页面注明:邮箱仅用作注册用途,不会公开)。
- 服务端按来访 IP 记住这个身份,之后同一 IP 留言不再要求填写,且昵称固定。
- 邮箱和 IP 只存在 KV 里,公开接口永远不返回;只有带口令的后台接口能看到。
- 本地开发时 vite 中间件模拟同一套接口,数据存在 `.dev-data/comments.json`,不会提交进仓库。
- 每个 IP 两次留言之间有 15 秒冷却,内容上限 2000 字。
