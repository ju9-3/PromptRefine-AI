// LLM 服务封装 - 通过 /api/llm 调用 DashScope OpenAI 兼容模式
// 前端只调用同源 /api/llm，由 vite.config.js 的 plugin 转发到 DashScope，Key 不暴露

const ENDPOINT = '/api/llm'

// 底层调用 - 接收 OpenAI 兼容格式的 messages 数组
async function chat(messages, { temperature = 0.7, responseFormat = null } = {}) {
  const body = {
    messages,
    temperature,
    stream: false
  }
  if (responseFormat) {
    body.response_format = { type: responseFormat }
  }
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const text = await r.text()
  if (!r.ok) {
    throw new Error(`LLM 调用失败 ${r.status}: ${text}`)
  }
  const data = JSON.parse(text)
  const content = data?.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('LLM 返回内容为空')
  }
  return content
}

// 解析 JSON 返回（容错：模型可能输出 ```json ... ``` 包裹）
function parseJSON(content) {
  let s = content.trim()
  // 去掉 markdown 代码块
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '')
  }
  // 抽取第一个 { ... } 或 [ ... ]
  const start = s.search(/[{[]/)
  if (start > 0) s = s.slice(start)
  const end = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'))
  if (end > 0 && end < s.length - 1) s = s.slice(0, end + 1)
  return JSON.parse(s)
}

// ============= 1. 文案生成 =============
// 用用户当前 Prompt + 测试集需求，生成小红书文案
export async function generateContent(promptContent, requirement) {
  const messages = [
    {
      role: 'system',
      content: '你是一个严格遵守指令的内容生成器。按用户提供的 Prompt 输出文案，不要添加额外解释、不要包裹代码块，直接输出文案本身。'
    },
    {
      role: 'user',
      content: `下面是你需要严格执行的 Prompt：

---
${promptContent}
---

请基于上述 Prompt，为下面这条需求生成小红书内容：

需求标题：${requirement.requirement}
${requirement.detail ? `需求详情：${requirement.detail}` : ''}

只输出最终文案，不要解释、不要前后缀。`
    }
  ]
  return await chat(messages, { temperature: 0.85 })
}

// ============= 2. 四维评分 + Badcase 判定 =============
// PRD 8.2 四维：合规性 25% / 小红书平台适配度 25% / 内容价值 25% / 文案质感 25%
// PRD 8.3 输出：维度分、综合分、问题、原因、是否 Badcase、改进建议
const EVAL_SYSTEM_PROMPT = `你是一个严格的小红书内容评审官。你将根据系统预设的四维评分标准对生成内容进行评价。

# 四个维度（每维 0-100 分，等权重）

1. 合规性（25%）：内容是否违反广告法、医疗法规、平台规则；是否含违禁词、虚假宣传、绝对化用语（如"最""第一""绝对")、医疗承诺。
   - 任何违禁词或绝对化用语 ≤ 60
   - 涉及医疗承诺或虚假宣传 ≤ 50
2. 小红书平台适配度（25%）：是否符合小红书内容风格——第一视角、口语化、emoji 适度、有钩子、有真实场景细节。
   - 太硬广、太学术、太官方 ≤ 60
3. 内容价值（25%）：是否给用户带来具体可感知的价值——干货、共情、可操作建议、避坑。
4. 文案质感（25%）：标题、节奏、口吻、转折、emoji 与段落节奏的协调度。

# Badcase 判定
满足任一条件即判定为 Badcase：
- 任意一维评分 < 60
- 出现违禁词、绝对化用语、医疗承诺
- 内容空洞无价值、与需求完全不符
- 文案读起来像硬广或复读机

# 输出格式（严格 JSON，不要包裹 markdown）
{
  "scores": {
    "compliance": 0-100,
    "platform_fit": 0-100,
    "value": 0-100,
    "copy_quality": 0-100
  },
  "total": 0-100,
  "is_badcase": true/false,
  "main_issue": "主要问题（一句话）",
  "issue_reason": "问题原因（2-3 句话）",
  "improve_suggestion": "改进建议（2-3 句话）"
}`

export async function evaluateContent(content, requirement) {
  const messages = [
    { role: 'system', content: EVAL_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `需求：
- 标题：${requirement.requirement}
${requirement.detail ? `- 详情：${requirement.detail}` : ''}

待评测内容：
---
${content}
---

按四维评分标准严格评测，输出 JSON。`
    }
  ]
  const raw = await chat(messages, { temperature: 0.2, responseFormat: 'json_object' })
  return parseJSON(raw)
}

// ============= 3. 整体测试集汇总 =============
// PRD 8.3：平均综合分、各维度平均分、Badcase 数量、主要共性问题
export function summarizeEvaluation(results) {
  if (!results || results.length === 0) {
    return { avgTotal: 0, avgScores: { compliance: 0, platform_fit: 0, value: 0, copy_quality: 0 }, badcaseCount: 0, commonIssues: [] }
  }
  const sumTotal = results.reduce((s, r) => s + (r.total || 0), 0)
  const sumCompliance = results.reduce((s, r) => s + (r.scores?.compliance || 0), 0)
  const sumPlatform = results.reduce((s, r) => s + (r.scores?.platform_fit || 0), 0)
  const sumValue = results.reduce((s, r) => s + (r.scores?.value || 0), 0)
  const sumCopy = results.reduce((s, r) => s + (r.scores?.copy_quality || 0), 0)
  const badcaseCount = results.filter(r => r.is_badcase).length
  // 共性问题：把 main_issue 收集起来，简单返回出现频次最高的问题列表
  const issues = results.map(r => r.main_issue || '').filter(Boolean)
  const common = topFrequency(issues, 3)
  return {
    avgTotal: +(sumTotal / results.length).toFixed(1),
    avgScores: {
      compliance: +(sumCompliance / results.length).toFixed(1),
      platform_fit: +(sumPlatform / results.length).toFixed(1),
      value: +(sumValue / results.length).toFixed(1),
      copy_quality: +(sumCopy / results.length).toFixed(1)
    },
    badcaseCount,
    commonIssues: common
  }
}

function topFrequency(arr, topN) {
  const m = new Map()
  arr.forEach(s => {
    // 简化：取前 10 个字符做 key（避免完全相同的字符串太少）
    const key = s.slice(0, 10)
    m.set(key, (m.get(key) || 0) + 1)
  })
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN).map(e => e[0])
}

