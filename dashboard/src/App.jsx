import { createElement } from 'react'
import {
  AppWindow,
  BarChart3,
  Clock3,
  Coffee,
  Compass,
  FileText,
  Flower2,
  FolderKanban,
  Globe,
  Home,
  Layers3,
  Leaf,
  Lock,
  MonitorPlay,
  Music4,
  Search,
  Settings,
  Shuffle,
  Sprout,
  TerminalSquare,
  Trees,
} from 'lucide-react'
import { motion } from 'motion/react'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  buildDashboardModel,
  formatClock,
  formatDuration,
  formatLongDate,
  formatPercent,
} from './dashboardData'

const reportFromWindow = window.__USAGE_REPORT__
const report = reportFromWindow ?? {
  run_started_at: new Date().toISOString(),
  run_ended_at: new Date().toISOString(),
  sessions: [],
}
const model = buildDashboardModel(report)
const MotionArticle = motion.article
const MotionDiv = motion.div

const NAV_ITEMS = [
  { label: 'Today', Icon: Home, href: '#today', active: true },
  { label: 'Timeline', Icon: BarChart3, href: '#timeline' },
  { label: 'Apps', Icon: Layers3, href: '#apps' },
  { label: 'Reflection', Icon: Leaf, href: '#reflection' },
  { label: 'Settings', Icon: Settings, href: '#settings' },
]

const ICONS = {
  code: TerminalSquare,
  chrome: Globe,
  edge: Compass,
  acrobat: FileText,
  discord: MonitorPlay,
  spotify: Music4,
  explorer: FolderKanban,
  search: Search,
  default: AppWindow,
}

const reveal = {
  hidden: { opacity: 0, y: 18 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.58,
      delay,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
}

function resolveIcon(appName) {
  const key = appName.toLowerCase()

  if (key.includes('code')) return ICONS.code
  if (key.includes('chrome')) return ICONS.chrome
  if (key.includes('edge')) return ICONS.edge
  if (key.includes('acrobat')) return ICONS.acrobat
  if (key.includes('discord')) return ICONS.discord
  if (key.includes('spotify')) return ICONS.spotify
  if (key.includes('explorer')) return ICONS.explorer
  if (key.includes('search')) return ICONS.search

  return ICONS.default
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null
  }

  const bucket = payload[0]?.payload

  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      <span>{bucket?.densityLabel ?? 'Activity rhythm'}</span>
      <span>Active {formatDuration(bucket?.active ?? 0)}</span>
      <span>Idle {formatDuration(bucket?.idle ?? 0)}</span>
    </div>
  )
}

function AppTooltip({ active, payload }) {
  if (!active || !payload?.length) {
    return null
  }

  const segment = payload[0]?.payload
  if (!segment) {
    return null
  }

  return (
    <div className="chart-tooltip">
      <strong>{segment.name}</strong>
      <span>{formatDuration(segment.seconds)}</span>
      <span>{formatPercent(segment.share)} of active time</span>
    </div>
  )
}

function Panel({ className = '', delay = 0, id, AccentIcon, children }) {
  return (
    <MotionArticle
      className={`surface ${className}`}
      id={id}
      initial="hidden"
      animate="visible"
      custom={delay}
      variants={reveal}
    >
      {AccentIcon ? (
        <span className="panel-botanical" aria-hidden="true">
          {createElement(AccentIcon, { size: 32, strokeWidth: 1.45 })}
        </span>
      ) : null}
      {children}
    </MotionArticle>
  )
}

function SectionHeading({ eyebrow, title, action }) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  )
}

function DataRow({ Icon, label, value }) {
  return (
    <div className="data-row">
      <span>
        {createElement(Icon, { size: 16, strokeWidth: 1.9 })}
        {label}
      </span>
      <strong title={value}>{value}</strong>
    </div>
  )
}

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand-mark" aria-label="Usage tracker">
        <span />
      </div>

      <nav className="nav-list" aria-label="Dashboard sections">
        {NAV_ITEMS.map(({ label, Icon, href, active }) => (
          <a className={active ? 'nav-item nav-item-active' : 'nav-item'} href={href} key={label}>
            {createElement(Icon, { size: 18, strokeWidth: 1.9 })}
            <span>{label}</span>
          </a>
        ))}
      </nav>

      <div className="local-note">
        <span className="status-dot" />
        <div>
          <strong>Local only</strong>
          <p>Your data stays on this device.</p>
        </div>
      </div>
    </aside>
  )
}

