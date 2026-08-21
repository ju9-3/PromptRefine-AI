import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/dashboard', label: '工作台' },
  { to: '/testset', label: '测试集上传' },
  { to: '/prompt', label: 'Prompt 编辑' },
  { to: '/evaluation', label: '评测结果' },
  { to: '/abtest', label: 'A/B 测试' },
  { to: '/badcase', label: 'Badcase' },
  { to: '/versions', label: '版本管理' }
]

export default function Sidebar() {
  return (
    <aside className="w-56 bg-white border-r border-line h-full flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-line">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold">P</div>
          <span className="font-semibold text-ink">PromptRefine AI</span>
        </div>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-ink/70 hover:bg-gray-100'
              }`
            }
          >
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-line text-xs text-muted">
        MVP v0.1 · 骨架模式
      </div>
    </aside>
  )
}
