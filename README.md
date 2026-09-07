# PromptRefine AI

> 小红书内容运营人员的 Prompt 评测与自动迭代工作台

## 项目简介

PromptRefine AI 是一个面向小红书内容文案运营人员的 Prompt 评测与自动迭代工作台。核心闭环：

```
上传测试集 → 输入 Prompt → 批量生成 → AI 四维评测 → 发现问题 → AI 优化 Prompt → A/B 测试 → Badcase 回归 → 验收 → 保存版本
```

## 技术栈

| 层面 | 技术 |
|---|---|
| 前端框架 | React 18 + React Router 6 |
| 构建工具 | Vite 5 |
| 样式 | Tailwind CSS 3 |
| 状态管理 | localStorage（无后端，纯前端运行） |
| LLM 服务 | DashScope（OpenAI 兼容模式），通过 Vite 代理转发 |

## 安装与运行

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API Key

复制 `.env.example` 为 `.env.local`，填入你的 DashScope API Key：

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```
DASHSCOPE_API_KEY=你的API Key
```

DashScope API Key 获取地址：https://dashscope.console.aliyun.com/

### 3. 启动开发服务器

```bash
npm run dev
```

浏览器打开终端显示的地址（通常为 http://localhost:5173）

## 功能模块

| 页面 | 说明 |
|---|---|
| 工作台 | 当前版本概览、评分、下一步引导 |
| 测试集上传 | 上传 8 条小红书内容需求 |
| Prompt 编辑 | 输入/编辑 Prompt，AI 自动优化，接受/编辑/重新生成 |
| 评测结果 | 四维评分（合规性/平台适配/内容价值/文案质感），Badcase 标记 |
| A/B 测试 | V1 vs V2 对比，验收规则自动判断 |
| Badcase | 问题库管理，回归测试 |
| 版本管理 | V1→V2→V3 历史版本时间线 |

## 四维评测模型

| 维度 | 权重 | 说明 |
|---|---|---|
| 合规性 | 25% | 内容是否合规 |
| 小红书平台适配度 | 25% | 是否符合平台风格 |
| 内容价值 | 25% | 对用户的价值 |
| 文案质感 | 25% | 文案写作质量 |

## 验收标准

- 综合分提升 ≥ 5 分
- Badcase 数量较上一版本不增加
## 页面展示
![平台首页](images/屏幕截图%202026-09-07%20190140.png)
## 项目结构

```
PromptRefine-ai/
├── src/
│   ├── components/     # Layout, Sidebar
│   ├── pages/          # 7 个核心页面
│   ├── services/       # llm.js — LLM 服务层
│   ├── store/          # store.js + useStore.js — 数据持久化
│   ├── App.jsx         # 路由配置
│   └── main.jsx
├── index.html
├── vite.config.js      # Vite 配置（含 LLM 代理）
└── tailwind.config.js
```

## 说明

- 本项目为 MVP 版本，数据存储在浏览器 localStorage 中，不涉及后端和数据库
- LLM 请求通过 Vite 开发代理转发，API Key 不暴露在前端代码中
- 不配置 API Key 时网页可以打开，但所有 AI 功能（生成/评测/优化）不可用
