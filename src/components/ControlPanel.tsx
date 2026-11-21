export type ThemeName = 'system' | 'white' | 'black' | 'cyberpunk' | 'tokyo' | 'github'
export type PanelName = 'settings' | 'themes'
export type OrbSettings = { sensitivity: number; holdMs: number }

type Props = {
  panel: PanelName
  theme: ThemeName
  settings: OrbSettings
  onTheme: (theme: ThemeName) => void
  onSettings: (settings: OrbSettings) => void
  onClose: () => void
}

const themes: { id: ThemeName; label: string; description: string }[] = [
  { id: 'system', label: '跟随系统', description: '自动切换明暗' },
  { id: 'white', label: '白色', description: '清透明亮' },
  { id: 'black', label: '黑色', description: '沉静深色' },
  { id: 'cyberpunk', label: '赛博朋克', description: '霓虹黄与品红' },
  { id: 'tokyo', label: '东京', description: '夜色与霓虹' },
  { id: 'github', label: 'GitHub', description: '深色代码空间' },
]

export default function ControlPanel({ panel, theme, settings, onTheme, onSettings, onClose }: Props) {
  return (
    <div className="panel-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="control-panel" role="dialog" aria-modal="true" aria-labelledby="panel-title">
        <header className="panel-header">
          <div>
            <p className="panel-kicker">ORBMOUSE</p>
            <h1 id="panel-title">{panel === 'settings' ? '设置' : '皮肤'}</h1>
          </div>
          <button className="panel-close" type="button" onClick={onClose} aria-label="关闭" autoFocus>×</button>
        </header>
        {panel === 'settings' ? (
          <div className="setting-list">
            <label className="setting-row">
              <span><strong>触控灵敏度</strong><small>调整滑动时的鼠标移动距离</small></span>
              <output>{settings.sensitivity.toFixed(1)}×</output>
              <input type="range" min="0.5" max="2" step="0.1" value={settings.sensitivity}
                onChange={event => onSettings({ ...settings, sensitivity: Number(event.target.value) })} />
            </label>
            <label className="setting-row">
              <span><strong>长按触发</strong><small>静止按住后进入模拟语音状态</small></span>
              <output>{settings.holdMs} ms</output>
              <input type="range" min="350" max="700" step="50" value={settings.holdMs}
                onChange={event => onSettings({ ...settings, holdMs: Number(event.target.value) })} />
            </label>
            <p className="panel-note">语音和鼠标输出目前仅为界面演示，不连接麦克风或蓝牙设备。</p>
          </div>
        ) : (
          <div className="theme-grid">
            {themes.map(item => (
              <button className={`theme-card theme-card-${item.id}${theme === item.id ? ' selected' : ''}`}
                type="button" key={item.id} onClick={() => onTheme(item.id)} aria-pressed={theme === item.id}>
                <span className="theme-swatch"><span /></span>
                <strong>{item.label}</strong><small>{item.description}</small>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