function SummaryPanel() {
  return (
    <Panel className="summary-panel" delay={0.04} id="today" AccentIcon={Sprout}>
      <p className="eyebrow">Total tracked time</p>
      <h1>{formatDuration(model.trackedSeconds)}</h1>

      <div className="split-line" />

      <div className="time-split">
        <div>
          <span className="split-label split-active">Active time</span>
          <strong>{formatDuration(model.activeSeconds)}</strong>
          <p>{formatPercent(model.activeShare)}</p>
        </div>
        <div>
          <span className="split-label split-idle">Idle time</span>
          <strong>{formatDuration(model.idleSeconds)}</strong>
          <p>{formatPercent(model.idleShare)}</p>
        </div>
      </div>

      <div className="summary-reflection" id="reflection">
        <p>{model.reflectionLines[0]}</p>
        <p>
          {model.dominantApp
            ? `${model.dominantApp.name} led active time; ${model.sessionCount} sessions and ${model.switchCount} app switches were captured.`
            : `${model.sessionCount} sessions were captured.`}
        </p>
      </div>
    </Panel>
  )
}

function AppCompositionPanel() {
  const hasApps = model.appBreakdown.length > 0

  return (
    <Panel className="app-panel" delay={0.08} id="apps" AccentIcon={Flower2}>
      <SectionHeading
        eyebrow="Time by app"
        title="Active time by app"
        action={<span className="soft-pill">{model.topAppCountLabel}</span>}
      />

      <div className="app-composition">
        <div className="donut-area">
          {hasApps ? (
            <ResponsiveContainer width="100%" height={330}>
              <PieChart>
                <Pie
                  data={model.appBreakdown}
                  dataKey="seconds"
                  nameKey="name"
                  innerRadius={92}
                  outerRadius={140}
                  paddingAngle={3}
                  cornerRadius={12}
                  stroke="rgba(255, 252, 246, 0.88)"
                  strokeWidth={4}
                >
                  {model.appBreakdown.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<AppTooltip />} />
                <text x="50%" y="49%" textAnchor="middle" className="chart-center-value">
                  {formatDuration(model.activeSeconds)}
                </text>
                <text x="50%" y="59%" textAnchor="middle" className="chart-center-label">
                  active time
                </text>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-donut">
              <span>No active apps</span>
            </div>
          )}
        </div>

        <div className="app-list">
          {hasApps ? (
            model.appBreakdown.map((app) => {
              const Icon = resolveIcon(app.name)

              return (
                <div className="app-row" key={app.name}>
                  <div className="app-row-name">
                    <span className="app-dot" style={{ backgroundColor: app.color }}>
                      {createElement(Icon, { size: 15, strokeWidth: 2 })}
                    </span>
                    <strong>{app.name}</strong>
                  </div>
                  <span>{formatDuration(app.seconds)}</span>
                  <span>{formatPercent(app.share)}</span>
                </div>
              )
            })
          ) : (
            <p className="empty-copy">No active app sessions were captured in this report.</p>
          )}
        </div>
      </div>
    </Panel>
  )
}

function TimelinePanel() {
  return (
    <Panel className="timeline-panel" delay={0.14} id="timeline" AccentIcon={Trees}>
      <SectionHeading
        eyebrow="Session timeline"
        title="Timeline"
        action={
          <div className="timeline-legend">
            {model.timelineLegendItems.map((item) => (
              <span key={item.name}>
                <i style={{ backgroundColor: item.color }} />
                {item.name}
              </span>
            ))}
          </div>
        }
      />

      <div
        className="timeline-track"
        style={{ gridTemplateColumns: `repeat(${model.timelineBins.length}, minmax(0, 1fr))` }}
      >
        {model.timelineBins.map((bin) => (
          <div
            className={bin.isEmpty ? 'timeline-bin timeline-bin-empty' : 'timeline-bin'}
            key={bin.id}
            title={bin.tooltip}
            style={{ backgroundColor: bin.color }}
          />
        ))}
      </div>

      <div className="timeline-ticks">
        {model.timelineTicks.map((tick) => (
          <span key={`${tick.label}-${tick.left}`} style={{ left: `${tick.left}%` }}>
            {tick.label}
          </span>
        ))}
      </div>

      <div className="timeline-apps">
        {model.timelineLegendItems.slice(0, 9).map((item) => (
          <span key={item.name}>
            <i style={{ backgroundColor: item.color }} />
            {item.name}
            {item.seconds > 0 ? ` ${formatDuration(item.seconds)}` : ''}
          </span>
        ))}
      </div>
    </Panel>
  )
}

