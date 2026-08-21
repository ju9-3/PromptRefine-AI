// 本地状态层 - 使用 localStorage 持久化
// 阶段 2/3：管理测试集 / Prompt 版本 / 评测结果 / Badcase 库 / A-B 测试

const STORAGE_KEY = 'contentflow_state_v1'
export const MAX_TESTSET_SIZE = 8

// 默认空状态 - 用户首次进入系统时使用
function createDefaultState() {
  return {
    testSet: [],            // 测试集：[{id, requirement, detail}]
    versions: [],           // Prompt 版本：[{id, version, content, createdAt, status, score, badcaseCount, summary, acceptance, evalSummary}]
    currentVersionId: null, // 当前版本 ID
    evaluations: {},        // 评测结果：{ [versionId]: [{ testItemId, content, scores, total, is_badcase, main_issue, issue_reason, improve_suggestion }] }
    badcases: [],           // Badcase 库：[{ id, versionId, testItemId, content, main_issue, issue_reason, improve_suggestion, status, fixedByVersionId, createdAt }]
    abtests: [],            // A/B 测试记录：[{ id, baseVersionId, candidateVersionId, createdAt, summary }]
    regressions: {}         // Badcase 回归结果：{ [versionId]: [{ badcaseId, status, fixed, new_issue, compare_summary, new_main_issue }] }
  }
}

// 读取 + 解析
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createDefaultState()
    const parsed = JSON.parse(raw)
    return {
      testSet: Array.isArray(parsed.testSet) ? parsed.testSet : [],
      versions: Array.isArray(parsed.versions) ? parsed.versions : [],
      currentVersionId: parsed.currentVersionId ?? null,
      evaluations: typeof parsed.evaluations === 'object' && parsed.evaluations ? parsed.evaluations : {},
      badcases: Array.isArray(parsed.badcases) ? parsed.badcases : [],
      abtests: Array.isArray(parsed.abtests) ? parsed.abtests : [],
      regressions: typeof parsed.regressions === 'object' && parsed.regressions ? parsed.regressions : {}
    }
  } catch {
    return createDefaultState()
  }
}

// 写入
function persist(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  // 同步派发事件，便于跨组件订阅
  window.dispatchEvent(new CustomEvent('contentflow:change'))
}

// ============= 测试集 API =============

export function getTestSet() {
  return load().testSet
}

export function addTestItem(requirement, detail) {
  const state = load()
  if (state.testSet.length >= MAX_TESTSET_SIZE) {
    return { ok: false, error: `测试集最多 ${MAX_TESTSET_SIZE} 条，请先删除不需要的条目` }
  }
  if (!requirement || !requirement.trim()) {
    return { ok: false, error: '需求标题不能为空' }
  }
  state.testSet.push({
    id: Date.now(),
    requirement: requirement.trim(),
    detail: (detail || '').trim()
  })
  persist(state)
  return { ok: true }
}

export function updateTestItem(id, requirement, detail) {
  const state = load()
  const item = state.testSet.find(i => i.id === id)
  if (!item) return { ok: false, error: '条目不存在' }
  item.requirement = (requirement || '').trim()
  item.detail = (detail || '').trim()
  persist(state)
  return { ok: true }
}

export function removeTestItem(id) {
  const state = load()
  state.testSet = state.testSet.filter(i => i.id !== id)
  persist(state)
  return { ok: true }
}

export function clearTestSet() {
  const state = load()
  state.testSet = []
  persist(state)
  return { ok: true }
}

// ============= Prompt 版本 API =============

export function getVersions() {
  return load().versions
}

export function getCurrentVersion() {
  const state = load()
  return state.versions.find(v => v.id === state.currentVersionId) || null
}

export function savePromptAsNewVersion(content, meta = {}) {
  const state = load()
  if (!content || !content.trim()) {
    return { ok: false, error: 'Prompt 内容不能为空' }
  }
  const nextVersionNum = state.versions.length + 1
  const newVersion = {
    id: Date.now(),
    version: `V${nextVersionNum}`,
    content: content.trim(),
    createdAt: formatNow(),
    status: nextVersionNum === 1 ? '当前版本' : '待验收',
    score: meta.score ?? null,
    badcaseCount: meta.badcaseCount ?? 0,
    summary: meta.summary || `用户保存的 V${nextVersionNum} 版本 Prompt`,
    acceptance: meta.acceptance || '尚未评测'
  }
  // 老的"当前版本"标记为已废弃
  state.versions.forEach(v => {
    if (v.status === '当前版本') v.status = '已废弃'
  })
  state.versions.push(newVersion)
  state.currentVersionId = newVersion.id
  persist(state)
  return { ok: true, version: newVersion }
}

