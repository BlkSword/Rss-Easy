# ⚠️ 已归档 (Archived)

> **RSS-Post** 项目已于 2026 年 3 月归档，不再维护。

---

## 归档原因

RSS-Post 诞生于一个真实的痛点：**信息过载**。我每天面对大量 RSS 源、技术博客、安全资讯，苦于没有一个工具能帮我高效筛选和总结。所以我在 2026 年初启动了这个项目，希望用 AI 来解决这个问题。

项目做完了，功能也基本实现——双层 AI 分析、语义搜索、智能报告、邮件推送、自动化规则，技术栈也很现代（Next.js 16 + React 19 + PostgreSQL + pgvector + BullMQ）。可以说，它确实解决了我最初的问题。

**但 2025-2026 年 AI 行业的变化让这个项目失去了继续存在的意义：**

1. **AI 模型能力飞跃** — Claude、GPT-4、Gemini 等模型本身已经具备强大的信息处理能力，不再需要一个独立的"AI 中间层"来做摘要和分类
2. **MCP 协议的普及** — AI Agent 可以直接接入各种信息源，对话式交互比传统的 RSS 阅读器体验更好
3. **信息获取方式的转变** — 从"订阅 → 聚合 → 阅读"变成了"提问 → 回答"，用户不再需要手动管理 RSS 源

简单说，**这个项目解决的问题，已经被 AI 本身解决了**。

## 项目价值

虽然归档了，但这个项目不是白做的：

- **完整全栈经验** — 从需求分析到架构设计到部署上线，走完了整个产品周期
- **TypeScript 深度实践** — Next.js 16、React 19、Prisma 6、tRPC 等前沿技术栈
- **AI 工程化** — 双层分析架构、反思引擎、多模型适配、成本优化
- **产品思维** — 识别痛点 → 设计方案 → 实现 → 验证 → 果断止损

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) + React 19 + TypeScript 5 |
| UI | Tailwind CSS 4 + Ant Design 6 + shadcn/ui + Framer Motion |
| API | tRPC + REST |
| 数据库 | PostgreSQL 16 + Prisma 6 + pgvector |
| 队列 | Redis + BullMQ 5 |
| 认证 | JWT (jose) + HTTP-only Cookies |
| 部署 | Docker + Docker Compose |

## License

MIT

---

*感谢关注。如果你对项目中的某个模块感兴趣，欢迎 fork 或联系我。*

*— [BlkSword](https://github.com/BlkSword)*
