import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { saveABTest } from '../store/store.js'
import { generateContent, evaluateContent, summarizeEvaluation } from '../services/llm.js'

const DIM_LABELS = {
  compliance: '合规性',
  platform_fit: '平台适配',
  value: '内容价值',
  copy_quality: '文案质感'
}

export default function ABTest() {
  const { testSet, versions, evaluations } = useStore()
  const [baseId, setBaseId] = useState('')
  const [candidateId, setCandidateId] = useState('')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ phase: '', done: 0, total: 0 })
  const [error, setError] = useState('')
  const [result, setResult] = useState(null) // { baseSummary, candidateSummary, diff, recommendation }

  // 默认推荐：V1 vs 当前版本（如果不是 V1）；或最老 vs 最新
  const defaultBase = versions[0]
  const defaultCandidate = versions[versions.length - 1]

  const showErr = (m) => { setError(m); setTimeout(() => setError(''), 5000) }

  const canRun = testSet.length > 0 && versions.length >= 2 && baseId && candidateId && baseId !== candidateId && !running

  // 如果已有评测结果，复用，避免重复调用 LLM
  const getOrEval = async (version, phaseLabel) => {
    if (evaluations[version.id] && evaluations[version.id].length === testSet.length) {
      setProgress({ phase: `${phaseLabel} 已有评测结果，复用`, done: testSet.length, total: testSet.length })
      return evaluations[version.id]
    }
    const items = []
    for (let i = 0; i < testSet.length; i++) {
      const req = testSet[i]
      setProgress({ phase: `${phaseLabel} 生成 ${i + 1}/${testSet.length}`, done: i, total: testSet.length })
      const content = await generateContent(version.content, req)
      setProgress({ phase: `${phaseLabel} 评测 ${i + 1}/${testSet.length}`, done: i, total: testSet.length })
      const e = await evaluateContent(content, req)
      items.push({
        testItemId: req.id,
        testItem: req,
        content,
        scores: e.scores,
        total: e.total,
        is_badcase: e.is_badcase,
        main_issue: e.main_issue,
        issue_reason: e.issue_reason,
        improve_suggestion: e.improve_suggestion
      })
    }
    return items
  }

  const handleRun = async () => {
    if (baseId === candidateId) {
      showErr('基线版本与候选版本不能相同')
      return
    }
    const base = versions.find(v => String(v.id) === String(baseId))
    const candidate = versions.find(v => String(v.id) === String(candidateId))
    if (!base || !candidate) {
      showErr('请选择两个有效版本')
      return
    }
    setRunning(true)
    setError('')
    setResult(null)
    try {
      // 1. 跑基线
      setProgress({ phase: `准备 ${base.version}`, done: 0, total: testSet.length })
      const baseItems = await getOrEval(base, `${base.version}`)
      // 2. 跑候选
      setProgress({ phase: `准备 ${candidate.version}`, done: 0, total: testSet.length })
      const candidateItems = await getOrEval(candidate, `${candidate.version}`)

      // 3. 汇总
      const baseSummary = summarizeEvaluation(baseItems)
      const candidateSummary = summarizeEvaluation(candidateItems)

      // 4. 指标对比
      const metrics = [
        { key: 'avgTotal', label: '综合平均分', base: baseSummary.avgTotal, cand: candidateSummary.avgTotal },
        { key: 'compliance', label: '合规性平均分', base: baseSummary.avgScores.compliance, cand: candidateSummary.avgScores.compliance },
        { key: 'platform_fit', label: '平台适配平均分', base: baseSummary.avgScores.platform_fit, cand: candidateSummary.avgScores.platform_fit },
        { key: 'value', label: '内容价值平均分', base: baseSummary.avgScores.value, cand: candidateSummary.avgScores.value },
        { key: 'copy_quality', label: '文案质感平均分', base: baseSummary.avgScores.copy_quality, cand: candidateSummary.avgScores.copy_quality },
        { key: 'badcaseCount', label: 'Badcase 数量', base: baseSummary.badcaseCount, cand: candidateSummary.badcaseCount, lowerIsBetter: true }
      ]
      const improved = metrics.filter(m => m.lowerIsBetter ? m.cand < m.base : m.cand > m.base)
      const declined = metrics.filter(m => m.lowerIsBetter ? m.cand > m.base : m.cand < m.base)

      // 5. PRD 11.1 验收：综合分 ≥ 80 且 Badcase ≤ 2
      const candidateAcceptance = (candidateSummary.avgTotal >= 80 && candidateSummary.badcaseCount <= 2)
      const recommendation = candidateAcceptance
        ? `推荐采用 ${candidate.version}：综合分 ${candidateSummary.avgTotal} ≥ 80，Badcase ${candidateSummary.badcaseCount} ≤ 2`
        : `暂不推荐采用 ${candidate.version}：${candidateSummary.avgTotal < 80 ? `综合分 ${candidateSummary.avgTotal} < 80` : ''}${candidateSummary.avgTotal < 80 && candidateSummary.badcaseCount > 2 ? '，' : ''}${candidateSummary.badcaseCount > 2 ? `Badcase ${candidateSummary.badcaseCount} > 2` : ''}`

      const r = {
        base: { version: base.version, summary: baseSummary },
        candidate: { version: candidate.version, summary: candidateSummary },
        metrics,
        improved,
        declined,
        recommendation
      }
      setResult(r)

      // 6. 保存到 store
      saveABTest({
        baseVersionId: base.id,
        candidateVersionId: candidate.id,
        summary: r
      })
    } catch (e) {
      showErr(`A/B 测试失败：${e.message}`)
    } finally {
      setRunning(false)
      setProgress({ phase: '', done: 0, total: 0 })
    }
  }

  if (versions.length < 2) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-ink">A/B 测试</h1>
        <section className="bg-white border border-line rounded-xl p-12 text-center">
          <div className="text-sm text-muted mb-4">
            A/B 测试需要至少 2 个 Prompt 版本，当前只有 {versions.length} 个
          </div>
          <Link to="/prompt" className="inline-block px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primaryDark">
            先去保存更多版本 →
          </Link>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">A/B 测试</h1>
          <p className="text-sm text-muted mt-1">
            选 V1 与 V2 使用同一批 {testSet.length} 条测试集，分别生成 + 评测（PRD 第 10 章）
          </p>
        </div>
        <button
          onClick={handleRun}
          disabled={!canRun}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primaryDark disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? '运行中…' : '开始 A/B 测试'}
        </button>
      </div>

      {/* 提示 */}
      {error && <div className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

      {/* 版本选择 */}
      <section className="bg-white border border-line rounded-xl p-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-xs text-muted">基线版本（V1）</label>
            <select
              value={baseId}
              onChange={e => setBaseId(e.target.value)}
              disabled={running}
              className="w-full mt-1 px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:border-primary disabled:bg-gray-50"
            >
              <option value="">请选择…</option>
              {versions.map(v => (
                <option key={v.id} value={v.id}>
                  {v.version} {v.score !== null ? `（综合 ${v.score}）` : '（未评测）'} {v.status === '当前版本' ? '· 当前' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted">候选版本（V2）</label>
            <select
              value={candidateId}
              onChange={e => setCandidateId(e.target.value)}
              disabled={running}
              className="w-full mt-1 px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:border-primary disabled:bg-gray-50"
            >
              <option value="">请选择…</option>
              {versions.map(v => (
                <option key={v.id} value={v.id}>
                  {v.version} {v.score !== null ? `（综合 ${v.score}）` : '（未评测）'} {v.status === '当前版本' ? '· 当前' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-muted mt-3">
          💡 已评测过的版本会自动复用结果，避免重复调用 LLM。每跑一个新版本约需 {testSet.length * 10}-{testSet.length * 20} 秒。
        </p>
        <div className="mt-3">
          <button
            type="button"
            onClick={() => { setBaseId(String(defaultBase?.id || '')); setCandidateId(String(defaultCandidate?.id || '')) }}
            disabled={running}
            className="text-xs text-primary hover:underline"
          >
            自动选 {defaultBase?.version} vs {defaultCandidate?.version}
          </button>
        </div>
      </section>

      {/* 进度 */}
      {running && (
        <div className="bg-white border border-line rounded-xl p-4">
          <div className="flex items-center justify-between text-sm text-muted mb-2">
            <span>{progress.phase}</span>
            <span>{progress.done} / {progress.total}</span>
          </div>
          <div className="h-2 bg-canvas rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {/* 对比结果 */}
      {result && (
        <>
          {/* 推荐 */}
          <section className={`rounded-xl p-6 border ${
            result.candidate.summary.avgTotal >= 80 && result.candidate.summary.badcaseCount <= 2
              ? 'bg-green-50 border-green-200'
              : 'bg-amber-50 border-amber-200'
          }`}>
            <div className="text-sm text-muted mb-1">最终建议</div>
            <div className="text-lg font-medium text-ink">{result.recommendation}</div>
          </section>

          {/* 四维对比 */}
          <section className="bg-white border border-line rounded-xl p-6">
            <h2 className="font-medium text-ink mb-4">
              {result.base.version} vs {result.candidate.version} 对比
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="py-2">指标</th>
                    <th className="py-2 text-right">{result.base.version}</th>
                    <th className="py-2 text-right">{result.candidate.version}</th>
                    <th className="py-2 text-right">变化</th>
                    <th className="py-2 text-center">趋势</th>
                  </tr>
                </thead>
                <tbody>
                  {result.metrics.map(m => {
                    const delta = m.lowerIsBetter ? m.base - m.cand : m.cand - m.base
                    const isUp = delta > 0
                    const isFlat = delta === 0
                    return (
                      <tr key={m.key} className="border-b border-line/60">
                        <td className="py-3">{m.label}</td>
                        <td className="py-3 text-right">{m.base}</td>
                        <td className="py-3 text-right font-medium">{m.cand}</td>
                        <td className={`py-3 text-right ${isFlat ? 'text-muted' : isUp ? 'text-green-600' : 'text-red-600'}`}>
                          {isFlat ? '持平' : (isUp ? '+' : '') + delta.toFixed(1)}
                        </td>
                        <td className="py-3 text-center">
                          {isFlat ? '—' : isUp ? '↑' : '↓'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
              <div className="bg-green-50 border border-green-200 p-3 rounded">
                <div className="text-green-700 font-medium mb-1">提升项</div>
                {result.improved.length > 0
                  ? result.improved.map(m => <div key={m.key}>· {m.label}</div>)
                  : <div className="text-muted">无</div>}
              </div>
              <div className="bg-red-50 border border-red-200 p-3 rounded">
                <div className="text-red-700 font-medium mb-1">下降项</div>
                {result.declined.length > 0
                  ? result.declined.map(m => <div key={m.key}>· {m.label}</div>)
                  : <div className="text-muted">无</div>}
              </div>
            </div>
          </section>

          {/* 雷达式文字版四维 */}
          <section className="bg-white border border-line rounded-xl p-6">
            <h2 className="font-medium text-ink mb-4">四维平均分对比</h2>
            <div className="grid grid-cols-4 gap-4">
              {Object.entries(DIM_LABELS).map(([key, label]) => {
                const b = result.base.summary.avgScores[key]
                const c = result.candidate.summary.avgScores[key]
                const max = Math.max(b, c, 100)
                return (
                  <div key={key} className="bg-canvas p-4 rounded-lg">
                    <div className="text-xs text-muted">{label}</div>
                    <div className="flex items-end gap-1 mt-1">
                      <span className="text-sm text-ink/60">{b}</span>
                      <span className="text-xs text-muted">→</span>
                      <span className={`text-lg font-semibold ${c >= b ? 'text-green-600' : 'text-red-600'}`}>{c}</span>
                    </div>
                    <div className="h-2 bg-white rounded mt-2 overflow-hidden">
                      <div className="h-full bg-primary rounded transition-all" style={{ width: `${(c / max) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}

      <div className="flex justify-between">
        <Link to="/badcase" className="text-sm text-muted hover:text-primary">← 上一步：Badcase 库</Link>
        <Link to="/versions" className="text-sm text-primary hover:underline">版本管理 →</Link>
      </div>
    </div>
  )
}