export function updateVersion(id, patch) {
  const state = load()
  const v = state.versions.find(x => x.id === id)
  if (!v) return { ok: false, error: '版本不存在' }
  Object.assign(v, patch)
  persist(state)
  return { ok: true }
}

export function setCurrentVersion(id) {
  const state = load()
  if (!state.versions.find(v => v.id === id)) {
    return { ok: false, error: '版本不存在' }
  }
  state.versions.forEach(v => {
    if (v.id === id) v.status = '当前版本'
    else if (v.status === '当前版本') v.status = '已废弃'
  })
  state.currentVersionId = id
  persist(state)
  return { ok: true }
}

// ============= 评测结果 API =============

// 写入某版本的评测结果（整批写）
export function saveEvaluation(versionId, items) {
  const state = load()
  state.evaluations[versionId] = items
  // 同步更新 version 的 score / badcaseCount
  const v = state.versions.find(x => x.id === versionId)
  if (v && items.length > 0) {
    const total = items.reduce((s, r) => s + (r.total || 0), 0)
    v.score = +(total / items.length).toFixed(1)
    v.badcaseCount = items.filter(r => r.is_badcase).length
    v.evalSummary = {
      avgTotal: v.score,
      avgScores: avgScores(items),
      badcaseCount: v.badcaseCount,
      commonIssues: topIssues(items.map(i => i.main_issue).filter(Boolean))
    }
    // PRD 11.1 验收：相对上一版本对比（综合分提升 ≥ 5 且 Badcase 不增）
    // 没有上一版本时（V1）标记为"初始版本"
    v.acceptance = computeAcceptance(v, state.versions)
  }
  persist(state)
  return { ok: true }
}

// PRD 11.1 验收规则：相对上一版本对比
// 1. 综合平均分较上一版本提升 ≥ 5 分
// 2. 严重 Badcase 数量不得增加
function computeAcceptance(currentVersion, allVersions) {
  // 找出此版本之前的最近版本（按版本号排序）
  const sorted = [...allVersions].sort((a, b) => a.version.localeCompare(b.version))
  const idx = sorted.findIndex(v => v.id === currentVersion.id)
  if (idx <= 0) return '初始版本' // V1
  const prev = sorted[idx - 1]
  if (prev.score == null) return '待验收（上版本未评测）'
  if (currentVersion.score == null) return '待验收'
  const scoreDelta = currentVersion.score - prev.score
  const badcaseDelta = currentVersion.badcaseCount - prev.badcaseCount
  if (scoreDelta >= 5 && badcaseDelta <= 0) {
    return `验收通过（+${scoreDelta.toFixed(1)} 分 / Badcase ${badcaseDelta >= 0 ? '+' : ''}${badcaseDelta}）`
  }
  return `验收不通过（${scoreDelta >= 0 ? '+' : ''}${scoreDelta.toFixed(1)} 分${scoreDelta < 5 ? ' < 5' : ''} / Badcase ${badcaseDelta >= 0 ? '+' : ''}${badcaseDelta}）`
}

// 仅重算验收状态（不重新保存评测）
export function recomputeAcceptance() {
  const state = load()
  state.versions.forEach(v => {
    if (v.score != null) {
      v.acceptance = computeAcceptance(v, state.versions)
    } else {
      v.acceptance = '待验收'
    }
  })
  persist(state)
}

export function getEvaluation(versionId) {
  return load().evaluations[versionId] || []
}

export function clearEvaluation(versionId) {
  const state = load()
  delete state.evaluations[versionId]
  const v = state.versions.find(x => x.id === versionId)
  if (v) {
    v.score = null
    v.badcaseCount = 0
    v.acceptance = '待验收'
    v.evalSummary = null
  }
  persist(state)
  return { ok: true }
}

// ============= Badcase 库 API =============

export function getBadcases() {
  return load().badcases
}

