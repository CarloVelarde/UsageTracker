import { createElement } from 'react'
import {
  AlarmClockCheck,
  AppWindow,
  CircleDot,
  Clock3,
  Coffee,
  Compass,
  FileText,
  FolderKanban,
  Globe,
  MonitorPlay,
  MoonStar,
  Music4,
  Search,
  ShieldEllipsis,
  TerminalSquare,
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
import { buildDashboardModel, formatClock, formatDuration, formatLongDate } from './dashboardData'
import { mockReport } from './mockReport'

const reportFromWindow = window.__USAGE_REPORT__
const report = reportFromWindow?.sessions?.length ? reportFromWindow : mockReport
const model = buildDashboardModel(report)
const MotionArticle = motion.article
const MotionHeader = motion.header

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
  hidden: { opacity: 0, y: 24 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.68,
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

function StatCard({ Icon, label, value, tone, delay }) {
  return (
    <MotionArticle
      className={`stat-card stat-card-${tone}`}
      initial="hidden"
      animate="visible"
      custom={delay}
      variants={reveal}
    >
      <div className="stat-icon-wrap">
        {createElement(Icon, { size: 18, strokeWidth: 2.1 })}
      </div>
      <div>
        <p className="eyebrow">{label}</p>
        <h3>{value}</h3>
      </div>
    </MotionArticle>
  )
}

function UsageTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null
  }

  const bucket = payload[0]?.payload
  const activeSeconds = bucket?.active ?? 0
  const idleSeconds = bucket?.idle ?? 0

  return (
    <div className="chart-tooltip">
      <p>{label}</p>
      <span>Active: {formatDuration(activeSeconds)}</span>
      <span>Idle: {formatDuration(idleSeconds)}</span>
    </div>
  )
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) {
    return null
  }

  const segment = payload[0]?.payload
  if (!segment) {
    return null
  }

  return (
    <div className="chart-tooltip">
      <p>{segment.name}</p>
      <span>{formatDuration(segment.seconds)}</span>
      <span>{Math.round(segment.share * 100)}% of active time</span>
    </div>
  )
}

