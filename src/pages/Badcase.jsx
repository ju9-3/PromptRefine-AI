import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { updateBadcaseStatus, removeBadcase } from '../store/store.js'

const STATUS_OPTIONS = ['待修复', '已修复', '不修复']

export default function Badcase() {
  const { badcases, versions } = useStore()
  const [filter, setFilter] = useState('all') // all / 待修复 / 已修复 / 不修复
  const [notice, setNotice] = useState('')

  const showNotice = (m) => { setNotice(m); setTimeout(() => setNotice(''), 2500) }

  const versionMap = Object.fromEntries(versions.map(v => [v.id, v.version]))

  const filtered = filter === 'all' ? badcases : badcases.filter(b => b.status === filter)
  const counts = {
    all: badcases.length,
    '待修复': badcases.filter(b => b.status === '待修复').length,
    '已修复': badcases.filter(b => b.status === '已修复').length,
    '不修复': badcases.filter(b => b.status === '不修复').length
  }

  const handleStatus = (id, status) => {
    updateBadcaseStatus(id, status)
    showNotice(`已标记为：${status}`)
  }

  const handleRemove = (id) => {
    if (!confirm('确认从 Badcase 库中移除该条？')) return
    removeBadcase(id)
    showNotice('已移除')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Badcase 库</h1>
          <p className="text-sm text-muted mt-1">
            AI 识别 + 人工确认（PRD 9.2）；新版本可用 Badcase 库做定向回归测试
          </p>
        </div>
        <Link to="/evaluation" className="text-sm text-primary hover:underline">从评测页加入 Badcase →</Link>
      </div>

      {notice && (
        <div className="px-4 py-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">{notice}</div>
      )}

      {/* 状态过滤 */}
      <div className="flex gap-2">
        {['all', ...STATUS_OPTIONS].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs border ${
              filter === s
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-ink border-line hover:bg-gray-50'
            }`}
          >
            {s === 'all' ? `全部 (${counts.all})` : `${s} (${counts[s]})`}
          </button>
        ))}
      </div>

      {/* 列表 */}
      {filtered.length === 0 ? (
        <section className="bg-white border border-line rounded-xl p-12 text-center">
          <div className="text-sm text-muted mb-4">
            {badcases.length === 0
              ? 'Badcase 库为空，请先到评测页对内容做评测，并对 Badcase 点击"加入 Badcase 库"'
              : '当前过滤条件下无 Badcase'}
          </div>
          <Link to="/evaluation" className="inline-block px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primaryDark">
            去评测 →
          </Link>
        </section>
      ) : (
        <div className="space-y-4">
          {filtered.map(b => (
            <section key={b.id} className="bg-white border border-line rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                    {versionMap[b.versionId] || '未知版本'}
                  </span>
                  <span className="text-xs text-muted">{b.createdAt}</span>
                </div>
                <div className="flex items-center gap-2">
                  {STATUS_OPTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => handleStatus(b.id, s)}
                      className={`text-xs px-2 py-1 rounded border ${
                        b.status === s
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-ink border-line hover:bg-gray-50'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                  <button
                    onClick={() => handleRemove(b.id)}
                    className="text-xs text-muted hover:text-red-500 ml-2"
                  >
                    移除
                  </button>
                </div>
              </div>

              {/* 生成内容 */}
              <div className="bg-canvas p-3 rounded text-sm text-ink/80 whitespace-pre-wrap mb-3">
                {b.content}
              </div>

              {/* 问题与建议 */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="text-muted mb-1">主要问题</div>
                  <div className="text-ink/80">{b.main_issue}</div>
                </div>
                <div>
                  <div className="text-muted mb-1">问题原因</div>
                  <div className="text-ink/80">{b.issue_reason}</div>
                </div>
                <div>
                  <div className="text-muted mb-1">改进建议</div>
                  <div className="text-ink/80">{b.improve_suggestion}</div>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="flex justify-between">
        <Link to="/evaluation" className="text-sm text-muted hover:text-primary">← 返回评测</Link>
        <Link to="/abtest" className="text-sm text-primary hover:underline">下一步：A/B 测试 →</Link>
      </div>
    </div>
  )
}