// 把某版本的评测 Badcase 加入 Badcase 库
export function addBadcaseFromEvaluation(versionId, testItemId, evalItem) {
  const state = load()
  // 同源去重
  if (state.badcases.find(b => b.versionId === versionId && b.testItemId === testItemId)) {
    return { ok: false, error: '该条已是 Badcase' }
  }
  state.badcases.push({
    id: Date.now(),
    versionId,
    testItemId,
    content: evalItem.content,
    main_issue: evalItem.main_issue,
    issue_reason: evalItem.issue_reason,
    improve_suggestion: evalItem.improve_suggestion,
    status: '待修复', // 待修复 / 已修复 / 不修复
    createdAt: formatNow()
  })
  persist(state)
  return { ok: true }
}

export function updateBadcaseStatus(id, status) {
  const state = load()
  const b = state.badcases.find(x => x.id === id)
  if (!b) return { ok: false, error: 'Badcase 不存在' }
  b.status = status
  persist(state)
  return { ok: true }
}

export function removeBadcase(id) {
  const state = load()
  state.badcases = state.badcases.filter(b => b.id !== id)
  persist(state)
  return { ok: true }
}

// ============= A/B 测试 API =============

export function getABTests() {
  return load().abtests
}

export function saveABTest({ baseVersionId, candidateVersionId, summary }) {
  const state = load()
  const t = {
    id: Date.now(),
    baseVersionId,
    candidateVersionId,
    createdAt: formatNow(),
    summary
  }
  state.abtests.push(t)
  persist(state)
  return { ok: true, abtest: t }
}

export function getABTest(id) {
  return load().abtests.find(t => t.id === id)
}

// ============= Badcase 回归 API（PRD 9.3）=============

export function getRegression(versionId) {
  return load().regressions[versionId] || []
}

// 整批写入某版本的 Badcase 回归结果
export function saveRegression(versionId, results) {
  const state = load()
  state.regressions[versionId] = results
  // 同步更新 Badcase 的"修复状态"
  results.forEach(r => {
    const b = state.badcases.find(x => x.id === r.badcaseId)
    if (b) {
      if (r.status === '已修复') {
        b.status = '已修复'
        b.fixedByVersionId = versionId
      } else if (r.status === '已修复但有新问题' || r.status === '未修复') {
        // 保留原"待修复"或"已修复"状态，只有"已修复"才升级
        if (b.status !== '已修复') b.status = '待修复'
      }
    }
  })
  persist(state)
  return { ok: true }
}

export function clearRegression(versionId) {
  const state = load()
  delete state.regressions[versionId]
  persist(state)
  return { ok: true }
}

// 找到某版本可回归的 Badcase 集合：来自更早版本 + 仍标记为"待修复"的
export function getRegressableBadcases(versionId) {
  const state = load()
  const sorted = [...state.versions].sort((a, b) => a.version.localeCompare(b.version))
  const idx = sorted.findIndex(v => v.id === versionId)
  if (idx < 0) return []
  // 更早版本的所有 Badcase + 当前版本本身发现的新 Badcase 都参与回归（PRD 9.3：历史 Badcase）
  const earlierVersionIds = new Set(sorted.slice(0, idx).map(v => v.id))
  return state.badcases.filter(b => earlierVersionIds.has(b.versionId))
}

// ============= 订阅 =============

export function subscribe(callback) {
  const handler = () => callback()
  window.addEventListener('contentflow:change', handler)
  // 跨 tab 同步
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener('contentflow:change', handler)
    window.removeEventListener('storage', handler)
  }
}

// ============= 工具 =============

function avgScores(items) {
  if (!items.length) return { compliance: 0, platform_fit: 0, value: 0, copy_quality: 0 }
  const sum = (k) => items.reduce((s, r) => s + (r.scores?.[k] || 0), 0)
  return {
    compliance: +(sum('compliance') / items.length).toFixed(1),
    platform_fit: +(sum('platform_fit') / items.length).toFixed(1),
    value: +(sum('value') / items.length).toFixed(1),
    copy_quality: +(sum('copy_quality') / items.length).toFixed(1)
  }
}

function topIssues(arr, topN = 3) {
  const m = new Map()
  arr.forEach(s => {
    const key = (s || '').slice(0, 10)
    if (!key) return
    m.set(key, (m.get(key) || 0) + 1)
  })
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN).map(e => e[0])
}

// ============= 工具 =============

function formatNow() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
