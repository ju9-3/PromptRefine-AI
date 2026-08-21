// Mock 数据中心 - 仅用于产品骨架展示，非真实 AI 结果
// PRD 第 6 章测试集示例 8 条需求
export const mockTestSet = [
  { id: 1, requirement: '油皮用户防晒需求', detail: '夏季油皮防晒霜推荐，控油不闷痘。' },
  { id: 2, requirement: '干皮用户护肤需求', detail: '冬季干皮补水保湿套装。' },
  { id: 3, requirement: '学生党平价产品需求', detail: '50 元内学生党彩妆推荐。' },
  { id: 4, requirement: '熬夜场景护肤需求', detail: '熬夜后急救护肤方案。' },
  { id: 5, requirement: '通勤场景产品需求', detail: '通勤防晒+补水组合。' },
  { id: 6, requirement: '夏季使用场景需求', detail: '夏季清爽护肤全套。' },
  { id: 7, requirement: '新手用户需求', detail: '新手化妆入门清单。' },
  { id: 8, requirement: '敏感肌用户需求', detail: '敏感肌修护水乳推荐。' }
]

// PRD 第 7 章 Prompt 管理
export const mockCurrentPrompt = `你是小红书文案专家，请基于用户需求生成一篇种草笔记：
1. 标题吸睛，包含数字/反差
2. 正文 200-300 字，分段清晰
3. 嵌入 3-5 个 emoji
4. 末尾附 5 个 hashtag`

export const mockOptimizedPrompt = `你是资深小红书种草文案专家，请基于用户需求生成一篇种草笔记：
1. 标题强吸睛，包含数字/反差/痛点词
2. 首段直击用户痛点，建立共鸣
3. 正文 200-300 字，使用分点排版
4. 嵌入 3-5 个场景化 emoji
5. 结尾给出可执行建议
6. 末尾附 5 个精准 hashtag，避免泛流量标签`

// PRD 第 12 章 版本管理
export const mockVersions = [
  {
    id: 'v1',
    version: 'V1',
    createdAt: '2026-08-15 14:32',
    status: '已废弃',
    score: 76,
    badcaseCount: 2,
    summary: '初始版本，标题吸引力一般，部分内容存在平台适配问题。',
    acceptance: '基线版本'
  },
  {
    id: 'v2',
    version: 'V2',
    createdAt: '2026-08-17 10:15',
    status: '验收通过',
    score: 83,
    badcaseCount: 1,
    summary: '增强首段共鸣与场景化表达，综合分提升 7 分。',
    acceptance: '通过：综合分提升 7 分（≥5），严重 Badcase 减少'
  },
  {
    id: 'v3',
    version: 'V3',
    createdAt: '2026-08-19 16:48',
    status: '当前版本',
    score: 85,
    badcaseCount: 1,
    summary: '微调 hashtag 策略，避免泛流量标签。',
    acceptance: '通过：综合分提升 2 分，Badcase 数量持平'
  }
]

// PRD 第 8 章 评测维度
export const mockDimensions = [
  { key: 'compliance', name: '合规性', weight: 25 },
  { key: 'platform', name: '小红书平台适配度', weight: 25 },
  { key: 'value', name: '内容价值', weight: 25 },
  { key: 'quality', name: '文案质感', weight: 25 }
]

