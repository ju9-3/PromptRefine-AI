import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import {
  saveEvaluation,
  clearEvaluation,
  addBadcaseFromEvaluation,
  saveRegression,
  clearRegression,
  getRegressableBadcases
} from '../store/store.js'
import { generateContent, evaluateContent, summarizeEvaluation, regressBadcase } from '../services/llm.js'

const DIM_LABELS = {
  compliance: '合规性',
  platform_fit: '平台适配',
  value: '内容价值',
  copy_quality: '文案质感'
}

export default function Evaluation() {
  const { testSet, currentVersion, versions, evaluations, regressions, badcases } = useStore()
  const [running, setRunning] = useState(false)
  const [regressing, setRegressing] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0, current: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // 默认评测当前版本
  const targetVersion = currentVersion || versions[versions.length - 1]
  const results = targetVersion ? (evaluations[targetVersion.id] || []) : []
  const summary = results.length > 0 ? summarizeEvaluation(results) : null

  // 回归
  const regressResults = targetVersion ? (regressions[targetVersion.id] || []) : []
  const regressable = targetVersion ? getRegressableBadcases(targetVersion.id) : []
  const canRegress = regressable.length > 0 && results.length > 0 && !regressing && !running
  const fixedCount = regressResults.filter(r => r.status === '已修复').length
  const newIssueCount = regressResults.filter(r => r.new_issue).length

  const canRun = testSet.length > 0 && targetVersion && !running && !regressing

  const showError = (msg) => { setError(msg); setNotice(''); setTimeout(() => setError(''), 4000) }
  const showNotice = (msg) => { setNotice(msg); setError(''); setTimeout(() => setNotice(''), 4000) }

  const handleRun = async () => {
    if (!targetVersion) {
      showError('请先到 Prompt 编辑页保存一个版本')
      return
    }
    if (testSet.length === 0) {
      showError('测试集为空，请先上传')
      return
    }
    setRunning(true)
    setError('')
    setNotice('')
    setProgress({ done: 0, total: testSet.length, current: '开始生成…' })

    const items = []
    try {
      for (let i = 0; i < testSet.length; i++) {
        const req = testSet[i]
        setProgress({ done: i, total: testSet.length, current: `生成第 ${i + 1} 条文案…` })
        const content = await generateContent(targetVersion.content, req)
        setProgress({ done: i, total: testSet.length, current: `评测第 ${i + 1} 条…` })
        const evalResult = await evaluateContent(content, req)
        items.push({
          testItemId: req.id,
          testItem: req,
          content,
          scores: evalResult.scores,
          total: evalResult.total,
          is_badcase: evalResult.is_badcase,
          main_issue: evalResult.main_issue,
          issue_reason: evalResult.issue_reason,
          improve_suggestion: evalResult.improve_suggestion
        })
        setProgress({ done: i + 1, total: testSet.length, current: `第 ${i + 1} 条完成` })
      }
      saveEvaluation(targetVersion.id, items)
      showNotice(`评测完成，平均综合分 ${summarizeEvaluation(items).avgTotal}`)
    } catch (e) {
      showError(e.message || '评测失败')
      // 已生成的部分也保存
      if (items.length > 0) {
        saveEvaluation(targetVersion.id, items)
      }
    } finally {
      setRunning(false)
      setProgress({ done: 0, total: 0, current: '' })
    }
  }

  const handleClear = () => {
    if (!targetVersion) return
    if (!confirm('确认清空当前版本的评测结果？')) return
    clearEvaluation(targetVersion.id)
    showNotice('已清空评测结果')
  }

  const handleAddBadcase = (item) => {
    if (!targetVersion) return
    const r = addBadcaseFromEvaluation(targetVersion.id, item.testItemId, item)
    if (!r.ok) {
      showError(r.error)
      return
    }
    showNotice('已加入 Badcase 库')
  }

  // ============= Badcase 回归（PRD 9.3）=============
  const handleRegress = async () => {
    if (!targetVersion) return
    if (regressable.length === 0) {
      showError('没有可回归的历史 Badcase（需要更早版本贡献 Badcase）')
      return
    }
    setRegressing(true)
    setError('')
    setNotice('')
    setProgress({ done: 0, total: regressable.length, current: '开始回归…' })
    const out = []
    try {
      for (let i = 0; i < regressable.length; i++) {
        const b = regressable[i]
        setProgress({ done: i, total: regressable.length, current: `回归 ${i + 1}/${regressable.length}：${b.main_issue.slice(0, 16)}…` })
        // 找到该 Badcase 原需求在新版本评测结果里的对应条目
        const newEvalItem = results.find(r => r.testItemId === b.testItemId)
        if (!newEvalItem) {
          // 没有对应条目（可能测试集已变更），跳过
          out.push({
            badcaseId: b.id,
            status: '未测试',
            fixed: false,
            new_issue: false,
            compare_summary: '当前测试集中已找不到原 Badcase 对应的需求条目，跳过',
            new_main_issue: ''
          })
          continue
        }
        const r = await regressBadcase(b, newEvalItem)
        out.push({
          badcaseId: b.id,
          status: r.regression_status || (r.fixed ? '已修复' : '未修复'),
          fixed: !!r.fixed,
          new_issue: !!r.new_issue,
          compare_summary: r.compare_summary || '',
          new_main_issue: r.new_main_issue || ''
        })
        setProgress({ done: i + 1, total: regressable.length, current: `第 ${i + 1} 条回归完成` })
      }
      saveRegression(targetVersion.id, out)
      const fx = out.filter(r => r.status === '已修复').length
      const ni = out.filter(r => r.new_issue).length
      showNotice(`回归完成：${fx}/${out.length} 已修复，${ni} 引入新问题`)
    } catch (e) {
      showError(`回归失败：${e.message}`)
      if (out.length > 0) saveRegression(targetVersion.id, out)
    } finally {
      setRegressing(false)
      setProgress({ done: 0, total: 0, current: '' })
    }
  }

  const handleClearRegression = () => {
    if (!targetVersion) return
    if (!confirm('确认清空当前版本的回归结果？')) return
    clearRegression(targetVersion.id)
    showNotice('已清空回归结果')
  }

  if (!targetVersion) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-ink">内容评测</h1>
        <section className="bg-white border border-line rounded-xl p-12 text-center">
          <div className="text-sm text-muted mb-4">尚未保存 Prompt 版本，无法评测</div>
          <Link to="/prompt" className="inline-block px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primaryDark">
            去输入 Prompt V1 →
          </Link>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">内容评测</h1>
          <p className="text-sm text-muted mt-1">
            对 <span className="text-ink font-medium">{targetVersion.version}</span> 在 {testSet.length} 条测试集上生成内容并按四维评分（PRD 第 8 章）+ Badcase 回归（PRD 9.3）
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRegress}
            disabled={!canRegress}
            className="px-4 py-2 border border-primary text-primary rounded-lg text-sm hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed"
            title={regressable.length > 0 ? `对 ${regressable.length} 条历史 Badcase 做回归测试` : '需要更早版本贡献 Badcase'}
          >
            {regressing ? `回归中 ${progress.done}/${progress.total}` : `🔁 Badcase 回归（${regressable.length}）`}
          </button>
          <button
            onClick={handleClear}
            disabled={results.length === 0 || running}
            className="px-4 py-2 border border-line text-ink rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            清空结果
          </button>
          <button
            onClick={handleRun}
            disabled={!canRun}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primaryDark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? `运行中 ${progress.done}/${progress.total}` : (results.length > 0 ? '重新评测' : '开始评测')}
          </button>
        </div>
      </div>

      {/* 提示 */}
      {notice && <div className="px-4 py-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">{notice}</div>}
      {error && <div className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

      {/* 进度条 */}
      {(running || regressing) && (
        <div className="bg-white border border-line rounded-xl p-4">
          <div className="flex items-center justify-between text-sm text-muted mb-2">
            <span>{progress.current}</span>
            <span>{progress.done} / {progress.total}</span>
          </div>
          <div className="h-2 bg-canvas rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs text-muted mt-2">
            {running
              ? `每条调用一次生成 + 一次评测，${testSet.length} 条约需 ${testSet.length * 8}-${testSet.length * 15} 秒`
              : `每条历史 Badcase 调用一次回归判定，${progress.total} 条约需 ${progress.total * 5}-${progress.total * 10} 秒`}
          </p>
        </div>
      )}

      {/* Badcase 回归结果 */}
      {regressResults.length > 0 && (
        <section className="bg-white border border-line rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-ink">Badcase 回归结果（{targetVersion.version}）</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                已修复 {fixedCount}/{regressResults.length}
              </span>
              {newIssueCount > 0 && (
                <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                  引入新问题 {newIssueCount}
                </span>
              )}
              <button
                onClick={handleClearRegression}
                className="text-xs text-muted hover:text-red-500"
              >
                清空回归
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {regressResults.map((r, idx) => {
              const b = badcases.find(x => x.id === r.badcaseId)
              return (
                <div key={r.badcaseId} className="border border-line rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 flex items-center justify-center bg-primary/10 text-primary rounded text-xs">
                        {idx + 1}
                      </span>
                      <span className="text-sm text-ink truncate">{b?.main_issue || '未知'}</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${regressStatusColor(r.status)}`}>
                      {r.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted">{r.compare_summary}</div>
                  {r.new_main_issue && (
                    <div className="text-xs text-red-600 mt-1">⚠ 新问题：{r.new_main_issue}</div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 汇总卡 */}
      {summary && (
        <section className="bg-white border border-line rounded-xl p-6">
          <h2 className="font-medium text-ink mb-4">测试集汇总（{targetVersion.version}）</h2>
          <div className="grid grid-cols-5 gap-4">
            <SummaryCard label="平均综合分" value={summary.avgTotal} sub="满分 100" highlight />
            <SummaryCard label="合规性" value={summary.avgScores.compliance} />
            <SummaryCard label="平台适配" value={summary.avgScores.platform_fit} />
            <SummaryCard label="内容价值" value={summary.avgScores.value} />
            <SummaryCard label="文案质感" value={summary.avgScores.copy_quality} />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-canvas p-4 rounded-lg">
              <div className="text-xs text-muted">Badcase 数量</div>
              <div className={`text-xl font-semibold mt-1 ${summary.badcaseCount > 2 ? 'text-red-600' : 'text-ink'}`}>
                {summary.badcaseCount} / {testSet.length}
              </div>
              <div className="text-xs text-muted mt-1">PRD 11.1 通过条件：≤ 2 条</div>
            </div>
            <div className="bg-canvas p-4 rounded-lg">
              <div className="text-xs text-muted">主要共性问题</div>
              <ul className="mt-1 text-sm text-ink/80 list-disc list-inside">
                {summary.commonIssues.length > 0
                  ? summary.commonIssues.map((s, i) => <li key={i}>{s}…</li>)
                  : <li>无明显共性问题</li>}
              </ul>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Link
              to="/prompt"
              className="text-sm text-primary hover:underline"
            >
              下一步：AI 优化 Prompt →
            </Link>
          </div>
        </section>
      )}

      {/* 每条结果 */}
      {results.length > 0 && (
        <section className="bg-white border border-line rounded-xl p-6">
          <h2 className="font-medium text-ink mb-4">逐条评测结果</h2>
          <div className="space-y-4">
            {results.map((r, idx) => (
              <div key={r.testItemId} className="border border-line rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 flex items-center justify-center bg-primary/10 text-primary rounded text-xs font-medium">
                      {idx + 1}
                    </span>
                    <span className="text-sm text-ink">{r.testItem.requirement}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.is_badcase && (
                      <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">Badcase</span>
                    )}
                    <span className={`text-xs px-2 py-1 rounded ${scoreColor(r.total)}`}>
                      综合 {r.total}
                    </span>
                  </div>
                </div>

                {/* 生成内容 */}
                <div className="bg-canvas p-3 rounded text-sm text-ink/80 whitespace-pre-wrap mb-3">
                  {r.content}
                </div>

                {/* 四维评分条 */}
                <div className="grid grid-cols-4 gap-3 mb-3">
                  {Object.entries(r.scores || {}).map(([k, v]) => (
                    <div key={k} className="bg-canvas p-2 rounded">
                      <div className="text-xs text-muted">{DIM_LABELS[k] || k}</div>
                      <div className={`text-lg font-semibold ${scoreTextColor(v)}`}>{v}</div>
                      <div className="h-1 bg-white rounded mt-1">
                        <div className="h-full bg-primary rounded" style={{ width: `${v}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* 问题与建议 */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <div className="text-muted mb-1">主要问题</div>
                    <div className="text-ink/80">{r.main_issue}</div>
                  </div>
                  <div>
                    <div className="text-muted mb-1">问题原因</div>
                    <div className="text-ink/80">{r.issue_reason}</div>
                  </div>
                  <div>
                    <div className="text-muted mb-1">改进建议</div>
                    <div className="text-ink/80">{r.improve_suggestion}</div>
                  </div>
                </div>

                {/* 操作 */}
                {r.is_badcase && (
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => handleAddBadcase(r)}
                      className="text-xs px-3 py-1 border border-primary text-primary rounded hover:bg-primary/5"
                    >
                      加入 Badcase 库
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {!running && results.length === 0 && !error && (
        <section className="bg-white border border-line rounded-xl p-12 text-center">
          <div className="text-sm text-muted mb-2">尚未评测</div>
          <p className="text-xs text-muted">点右上角"开始评测"，对 {testSet.length} 条测试集逐一调用 LLM 生成 + 评分</p>
        </section>
      )}

      <div className="flex justify-between">
        <Link to="/prompt" className="text-sm text-muted hover:text-primary">← 上一步：编辑 Prompt</Link>
        <Link to="/badcase" className="text-sm text-primary hover:underline">查看 Badcase 库 →</Link>
      </div>
    </div>
  )
}

function scoreColor(score) {
  if (score >= 80) return 'bg-green-100 text-green-700'
  if (score >= 70) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

function scoreTextColor(score) {
  if (score >= 80) return 'text-green-600'
  if (score >= 70) return 'text-amber-600'
  return 'text-red-600'
}

function regressStatusColor(status) {
  switch (status) {
    case '已修复': return 'bg-green-100 text-green-700'
    case '已修复但有新问题': return 'bg-amber-100 text-amber-700'
    case '未修复': return 'bg-red-100 text-red-700'
    case '仍为 Badcase': return 'bg-red-100 text-red-700'
    case '未测试': return 'bg-gray-100 text-gray-600'
    default: return 'bg-gray-100 text-ink'
  }
}

function SummaryCard({ label, value, sub = '', highlight = false }) {
  return (
    <div className={`p-4 rounded-lg ${highlight ? 'bg-primary/10' : 'bg-canvas'}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${highlight ? 'text-primary' : 'text-ink'}`}>{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  )
}
