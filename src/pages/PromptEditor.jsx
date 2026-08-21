import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { savePromptAsNewVersion } from '../store/store.js'
import { optimizePrompt, summarizeEvaluation } from '../services/llm.js'

export default function PromptEditor() {
  const { testSet, currentVersion, versions, evaluations, badcases } = useStore()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [optimizing, setOptimizing] = useState(false)
  const [optimizeResult, setOptimizeResult] = useState(null) // {optimized_prompt, changes, expected_improvement}
  const [showDiff, setShowDiff] = useState(false)

  // 当 currentVersion 变化时，初始化编辑区内容
  useEffect(() => {
    if (currentVersion) {
      setDraft(currentVersion.content)
    } else if (!draft) {
      setDraft('')
    }
  }, [currentVersion?.id])

  const hasV1 = versions.length > 0
  const canEdit = testSet.length > 0

  // 当前版本是否有评测结果
  const hasEval = currentVersion && evaluations[currentVersion.id] && evaluations[currentVersion.id].length > 0

  const showNotice = (msg) => {
    setNotice(msg)
    setError('')
    setTimeout(() => setNotice(''), 3000)
  }
  const showError = (msg) => {
    setError(msg)
    setNotice('')
    setTimeout(() => setError(''), 4000)
  }

  const handleSave = () => {
    if (!canEdit) {
      showError('请先到测试集页面上传至少 1 条需求')
      return
    }
    if (!draft.trim()) {
      showError('Prompt 内容不能为空')
      return
    }
    if (currentVersion && draft.trim() === currentVersion.content.trim()) {
      showError('内容与当前版本完全一致，未发生变化')
      return
    }
    const nextNum = versions.length + 1
    const meta = {
      summary: hasV1
        ? `基于 V${versions.length} 的修改，保存为新版本 V${nextNum}`
        : `用户首次输入的初始 Prompt V1`,
      acceptance: hasV1 ? '待验收' : '初始版本'
    }
    const res = savePromptAsNewVersion(draft, meta)
    if (!res.ok) {
      showError(res.error)
      return
    }
    setOptimizeResult(null)
    showNotice(`已保存为 ${res.version.version}`)
  }

  // ============= AI 自动优化 =============
  const handleOptimize = async () => {
    if (!currentVersion) {
      showError('请先保存 Prompt 后再优化')
      return
    }
    if (!hasEval) {
      showError('请先到评测页面对当前版本做评测，再优化')
      return
    }
    setOptimizing(true)
    setError('')
    setNotice('')
    try {
      const evalItems = evaluations[currentVersion.id]
      const summary = summarizeEvaluation(evalItems)
      const badcaseSamples = evalItems
        .filter(r => r.is_badcase)
        .slice(0, 3)
        .map(r => ({
          content: r.content,
          main_issue: r.main_issue,
          improve_suggestion: r.improve_suggestion
        }))
      const result = await optimizePrompt(currentVersion.content, summary, badcaseSamples)
      setOptimizeResult(result)
      setShowDiff(true)
      showNotice('AI 优化方案已生成，请查看下方')
    } catch (e) {
      showError(`优化失败：${e.message}`)
    } finally {
      setOptimizing(false)
    }
  }

  // 接受 AI 优化的 Prompt，直接保存为新版本
  const handleAcceptOptimized = () => {
    if (!optimizeResult?.optimized_prompt) return
    const nextNum = versions.length + 1
    const changes = (optimizeResult.changes || []).map(c => `${c.issue} → ${c.action}`).join('；')
    const meta = {
      summary: `AI 优化自 ${currentVersion.version}：${changes || '针对评测问题优化'}`,
      acceptance: '待验收'
    }
    // 临时把 draft 切换为优化结果，保存
    setDraft(optimizeResult.optimized_prompt)
    const res = savePromptAsNewVersion(optimizeResult.optimized_prompt, meta)
    if (!res.ok) {
      showError(res.error)
      return
    }
    setOptimizeResult(null)
    setShowDiff(false)
    showNotice(`已接受 AI 优化并保存为 ${res.version.version}`)
  }

  // 拒绝优化方案
  const handleRejectOptimized = () => {
    setOptimizeResult(null)
    setShowDiff(false)
    showNotice('已忽略 AI 优化方案')
  }

  // 把优化方案应用到编辑区（不直接保存，用户可以再改）
  const handleApplyToEditor = () => {
    if (!optimizeResult?.optimized_prompt) return
    setDraft(optimizeResult.optimized_prompt)
    setOptimizeResult(null)
    setShowDiff(false)
    showNotice('已应用到编辑区，可继续修改后保存')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Prompt 编辑区</h1>
          <p className="text-sm text-muted mt-1">
            输入 V1、编辑、AI 自动优化（PRD 7.1 / 7.2 / 12.1）
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOptimize}
            disabled={!hasEval || optimizing}
            className="px-4 py-2 border border-primary text-primary rounded-lg text-sm hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed"
            title={hasEval ? '基于当前版本的评测结果让 AI 优化 Prompt' : '需要先在评测页评测当前版本'}
          >
            {optimizing ? 'AI 优化中…' : '✨ AI 自动优化'}
          </button>
          <button
            onClick={handleSave}
            disabled={!canEdit}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primaryDark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {hasV1 ? '保存为新版本' : '保存为 V1'}
          </button>
        </div>
      </div>

      {/* 提示 */}
      {notice && <div className="px-4 py-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">{notice}</div>}
      {error && <div className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

      {/* 当前版本状态 */}
      <section className="bg-white border border-line rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium text-ink">当前版本状态</h2>
            <p className="text-xs text-muted mt-1">
              {currentVersion
                ? `${currentVersion.version} · 创建于 ${currentVersion.createdAt} · ${currentVersion.score !== null ? `综合 ${currentVersion.score} / Badcase ${currentVersion.badcaseCount}` : '未评测'}`
                : '尚未保存任何版本'}
            </p>
          </div>
          {currentVersion && (
            <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">{currentVersion.status}</span>
          )}
        </div>
        {!canEdit && (
          <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded">
            ⚠ 测试集为空，请先<Link to="/testset" className="underline">上传测试集</Link>再编辑 Prompt。
          </div>
        )}
        {canEdit && !hasEval && (
          <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded">
            ⚠ 当前版本尚未评测，AI 优化需要基于评测结果。请先到<Link to="/evaluation" className="underline">评测页</Link>跑一轮评测。
          </div>
        )}
      </section>

      {/* Prompt 编辑区 */}
      <section className="bg-white border border-line rounded-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-ink">
            {hasV1 ? `编辑当前 Prompt（基于 ${currentVersion?.version}）` : '输入 Prompt V1'}
          </h2>
          <span className="text-xs text-muted">{draft.length} 字符</span>
        </div>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          disabled={!canEdit}
          placeholder={canEdit
            ? '在此粘贴你正在使用的 Prompt（第一版不负责从零生成初始 Prompt，PRD 7.1）'
            : '请先上传测试集后才能编辑 Prompt'}
          className="w-full h-72 text-sm text-ink bg-canvas p-4 rounded-lg font-mono leading-relaxed border border-line focus:outline-none focus:border-primary resize-y disabled:bg-gray-50 disabled:text-muted"
        />
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-muted">
            保存后形成新版本，老版本自动"已废弃"，可在
            <Link to="/versions" className="text-primary mx-1 hover:underline">版本管理</Link>查看
          </p>
          <span className="text-xs text-muted">
            {hasEval ? `评测平均分 ${currentVersion.score} / Badcase ${currentVersion.badcaseCount}` : '未评测，无法 AI 优化'}
          </span>
        </div>
      </section>

      {/* AI 优化方案展示 */}
      {optimizeResult && showDiff && (
        <section className="bg-white border-2 border-primary rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-primary">✨ AI 优化方案</h2>
              <p className="text-xs text-muted mt-1">基于 {currentVersion.version} 的评测结果生成，PRD 7.2</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleApplyToEditor}
                className="px-3 py-1.5 border border-line text-ink rounded text-sm hover:bg-gray-50"
              >
                应用到编辑区
              </button>
              <button
                onClick={handleRejectOptimized}
                className="px-3 py-1.5 border border-line text-muted rounded text-sm hover:bg-gray-50"
              >
                忽略
              </button>
              <button
                onClick={handleAcceptOptimized}
                className="px-3 py-1.5 bg-primary text-white rounded text-sm hover:bg-primaryDark"
              >
                接受并保存为 V{versions.length + 1}
              </button>
            </div>
          </div>

          {/* 预期改善 */}
          {optimizeResult.expected_improvement && (
            <div className="mb-4 bg-green-50 border border-green-200 px-3 py-2 rounded text-sm text-green-700">
              <span className="font-medium">预期改善：</span>{optimizeResult.expected_improvement}
            </div>
          )}

          {/* 变更说明 */}
          {Array.isArray(optimizeResult.changes) && optimizeResult.changes.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-ink mb-2">变更说明</h3>
              <div className="space-y-3">
                {optimizeResult.changes.map((c, i) => (
                  <div key={i} className="bg-canvas p-3 rounded text-sm">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <div className="text-xs text-muted">针对问题</div>
                        <div className="text-ink/80 mt-0.5">{c.issue}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted">做的改动</div>
                        <div className="text-ink/80 mt-0.5">{c.action}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted">为什么</div>
                        <div className="text-ink/80 mt-0.5">{c.reason}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prompt 对比 */}
          <div>
            <h3 className="text-sm font-medium text-ink mb-2">Prompt 对比</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-red-50/50 border border-line p-3 rounded">
                <div className="text-xs text-muted mb-2">原 Prompt（{currentVersion.version}）</div>
                <pre className="text-xs text-ink/80 whitespace-pre-wrap font-mono leading-relaxed">
                  {currentVersion.content}
                </pre>
              </div>
              <div className="bg-green-50/50 border-2 border-primary/30 p-3 rounded">
                <div className="text-xs text-primary mb-2">优化后 Prompt</div>
                <pre className="text-xs text-ink/80 whitespace-pre-wrap font-mono leading-relaxed">
                  {optimizeResult.optimized_prompt}
                </pre>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 下一步 */}
      <div className="flex justify-between">
        <Link to="/testset" className="text-sm text-muted hover:text-primary">← 上一步：测试集</Link>
        <div className="flex gap-3">
          <Link to="/evaluation" className="text-sm text-muted hover:text-primary">评测 →</Link>
          <Link to="/versions" className={`text-sm ${hasV1 ? 'text-primary hover:underline' : 'text-muted pointer-events-none cursor-not-allowed'}`}>版本管理 →</Link>
        </div>
      </div>
    </div>
  )
}