// PRD 第 8.3 章 单条评测输出
export const mockEvaluations = mockTestSet.map((item, idx) => {
  const compliance = 75 + (idx % 4) * 3
  const platform = 72 + (idx % 5) * 2
  const value = 78 + (idx % 3) * 4
  const quality = 74 + (idx % 4) * 3
  const total = Math.round((compliance + platform + value + quality) / 4)
  const isBadcase = idx === 0 || idx === 3
  return {
    id: item.id,
    requirement: item.requirement,
    detail: item.detail,
    content: `这是一条基于 V3 Prompt 生成的小红书种草笔记示例。标题：${item.requirement}全攻略 🌿。正文：姐妹们看过来～针对${item.detail}整理了一份超实用清单，亲测有效，分点讲清楚每一步怎么做，新手也能秒懂。结尾：希望对你有帮助～ #${item.requirement} #护肤 #种草`,
    scores: { compliance, platform, value, quality },
    total,
    mainIssue: isBadcase
      ? '标题与首段缺乏强吸引力，平台适配度不足'
      : '内容基本符合规范，可优化 hashtag 精度',
    issueReason: isBadcase
      ? '缺少数字/反差词；首段没有直击痛点；emoji 摆放偏装饰性'
      : 'hashtag 偏泛流量，建议替换为更精准的细分标签',
    isBadcase,
    suggestion: isBadcase
      ? '重写标题强化数字反差；首段直击痛点；emoji 与内容场景强相关'
      : '替换 hashtag 为场景化长尾词'
  }
})

// 整体测试集评测结果
export const mockOverall = {
  avgTotal: Math.round(mockEvaluations.reduce((s, e) => s + e.total, 0) / mockEvaluations.length),
  avgCompliance: Math.round(mockEvaluations.reduce((s, e) => s + e.scores.compliance, 0) / mockEvaluations.length),
  avgPlatform: Math.round(mockEvaluations.reduce((s, e) => s + e.scores.platform, 0) / mockEvaluations.length),
  avgValue: Math.round(mockEvaluations.reduce((s, e) => s + e.scores.value, 0) / mockEvaluations.length),
  avgQuality: Math.round(mockEvaluations.reduce((s, e) => s + e.scores.quality, 0) / mockEvaluations.length),
  badcaseCount: mockEvaluations.filter(e => e.isBadcase).length,
  commonIssues: [
    'hashtag 偏泛流量，缺乏场景化长尾词',
    '首段未直击痛点，导致留存率偏低',
    '部分标题缺少数字/反差结构'
  ]
}

// PRD 第 9 章 Badcase
export const mockBadcases = [
  {
    id: 'bc-1',
    content: '油皮用户防晒需求全攻略 🌿',
    requirement: '油皮用户防晒需求',
    type: '平台适配问题',
    reason: '标题缺少数字反差；首段未直击油皮闷痘痛点；emoji 与防晒场景关联弱',
    foundVersion: 'V1',
    status: '已修复',
    regression: 'V3 回归通过'
  },
  {
    id: 'bc-2',
    content: '熬夜场景护肤急救方案 ✨',
    requirement: '熬夜场景护肤需求',
    type: '内容质量问题',
    reason: '通篇堆砌产品名，缺少可执行的急救步骤；用户价值弱',
    foundVersion: 'V1',
    status: '待修复',
    regression: 'V3 回归未通过'
  }
]

// PRD 第 10 章 A/B 测试
export const mockABTest = {
  triggeredAt: '2026-08-19 17:05',
  v1: {
    version: 'V1',
    avgTotal: 76,
    avgCompliance: 78,
    avgPlatform: 73,
    avgValue: 79,
    avgQuality: 74,
    badcaseCount: 2
  },
  v2: {
    version: 'V3',
    avgTotal: 85,
    avgCompliance: 84,
    avgPlatform: 86,
    avgValue: 86,
    avgQuality: 84,
    badcaseCount: 1
  },
  metrics: [
    { name: '综合平均分', v1: 76, v2: 85, delta: +9 },
    { name: '合规性', v1: 78, v2: 84, delta: +6 },
    { name: '小红书平台适配度', v1: 73, v2: 86, delta: +13 },
    { name: '内容价值', v1: 79, v2: 86, delta: +7 },
    { name: '文案质感', v1: 74, v2: 84, delta: +10 },
    { name: 'Badcase 数量', v1: 2, v2: 1, delta: -1 }
  ],
  fixedBadcases: ['bc-1'],
  newIssues: [],
  recommendation: '推荐采用 V3：综合分提升 9 分（≥5），严重 Badcase 数量减少，无新增严重问题。'
}

// PRD 第 11 章 验收标准
export const acceptanceStandard = {
  passScore: 5,
  passBadcaseDelta: 0
}
