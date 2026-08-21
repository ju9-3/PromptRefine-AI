import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { setCurrentVersion } from '../store/store.js'

export default function Versions() {
  const { versions, currentVersion } = useStore()
  const [selectedId, setSelectedId] = useState(currentVersion?.id || versions[versions.length - 1]?.id || null)
  const selected = versions.find(v => v.id === selectedId) || currentVersion || versions[versions.length - 1]

  const handleSetCurrent = (id) => {
    if (!confirm('确认将此版本设为当前版本？其它"当前版本"会被标记为"已废弃"。')) return
    setCurrentVersion(id)
    setSelectedId(id)
  }

  // 时间线按版本号倒序，最新在右
  const timeline = [...versions].sort((a, b) => a.version.localeCompare(b.version))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Prompt 版本管理</h1>
        <p className="text-sm text-muted mt-1">
          按迭代顺序保存 V1 → V2 → V3 → …，可查看每个版本的 Prompt、评分与验收结果（PRD 第 12 章）。
        </p>
      </div>

      {versions.length === 0 ? (
        <section className="bg-white border border-line rounded-xl p-12 text-center">
          <div className="text-sm text-muted mb-4">尚未保存任何版本</div>
          <Link
            to="/prompt"
            className="inline-block px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primaryDark"
          >
            去输入 Prompt V1 →
          </Link>
        </section>
      ) : (
        <>
          {/* 版本时间线 */}
          <section className="bg-white border border-line rounded-xl p-6">
            <h2 className="font-medium text-ink mb-4">版本时间线</h2>
            <div className="flex items-center gap-1 overflow-x-auto pb-2">
              {timeline.map((v, idx) => (
                <div key={v.id} className="flex items-center">
                  <button
                    onClick={() => setSelectedId(v.id)}
                    className={`px-4 py-2 rounded-lg border text-sm whitespace-nowrap ${
                      selectedId === v.id
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-line bg-canvas text-ink hover:bg-gray-100'
                    }`}
                  >
                    <div>{v.version}</div>
                    <div className="text-xs text-muted mt-0.5">
                      {v.score !== null ? `${v.score} 分` : '未评测'}
                    </div>
                  </button>
                  {idx !== timeline.length - 1 && (
                    <div className="w-6 h-px bg-line" />
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 版本详情 */}
          {selected && (
            <section className="bg-white border border-line rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold text-ink">{selected.version}</h2>
                  <span className={`text-xs px-2 py-1 rounded ${statusColor(selected.status)}`}>
                    {selected.status}
                  </span>
                </div>
                <div className="text-xs text-muted">创建时间：{selected.createdAt}</div>
              </div>

              {/* 关键指标 */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <DetailCard
                  label="综合评分"
                  value={selected.score !== null ? selected.score : '—'}
                  sub="满分 100（待评测后填充）"
                />
                <DetailCard
                  label="Badcase 数量"
                  value={selected.badcaseCount ?? 0}
                  sub="条"
                />
                <DetailCard
                  label="验收结果"
                  value={selected.acceptance || '尚未评测'}
                  sub="PRD 11.1 标准"
                />
              </div>

              {/* 版本说明 */}
              <div className="mb-4">
                <div className="text-xs text-muted mb-1">版本说明</div>
                <div className="text-sm text-ink/80">{selected.summary}</div>
              </div>

              {/* Prompt 内容 */}
              <div>
                <div className="text-xs text-muted mb-1">Prompt 内容</div>
                <pre className="text-xs text-ink/80 bg-canvas p-4 rounded-lg whitespace-pre-wrap font-mono leading-relaxed">
                  {selected.content}
                </pre>
              </div>

              {/* 操作按钮 */}
              {selected.status !== '当前版本' && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => handleSetCurrent(selected.id)}
                    className="px-4 py-2 border border-primary text-primary rounded-lg text-sm hover:bg-primary/5"
                  >
                    设为当前版本
                  </button>
                </div>
              )}
            </section>
          )}

          {/* 版本差异提示（仅当不是最老版本时） */}
          {selected && timeline.findIndex(v => v.id === selected.id) > 0 && (
            <section className="bg-white border border-line rounded-xl p-6">
              <h2 className="font-medium text-ink mb-3">与上一版本的差异</h2>
              {(() => {
                const idx = timeline.findIndex(v => v.id === selected.id)
                const prev = timeline[idx - 1]
                return (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-canvas p-4 rounded-lg">
                      <div className="text-xs text-muted mb-1">上一版本</div>
                      <div className="text-ink">{prev.version}</div>
                      <div className="text-xs text-muted mt-2">字符数 {prev.content.length}</div>
                    </div>
                    <div className="bg-canvas p-4 rounded-lg">
                      <div className="text-xs text-muted mb-1">当前版本</div>
                      <div className="text-ink">{selected.version}</div>
                      <div className="text-xs text-muted mt-2">字符数 {selected.content.length}</div>
                    </div>
                    <div className="col-span-2 text-sm text-ink/80">
                      字符数变化：<span className={selected.content.length >= prev.content.length ? 'text-green-600' : 'text-red-600'}>
                        {selected.content.length >= prev.content.length ? '+' : ''}{selected.content.length - prev.content.length}
                      </span>
                      （PRD 7.2：AI 优化应针对问题优化，同时尽可能保持原有有效能力）
                    </div>
                  </div>
                )
              })()}
            </section>
          )}
        </>
      )}

      <div className="flex justify-between">
        <Link to="/prompt" className="text-sm text-muted hover:text-primary">← 上一步：编辑 Prompt</Link>
        <Link to="/dashboard" className="text-sm text-primary hover:underline">返回工作台 →</Link>
      </div>
    </div>
  )
}

function statusColor(status) {
  switch (status) {
    case '当前版本': return 'bg-primary/10 text-primary'
    case '验收通过': return 'bg-green-100 text-green-700'
    case '已废弃': return 'bg-gray-200 text-gray-600'
    case '待验收': return 'bg-amber-100 text-amber-700'
    case '验收不通过': return 'bg-red-100 text-red-700'
    default: return 'bg-gray-100 text-ink'
  }
}

function DetailCard({ label, value, sub }) {
  return (
    <div className="bg-canvas p-4 rounded-lg">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-xl font-semibold text-ink mt-1">{value}</div>
      <div className="text-xs text-muted mt-1">{sub}</div>
    </div>
  )
}