// ============= 4. Prompt 自动优化 =============
// PRD 7.2：根据 LLM Judge 评测结果 + Badcase 提出优化方案
const OPTIMIZE_SYSTEM_PROMPT = `你是一位 Prompt 优化专家。你将基于以下输入优化 Prompt：

# 你会收到
1. 原始 Prompt（当前版本）
2. LLM Judge 评测结果摘要（各维度平均分、Badcase 数量、共性问题、若干典型 Badcase 及改进建议）

# 优化原则（PRD 7.2）
1. 针对评测发现的问题做最小必要的优化，不要全部推翻重写。
2. 尽可能保留原有 Prompt 中的有效能力（已得分高的部分不要随意改动）。
3. 优化要可解释——清楚说明你针对哪个问题做了什么改动。
4. 输出的新 Prompt 必须是可执行的完整 Prompt 文本，不要包含 "以下是优化后的 Prompt：" 之类的解释语。

# 输出格式（严格 JSON，不要包裹 markdown）
{
  "optimized_prompt": "完整的新 Prompt 文本",
  "changes": [
    {
      "issue": "针对的问题",
      "action": "做的改动",
      "reason": "为什么这样改"
    }
  ],
  "expected_improvement": "预期 V2 会提升的维度或修复的 Badcase 类型"
}`

