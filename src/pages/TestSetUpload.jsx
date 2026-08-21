import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import {
  addTestItem,
  updateTestItem,
  removeTestItem,
  clearTestSet,
  MAX_TESTSET_SIZE
} from '../store/store.js'

export default function TestSetUpload() {
  const { testSet, maxTestSetSize } = useStore()
  const [input, setInput] = useState({ requirement: '', detail: '' })
  const [editingId, setEditingId] = useState(null)
  const [editBuffer, setEditBuffer] = useState({ requirement: '', detail: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const showNotice = (msg) => {
    setNotice(msg)
    setError('')
    setTimeout(() => setNotice(''), 2500)
  }
  const showError = (msg) => {
    setError(msg)
    setNotice('')
    setTimeout(() => setError(''), 2500)
  }

  const isFull = testSet.length >= maxTestSetSize

  const handleAdd = () => {
    const res = addTestItem(input.requirement, input.detail)
    if (!res.ok) {
      showError(res.error)
      return
    }
    setInput({ requirement: '', detail: '' })
    showNotice(`已添加，当前 ${testSet.length + 1}/${maxTestSetSize} 条`)
  }

  const handleRemove = (id) => {
    removeTestItem(id)
    if (editingId === id) setEditingId(null)
    showNotice('已删除')
  }

  const handleClearAll = () => {
    if (testSet.length === 0) return
    if (!confirm('确认清空全部测试集？此操作不可撤销。')) return
    clearTestSet()
    setEditingId(null)
    showNotice('已清空')
  }

  const startEdit = (item) => {
    setEditingId(item.id)
    setEditBuffer({ requirement: item.requirement, detail: item.detail })
  }

  const saveEdit = () => {
    const res = updateTestItem(editingId, editBuffer.requirement, editBuffer.detail)
    if (!res.ok) {
      showError(res.error)
      return
    }
    setEditingId(null)
    showNotice('已保存修改')
  }

  const cancelEdit = () => setEditingId(null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">测试集上传</h1>
        <p className="text-sm text-muted mt-1">
          上传 {maxTestSetSize} 条真实的小红书内容需求，V1/V2 A/B 测试共用同一批测试集，保证公平比较（PRD 6.2）。
        </p>
      </div>

      {/* 提示横幅 */}
      {notice && (
        <div className="px-4 py-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">
          {notice}
        </div>
      )}
      {error && (
        <div className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* 新增条目 */}
      <section className="bg-white border border-line rounded-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-ink">新增一条需求</h2>
          {isFull && (
            <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded">
              已达上限，如需新增请先删除
            </span>
          )}
        </div>
        <div className="grid grid-cols-12 gap-3">
          <input
            type="text"
            placeholder="需求标题（如：油皮用户防晒需求）"
            value={input.requirement}
            onChange={e => setInput({ ...input, requirement: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            disabled={isFull}
            className="col-span-4 px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:border-primary disabled:bg-gray-50 disabled:text-muted"
          />
          <input
            type="text"
            placeholder="需求详情（可选）"
            value={input.detail}
            onChange={e => setInput({ ...input, detail: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            disabled={isFull}
            className="col-span-7 px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:border-primary disabled:bg-gray-50 disabled:text-muted"
          />
          <button
            onClick={handleAdd}
            disabled={isFull}
            className="col-span-1 bg-primary text-white rounded-lg text-sm hover:bg-primaryDark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            添加
          </button>
        </div>
        <p className="text-xs text-muted mt-3">
          建议覆盖多个真实场景（油皮/干皮/敏感肌/学生党/熬夜/通勤等）。
        </p>
      </section>

      {/* 已上传列表 */}
      <section className="bg-white border border-line rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-ink">已上传需求（{testSet.length}/{maxTestSetSize}）</h2>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded ${
              testSet.length === maxTestSetSize
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {testSet.length === maxTestSetSize
                ? '已达 MVP 标准'
                : `还需 ${maxTestSetSize - testSet.length} 条`}
            </span>
            {testSet.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs text-muted hover:text-red-500"
              >
                清空全部
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {testSet.length === 0 && (
            <div className="text-center text-sm text-muted py-12">
              暂无需求，请先添加
            </div>
          )}
          {testSet.map((item, idx) => (
            <div
              key={item.id}
              className="flex items-center gap-3 py-3 px-4 bg-canvas rounded-lg"
            >
              <span className="w-6 h-6 flex items-center justify-center bg-primary/10 text-primary rounded text-xs font-medium flex-shrink-0">
                {idx + 1}
              </span>
              {editingId === item.id ? (
                <div className="flex-1 grid grid-cols-12 gap-2">
                  <input
                    type="text"
                    value={editBuffer.requirement}
                    onChange={e => setEditBuffer({ ...editBuffer, requirement: e.target.value })}
                    className="col-span-4 px-2 py-1 border border-primary rounded text-sm focus:outline-none"
                    placeholder="需求标题"
                  />
                  <input
                    type="text"
                    value={editBuffer.detail}
                    onChange={e => setEditBuffer({ ...editBuffer, detail: e.target.value })}
                    className="col-span-7 px-2 py-1 border border-primary rounded text-sm focus:outline-none"
                    placeholder="需求详情"
                  />
                  <div className="col-span-1 flex gap-1 justify-end">
                    <button
                      onClick={saveEdit}
                      className="text-xs px-2 py-1 bg-primary text-white rounded"
                    >
                      保存
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="text-xs px-2 py-1 bg-gray-200 text-ink rounded"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-ink truncate">{item.requirement}</div>
                    {item.detail && (
                      <div className="text-xs text-muted mt-0.5 truncate">{item.detail}</div>
                    )}
                  </div>
                  <button
                    onClick={() => startEdit(item)}
                    className="text-xs text-muted hover:text-primary"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="text-xs text-muted hover:text-red-500"
                  >
                    删除
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 下一步 */}
      <div className="flex justify-end gap-3">
        <Link
          to="/prompt"
          className={`px-4 py-2 rounded-lg text-sm ${
            testSet.length === 0
              ? 'bg-gray-300 text-muted cursor-not-allowed pointer-events-none'
              : 'bg-primary text-white hover:bg-primaryDark'
          }`}
        >
          下一步：输入 Prompt V1 →
        </Link>
      </div>
    </div>
  )
}