function RhythmPanel() {
  return (
    <Panel className="rhythm-panel" delay={0.18} AccentIcon={Leaf}>
      <SectionHeading
        eyebrow="Activity rhythm"
        title="How activity rose and fell"
        action={
          <div className="rhythm-heading-actions">
            <span className="soft-pill">{formatPercent(model.activeShare)} active</span>
            <div className="rhythm-key" aria-label="Activity rhythm color key">
              <span><i className="key-active" /> Active density</span>
              <span><i className="key-idle" /> Idle breaks</span>
            </div>
          </div>
        }
      />

      <div className="rhythm-chart">
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={model.activityBuckets} barGap={3}>
            <XAxis
              dataKey="label"
              ticks={model.activityTickLabels}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#8a8174', fontSize: 12 }}
            />
            <YAxis hide domain={[0, 100]} />
            <Tooltip cursor={{ fill: 'rgba(136, 112, 77, 0.06)' }} content={<ChartTooltip />} />
            <Bar dataKey="magnitude" radius={[7, 7, 0, 0]}>
              {model.activityBuckets.map((bucket) => (
                <Cell
                  key={bucket.id}
                  fill={
                    bucket.tone === 'active'
                      ? '#9ac8a8'
                      : bucket.tone === 'idle'
                        ? model.idleColor
                        : model.emptyColor
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  )
}

function StatsPanel() {
  return (
    <Panel className="stats-panel" delay={0.1} AccentIcon={Leaf}>
      <div className="stat-item stat-sage">
        <Layers3 size={19} strokeWidth={1.9} />
        <span>Sessions</span>
        <strong>{model.sessionCount}</strong>
      </div>
      <div className="stat-item stat-sky">
        <Clock3 size={19} strokeWidth={1.9} />
        <span>Longest</span>
        <strong>{model.longestSession ? formatDuration(model.longestSession.duration_seconds) : 'None'}</strong>
        <small>{model.longestSession ? model.longestSession.app_display_name : 'No active stretch'}</small>
      </div>
      <div className="stat-item stat-peach">
        <Coffee size={19} strokeWidth={1.9} />
        <span>Break time</span>
        <strong>{formatDuration(model.idleSeconds)}</strong>
        <small>{model.breakCount} idle {model.breakCount === 1 ? 'break' : 'breaks'}</small>
      </div>
      <div className="stat-item stat-gold">
        <Shuffle size={19} strokeWidth={1.9} />
        <span>Switches</span>
        <strong>{model.switchCount}</strong>
      </div>
    </Panel>
  )
}

function DataPanel() {
  return (
    <Panel className="data-panel" delay={0.22} id="settings" AccentIcon={Sprout}>
      <SectionHeading eyebrow="About this data" title="Stored locally" />
      <DataRow
        Icon={Clock3}
        label="Poll interval"
        value={model.pollIntervalSeconds == null ? 'Unknown' : `${model.pollIntervalSeconds} seconds`}
      />
      <DataRow
        Icon={Coffee}
        label="Idle threshold"
        value={model.idleThresholdSeconds == null ? 'Unknown' : `${model.idleThresholdSeconds} seconds`}
      />
      <DataRow Icon={FileText} label="Source file" value={model.sourceFileName} />
    </Panel>
  )
}

function App() {
  return (
    <main className="app-shell">
      <Sidebar />

      <section className="dashboard">
        <MotionDiv
          className="topbar"
          initial="hidden"
          animate="visible"
          custom={0}
          variants={reveal}
        >
          <div>
            <h2>{formatLongDate(model.runStart)}</h2>
          </div>

          <div className="topbar-actions">
            <span className="stopped-at">
              Tracking stopped at {formatClock(model.runEnd)}
              <i />
            </span>
            <a className="source-button" href="./report.json" target="_blank" rel="noreferrer" title={model.sourceFilePath || model.sourceFileName}>
              <FileText size={17} strokeWidth={1.9} />
              View source report
            </a>
          </div>
        </MotionDiv>

        <div className="dashboard-grid">
          <SummaryPanel />
          <AppCompositionPanel />
          <StatsPanel />

          <TimelinePanel />
          <RhythmPanel />
          <DataPanel />
        </div>

        <div className="footer-note">
          <Lock size={15} strokeWidth={1.9} />
          All data is stored locally on your device.
        </div>
      </section>

    </main>
  )
}

export default App