export async function optimizePrompt(currentPrompt, summary, badcaseSamples = []) {
  const userContent = `# 原始 Prompt（当前版本）

${currentPrompt}

# LLM Judge 评测摘要

- 平均综合分：${summary.avgTotal}
- 各维度平均分：合规 ${summary.avgScores.compliance} | 平台适配 ${summary.avgScores.platform_fit} | 内容价值 ${summary.avgScores.value} | 文案质感 ${summary.avgScores.copy_quality}
- Badcase 数量：${summary.badcaseCount}
- 主要共性问题：${(summary.commonIssues || []).join(' / ') || '无'}

# 典型 Badcase 样本（最多 3 条）

${badcaseSamples.length > 0
    ? badcaseSamples.map((b, i) => `## Badcase ${i + 1}\n- 生成内容：${b.content}\n- 主要问题：${b.main_issue}\n- 改进建议：${b.improve_suggestion}`).join('\n\n')
    : '（无典型 Badcase 样本）'}

# 任务

按 PRD 7.2 优化原则，输出优化后的 Prompt 与改动说明（严格 JSON）。`

  const messages = [
    { role: 'system', content: OPTIMIZE_SYSTEM_PROMPT },
    { role: 'user', content: userContent }
  ]
  const raw = await chat(messages, { temperature: 0.4, responseFormat: 'json_object' })
  return parseJSON(raw)
}

// ============= 5. 健康检查 =============
export async function healthCheck() {
  try {
    const r = await chat(
      [{ role: 'user', content: '回复 "OK"' }],
      { temperature: 0 }
    )
    return { ok: true, reply: r }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

// ============= 6. Badcase 回归（PRD 9.3）=============
// 对每条历史 Badcase，用新版本 Prompt 重新生成 + 评测，判断：
//   - 历史问题是否已修复（不再 Badcase 或同样问题不再出现）
//   - 是否引入了新的严重问题

const REGRESSION_SYSTEM_PROMPT = `你是一个 Badcase 回归评审官。你将收到一条历史 Badcase 与新版本 Prompt 在该 Badcase 原需求上重新生成的内容 + 评测结果，需要判断两件事：

1. 历史问题是否已修复
2. 是否引入新的严重问题

# 历史问题已修复的判定
- 新内容在该问题上不再出现（或 LLM Judge 不再判定为 Badcase）
- 即使新内容仍有 Badcase，但 main_issue 与原问题不同——视为"原问题已修复但出现新问题"

# 新引入严重问题的判定
- 出现违禁词、绝对化用语、医疗承诺等合规类新问题
- 内容与需求明显不符、读起来像硬广
- 任意一维评分 < 60

# 输出格式（严格 JSON，不要包裹 markdown）
{
  "fixed": true/false,                       // 原问题是否已修复
  "new_issue": true/false,                   // 是否引入新的严重问题
  "regression_status": "已修复" | "未修复" | "已修复但有新问题" | "仍为 Badcase",
  "compare_summary": "对比原 Badcase 和新内容，2-3 句话说明",
  "new_main_issue": "若 new_issue=true，新问题是什么（一句话）；否则为空字符串"
}`

export async function regressBadcase(badcase, newEvalItem) {
  const userContent = `# 历史 Badcase

- 原需求：${badcase.testItem?.requirement || badcase.requirement || '（无）'}
- 原 Badcase 内容：
${badcase.content}
- 原主要问题：${badcase.main_issue}
- 原问题原因：${badcase.issue_reason}

# 新版本在新版本 Prompt 下的生成与评测

- 新生成内容：
${newEvalItem.content}

- 新版本 LLM Judge 评分：综合 ${newEvalItem.total}，Badcase=${newEvalItem.is_badcase}
- 新版本主要问题：${newEvalItem.main_issue || '（无）'}

# 任务

按上述规则判断历史问题是否修复 + 是否引入新问题，输出严格 JSON。`

  const messages = [
    { role: 'system', content: REGRESSION_SYSTEM_PROMPT },
    { role: 'user', content: userContent }
  ]
  const raw = await chat(messages, { temperature: 0.2, responseFormat: 'json_object' })
  return parseJSON(raw)
}
