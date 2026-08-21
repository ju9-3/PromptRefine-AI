import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore.js'

export default function Dashboard() {
  const { testSet, versions, currentVersion, maxTestSetSize } = useStore()
  const recentVersions = [...versions].reverse().slice(0, 3)

  // 当前版本号 + 完成度
  const currentVersionLabel = currentVersion ? currentVersion.version : '未创建'
  const testSetProgress = `${testSet.length}/${maxTestSetSize}`
  const testSetReady = testSet.length === maxTestSetSize

  // 引导下一步
  let nextStep = null
  if (testSet.length === 0) {
    nextStep = { to: '/testset', label: '上传测试集需求', desc: 'MVP 标准需 8 条真实需求' }
  } else if (!currentVersion) {
    nextStep = { to: '/prompt', label: '输入 Prompt V1', desc: '粘贴你正在使用的 Prompt' }
  } else if (versions.length === 1) {
    nextStep = { to: '/prompt', label: '基于 V1 创建下一版本', desc: '修改 Prompt 后保存为新版本' }
  } else {
    nextStep = { to: '/versions', label: '查看版本管理', desc: `已有 ${versions.length} 个版本` }
  }

  return (
    <div className="space-y-8">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">工作台</h1>
          <p className="text-sm text-muted mt-1">
            Prompt 评测与自动迭代工作台 · 阶段 2：测试集 + Prompt + 版本管理
          </p>
        </div>
        <Link
          to="/testset"
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primaryDark transition-colors"
        >
          开始新一轮测试
        </Link>
      </div>

      {/* 核心指标卡 */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label="当前 Prompt 版本"
          value={currentVersionLabel}
          sub={currentVersion ? currentVersion.status : '尚未保存'}
        />
        <MetricCard
          label="当前综合评分"
          value={currentVersion?.score ?? '—'}
          sub={currentVersion?.score ? '满分 100' : '待评测'}
        />
        <MetricCard
          label="已保存版本数"
          value={versions.length}
          sub="个版本"
        />
        <MetricCard
          label="测试集条数"
          value={testSetProgress}
          sub={testSetReady ? '已就绪' : '待补齐'}
        />
      </div>

      {/* 下一步引导 */}
      {nextStep && (
        <section className="bg-primary/5 border border-primary/30 rounded-xl p-6 flex items-center justify-between">
          <div>
            <div className="text-xs text-primary font-medium mb-1">下一步</div>
            <div className="text-base font-medium text-ink">{nextStep.label}</div>
            <div className="text-xs text-muted mt-0.5">{nextStep.desc}</div>
          </div>
          <Link
            to={nextStep.to}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primaryDark"
          >
            前往 →
          </Link>
        </section>
      )}

      {/* 当前 Prompt 摘要 */}
      <section className="bg-white border border-line rounded-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-ink">当前 Prompt</h2>
          <Link to="/prompt" className="text-sm text-primary hover:underline">编辑 →</Link>
        </div>
        {currentVersion ? (
          <pre className="text-xs text-ink/80 bg-canvas p-4 rounded-lg whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
            {currentVersion.content}
          </pre>
        ) : (
          <div className="text-sm text-muted bg-canvas p-4 rounded-lg">
            尚未保存任何 Prompt 版本，请先
            <Link to="/prompt" className="text-primary mx-1 underline">输入 Prompt V1</Link>
          </div>
        )}
      </section>

      {/* 测试集 + 最近版本变化 */}
      <div className="grid grid-cols-2 gap-6">
        <section className="bg-white border border-line rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-ink">测试集需求</h2>
            <Link to="/testset" className="text-sm text-primary hover:underline">管理 →</Link>
          </div>
          {testSet.length === 0 ? (
            <div className="text-sm text-muted py-4">
              测试集为空，请先
              <Link to="/testset" className="text-primary mx-1 underline">上传需求</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {testSet.slice(0, 5).map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <span className="w-5 h-5 flex items-center justify-center bg-primary/10 text-primary rounded text-xs">
                    {idx + 1}
                  </span>
                  <span className="text-ink truncate">{item.requirement}</span>
                </div>
              ))}
              {testSet.length > 5 && (
                <div className="text-xs text-muted pl-7">…还有 {testSet.length - 5} 条</div>
              )}
            </div>
          )}
        </section>

        <section className="bg-white border border-line rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-ink">最近版本变化</h2>
            <Link to="/versions" className="text-sm text-primary hover:underline">全部版本 →</Link>
          </div>
          {recentVersions.length === 0 ? (
            <div className="text-sm text-muted py-4">
              尚无版本，请先
              <Link to="/prompt" className="text-primary mx-1 underline">输入 Prompt V1</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentVersions.map(v => (
                <div key={v.id} className="flex items-center justify-between py-2 border-b border-line last:border-0">
                  <div>
                    <span className="font-medium text-ink">{v.version}</span>
                    <span className="ml-2 text-xs text-muted">{v.createdAt}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-ink">
                      {v.score !== null ? `${v.score} 分` : '未评测'}
                    </div>
                    <div className="text-xs text-muted">{v.badcaseCount ?? 0} Badcase</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub }) {
  return (
    <div className="bg-white border border-line rounded-xl p-5">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-2xl font-semibold text-ink mt-1">{value}</div>
      <div className="text-xs text-muted mt-1">{sub}</div>
    </div>
  )
}