function App() {
  return (
    <main className="dashboard-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <MotionHeader
        className="hero-panel"
        initial="hidden"
        animate="visible"
        custom={0.05}
        variants={reveal}
      >
        <div className="hero-copy">
          <div className="hero-kicker">
            <span className="hero-dot" />
            Ambient daily reflection
          </div>
          <h1>Today&apos;s Computer Usage</h1>
          <p>
            A calm local summary of your screen habits, built for reflection
            instead of pressure.
          </p>
        </div>

        <div className="hero-meta">
          <div className="date-pill">
            <MoonStar size={16} strokeWidth={2.1} />
            {formatLongDate(model.runStart)}
          </div>
          <div className="span-pill">
            <Clock3 size={16} strokeWidth={2.1} />
            {formatClock(model.runStart)} to {formatClock(model.runEnd)}
          </div>
        </div>
      </MotionHeader>

      <section className="stats-grid">
        <StatCard
          Icon={AlarmClockCheck}
          label="Tracked time"
          value={formatDuration(model.trackedSeconds)}
          tone="blue"
          delay={0.1}
        />
        <StatCard
          Icon={ShieldEllipsis}
          label="Active time"
          value={formatDuration(model.activeSeconds)}
          tone="green"
          delay={0.16}
        />
        <StatCard
          Icon={Coffee}
          label="Idle time"
          value={formatDuration(model.idleSeconds)}
          tone="rose"
          delay={0.22}
        />
        <StatCard
          Icon={CircleDot}
          label="App switches"
          value={`${model.switchCount}`}
          tone="gold"
          delay={0.28}
        />
      </section>

      <section className="content-grid">
        <MotionArticle
          className="panel panel-share"
          initial="hidden"
          animate="visible"
          custom={0.16}
          variants={reveal}
        >
          <div className="panel-heading">
            <div>
              <p className="eyebrow">App composition</p>
              <h2>Where your active time went</h2>
            </div>
            <div className="pill pill-soft">
              <Compass size={15} strokeWidth={2.1} />
              Top 5 of {model.uniqueApps} apps
            </div>
          </div>

          <div className="share-layout">
            <div className="donut-wrap">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={model.appBreakdown}
                    dataKey="seconds"
                    nameKey="name"
                    innerRadius={72}
                    outerRadius={108}
                    paddingAngle={3}
                    stroke="rgba(255,255,255,0.56)"
                    strokeWidth={3}
                  >
                    {model.appBreakdown.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <text
                    x="50%"
                    y="47%"
                    textAnchor="middle"
                    className="chart-center-label"
                  >
                    {formatDuration(model.activeSeconds)}
                  </text>
                  <text
                    x="50%"
                    y="57%"
                    textAnchor="middle"
                    className="chart-center-subtitle"
                  >
                    active focus
                  </text>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="app-list">
              {model.appBreakdown.map((app) => {
                const Icon = resolveIcon(app.name)

                return (
                  <div className="app-row" key={app.name}>
                    <div className="app-row-main">
                      <span
                        className="app-chip"
                        style={{ backgroundColor: `${app.color}22`, color: app.color }}
                      >
                        {createElement(Icon, { size: 16, strokeWidth: 2.1 })}
                      </span>
                      <div>
                        <strong>{app.name}</strong>
                        <p>{Math.round(app.share * 100)}% of active usage</p>
                      </div>
                    </div>
                    <div className="app-row-side">
                      <span>{formatDuration(app.seconds)}</span>
                      <div className="app-bar-track">
                        <div
                          className="app-bar-fill"
                          style={{
                            width: `${Math.max(app.share * 100, 6)}%`,
                            background: app.color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </MotionArticle>

        <MotionArticle
          className="panel panel-timeline"
          initial="hidden"
          animate="visible"
          custom={0.22}
          variants={reveal}
        >
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Session flow</p>
              <h2>Timeline of your day</h2>
            </div>
            <div className="pill">
              <Clock3 size={15} strokeWidth={2.1} />
              {model.sessionCount} captured sessions
            </div>
          </div>

          <div className="timeline-legend">
            {model.appBreakdown.slice(0, 4).map((app) => (
              <span className="legend-chip" key={app.name}>
                <span
                  className="legend-swatch"
                  style={{ backgroundColor: app.color }}
                />
                {app.name}
              </span>
            ))}
            {model.idleSeconds > 0 && (
              <span className="legend-chip">
                <span
                  className="legend-swatch"
                  style={{ backgroundColor: model.idleColor }}
                />
                Idle
              </span>
            )}
          </div>

          <div className="timeline-card">
            <div
              className="timeline-track"
              style={{
                gridTemplateColumns: `repeat(${model.timelineBins.length}, minmax(0, 1fr))`,
              }}
            >
              {model.timelineBins.map((bin) => (
                <div
                  className={`timeline-bin${bin.isIdle ? ' timeline-idle' : ''}${bin.isEmpty ? ' timeline-empty' : ''}`}
                  key={bin.id}
                  title={bin.tooltip}
                  style={{ background: bin.color }}
                />
              ))}
            </div>

            <div className="timeline-ticks">
              {model.timelineTicks.map((tick) => (
                <div
                  className="timeline-tick"
                  key={tick.label + tick.left}
                  style={{ left: `${tick.left}%` }}
                >
                  <span />
                  <p>{tick.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="timeline-summary">
            <div>
              <p className="eyebrow">Longest stretch</p>
              <strong>
                {model.longestSession
                  ? `${formatDuration(model.longestSession.duration_seconds)} in ${model.longestSession.app_display_name}`
                  : 'No active stretch captured'}
              </strong>
            </div>
            <div>
              <p className="eyebrow">Break count</p>
              <strong>{model.breakCount} pauses</strong>
            </div>
          </div>
        </MotionArticle>

        <MotionArticle
          className="panel panel-rhythm"
          initial="hidden"
          animate="visible"
          custom={0.28}
          variants={reveal}
        >
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Usage rhythm</p>
              <h2>How activity rose and fell</h2>
            </div>
            <div className="pill pill-soft">
              <ShieldEllipsis size={15} strokeWidth={2.1} />
              {Math.round(model.activeShare * 100)}% active
            </div>
          </div>

          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={290}>
              <BarChart data={model.activityBuckets} barGap={8}>
                <XAxis
                  dataKey="label"
                  ticks={model.activityTickLabels}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6d7694', fontSize: 12 }}
                />
                <YAxis hide />
                <Tooltip cursor={{ fill: 'rgba(109, 121, 168, 0.08)' }} content={<UsageTooltip />} />
                <Bar dataKey="magnitude" radius={[10, 10, 0, 0]}>
                  {model.activityBuckets.map((bucket) => (
                    <Cell
                      key={bucket.id}
                      fill={
                        bucket.tone === 'active'
                          ? '#5b7cfa'
                          : bucket.tone === 'idle'
                            ? model.idleColor
                            : '#e8edf8'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </MotionArticle>

        <MotionArticle
          className="panel panel-reflection"
          initial="hidden"
          animate="visible"
          custom={0.34}
          variants={reveal}
        >
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Reflection</p>
              <h2>What stands out</h2>
            </div>
            <div className="pill">
              <MoonStar size={15} strokeWidth={2.1} />
              local only
            </div>
          </div>

          <div className="reflection-card">
            {model.reflectionLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>

          <div className="insight-grid">
            <div className="insight">
              <span>Most used app</span>
              <strong>{model.dominantApp?.name ?? 'Unknown'}</strong>
            </div>
            <div className="insight">
              <span>Source file</span>
              <strong>{report.source_file_name ?? 'Live demo data'}</strong>
            </div>
            <div className="insight">
              <span>Tracked mode</span>
              <strong>Apps + idle only</strong>
            </div>
            <div className="insight">
              <span>Website tracking</span>
              <strong>Planned next</strong>
            </div>
          </div>
        </MotionArticle>
      </section>
    </main>
  )
}

export default App
