const APP_COLORS = [
  '#86bea0',
  '#7cb7df',
  '#f2a36f',
  '#a895d2',
  '#ee9aa4',
  '#e7c76b',
  '#83c7be',
  '#c8d5df',
]

const IDLE_COLOR = '#f3bf98'
const EMPTY_COLOR = '#dedbd2'

function toDate(value) {
  return value instanceof Date ? value : new Date(value)
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function formatAppName(appName) {
  if (!appName) {
    return 'Unknown'
  }

  const withoutExtension = appName.replace(/\.exe$/i, '').trim()
  const normalized = withoutExtension
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) {
    return 'Unknown'
  }

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase())
}

export function formatDuration(totalSeconds) {
  const roundedSeconds = Math.max(0, Math.round(totalSeconds ?? 0))
  const hours = Math.floor(roundedSeconds / 3600)
  const minutes = Math.floor((roundedSeconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  if (minutes > 0) {
    return `${minutes}m`
  }

  return `${roundedSeconds}s`
}

export function formatClock(dateLike) {
  return toDate(dateLike).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatLongDate(dateLike) {
  return toDate(dateLike).toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatPercent(value) {
  return `${Math.round((value ?? 0) * 100)}%`
}

function createTicks(runStart, runEnd, tickCount = 5) {
  const totalMs = Math.max(runEnd - runStart, 1)

  return Array.from({ length: tickCount }, (_, index) => {
    const ratio = tickCount === 1 ? 0 : index / (tickCount - 1)
    const time = new Date(runStart.getTime() + totalMs * ratio)

    return {
      label: formatClock(time),
      left: ratio * 100,
    }
  })
}

function createTimeBuckets(sessions, runStart, runEnd, minBuckets, maxBuckets, targetMinutesPerBucket) {
  const totalMs = Math.max(runEnd - runStart, 1)
  const totalMinutes = totalMs / 60000
  const bucketCount = clamp(
    Math.ceil(totalMinutes / targetMinutesPerBucket),
    minBuckets,
    maxBuckets,
  )
  const bucketMs = totalMs / bucketCount

  return Array.from({ length: bucketCount }, (_, index) => {
    const start = new Date(runStart.getTime() + index * bucketMs)
    const end =
      index === bucketCount - 1
        ? new Date(runEnd)
        : new Date(runStart.getTime() + (index + 1) * bucketMs)

    let active = 0
    let idle = 0
    const appUsage = new Map()

    sessions.forEach((session) => {
      const sessionStart = toDate(session.start_timestamp)
      const sessionEnd = toDate(session.end_timestamp)
      const overlapStart = Math.max(start.getTime(), sessionStart.getTime())
      const overlapEnd = Math.min(end.getTime(), sessionEnd.getTime())

      if (overlapEnd <= overlapStart) {
        return
      }

      const overlapSeconds = (overlapEnd - overlapStart) / 1000
      if (session.session_type === 'idle') {
        idle += overlapSeconds
        appUsage.set('Idle', (appUsage.get('Idle') ?? 0) + overlapSeconds)
      } else {
        active += overlapSeconds
        appUsage.set(
          session.app_display_name,
          (appUsage.get(session.app_display_name) ?? 0) + overlapSeconds,
        )
      }
    })

    let dominantApp = 'No Data'
    let dominantSeconds = 0
    for (const [appName, seconds] of appUsage.entries()) {
      if (seconds > dominantSeconds) {
        dominantApp = appName
        dominantSeconds = seconds
      }
    }

    return {
      id: `${start.toISOString()}-${index}`,
      label: formatClock(start),
      startLabel: formatClock(start),
      endLabel: formatClock(end),
      active,
      idle,
      total: active + idle,
      dominantApp,
      dominantSeconds,
      isIdle: dominantApp === 'Idle',
      isEmpty: dominantApp === 'No Data',
    }
  })
}

function createTimelineBins(sessions, runStart, runEnd, appColors) {
  return createTimeBuckets(sessions, runStart, runEnd, 36, 84, 10).map((bucket) => {
    let color = EMPTY_COLOR
    if (bucket.isIdle) {
      color = IDLE_COLOR
    } else if (!bucket.isEmpty) {
      color = appColors.get(bucket.dominantApp) ?? APP_COLORS[0]
    }

    return {
      ...bucket,
      color,
      tooltip: `${bucket.startLabel} - ${bucket.endLabel} | ${bucket.dominantApp}`,
    }
  })
}

function createRhythmBuckets(sessions, runStart, runEnd) {
  return createTimeBuckets(sessions, runStart, runEnd, 24, 56, 18).map((bucket) => ({
    ...bucket,
    magnitude: bucket.active > 0 ? bucket.active : bucket.idle,
    tone: bucket.active > 0 ? 'active' : bucket.idle > 0 ? 'idle' : 'empty',
  }))
}

function createBucketTickLabels(buckets, tickCount = 5) {
  if (buckets.length === 0) {
    return []
  }

  return Array.from({ length: tickCount }, (_, index) => {
    const ratio = tickCount === 1 ? 0 : index / (tickCount - 1)
    const bucketIndex = Math.min(
      buckets.length - 1,
      Math.round(ratio * (buckets.length - 1)),
    )
    return buckets[bucketIndex].label
  }).filter((value, index, values) => values.indexOf(value) === index)
}

function summarizeApps(activeSessions) {
  const appTotals = new Map()

  activeSessions.forEach((session) => {
    const key = session.app_display_name
    const existing = appTotals.get(key) ?? {
      name: key,
      seconds: 0,
      sessions: 0,
    }
    existing.seconds += session.duration_seconds ?? 0
    existing.sessions += 1
    appTotals.set(key, existing)
  })

  return [...appTotals.values()].sort((left, right) => {
    return right.seconds - left.seconds
  })
}

function countSwitches(activeSessions) {
  if (activeSessions.length <= 1) {
    return 0
  }

  let switches = 0
  let previous = activeSessions[0].app_display_name

  for (const session of activeSessions.slice(1)) {
    if (session.app_display_name !== previous) {
      switches += 1
      previous = session.app_display_name
    }
  }

  return switches
}

function createTimelineLegend({ appBreakdown, idleSeconds, timelineBins }) {
  const items = appBreakdown.slice(0, 7).map((app) => ({
    name: app.name,
    color: app.color,
    seconds: app.seconds,
  }))

  if (idleSeconds > 0) {
    items.push({
      name: 'Idle',
      color: IDLE_COLOR,
      seconds: idleSeconds,
    })
  }

  if (timelineBins.some((bin) => bin.isEmpty)) {
    items.push({
      name: 'No data',
      color: EMPTY_COLOR,
      seconds: 0,
    })
  }

  return items
}

function buildReflection({
  dominantApp,
  activeSeconds,
  idleSeconds,
  trackedSeconds,
  switchCount,
  uniqueApps,
  longestSession,
}) {
  if (trackedSeconds <= 0) {
    return [
      'No report activity was captured yet.',
      'Once a tracking session finishes, the day will appear here as a quiet summary.',
    ]
  }

  if (trackedSeconds < 60) {
    return [
      'Only a small amount of activity was captured in this report.',
      'The layout will become more expressive after a longer tracking session.',
    ]
  }

  if (!dominantApp || activeSeconds <= 0) {
    return [
      'This report is mostly pause time.',
      'The tracker captured the shape of the day without adding any judgment.',
    ]
  }

  const lines = []
  const longestMinutes = (longestSession?.duration_seconds ?? 0) / 60
  if (longestMinutes >= 45) {
    lines.push('A steady day with long focused stretches.')
  } else if (switchCount > uniqueApps * 2 && switchCount > 6) {
    lines.push('A varied day with several app transitions.')
  } else {
    lines.push('A calm snapshot of where your screen time settled.')
  }

  lines.push(`${dominantApp.name} anchored ${formatPercent(dominantApp.share)} of active time.`)

  if (idleSeconds > activeSeconds * 0.35) {
    lines.push('There were meaningful pauses in the flow, keeping the day from reading as nonstop screen work.')
  } else {
    lines.push('You kept a fairly continuous rhythm across the captured sessions.')
  }

  return lines
}

export function buildDashboardModel(report) {
  const sessions = [...(report?.sessions ?? [])]
    .map((session) => ({
      ...session,
      app_display_name:
        session.session_type === 'idle'
          ? 'Idle'
          : formatAppName(session.app_name),
    }))
    .sort((left, right) => toDate(left.start_timestamp) - toDate(right.start_timestamp))

  const runStart = toDate(report?.run_started_at ?? new Date())
  const runEnd = toDate(report?.run_ended_at ?? report?.run_started_at ?? new Date())
  const trackedSeconds = sessions.reduce((sum, session) => {
    return sum + (session.duration_seconds ?? 0)
  }, 0)
  const activeSessions = sessions.filter((session) => session.session_type !== 'idle')
  const idleSessions = sessions.filter((session) => session.session_type === 'idle')
  const activeSeconds = activeSessions.reduce((sum, session) => {
    return sum + (session.duration_seconds ?? 0)
  }, 0)
  const idleSeconds = idleSessions.reduce((sum, session) => {
    return sum + (session.duration_seconds ?? 0)
  }, 0)
  const allApps = summarizeApps(activeSessions)
  const allAppBreakdown = allApps.map((app, index) => ({
    ...app,
    color: APP_COLORS[index % APP_COLORS.length],
    share: activeSeconds > 0 ? app.seconds / activeSeconds : 0,
  }))
  const appBreakdown = allAppBreakdown.slice(0, 7)
  const appColors = new Map(
    allAppBreakdown.map((app) => [app.name, app.color]),
  )
  const dominantApp = appBreakdown[0] ?? null
  const longestSession = [...activeSessions].sort((left, right) => {
    return (right.duration_seconds ?? 0) - (left.duration_seconds ?? 0)
  })[0] ?? null
  const switchCount = countSwitches(activeSessions)
  const uniqueApps = new Set(activeSessions.map((session) => session.app_display_name)).size
  const timelineBins = createTimelineBins(sessions, runStart, runEnd, appColors)
  const activityBuckets = createRhythmBuckets(sessions, runStart, runEnd)
  const topAppCount = Math.min(appBreakdown.length, allAppBreakdown.length)

  return {
    report,
    runStart,
    runEnd,
    trackedSeconds,
    activeSeconds,
    idleSeconds,
    idleShare: trackedSeconds > 0 ? idleSeconds / trackedSeconds : 0,
    activeShare: trackedSeconds > 0 ? activeSeconds / trackedSeconds : 0,
    sessionCount: sessions.length,
    breakCount: idleSessions.length,
    switchCount,
    uniqueApps,
    dominantApp,
    longestSession,
    longestSessionTimeRange: longestSession
      ? `${formatClock(longestSession.start_timestamp)} - ${formatClock(longestSession.end_timestamp)}`
      : 'No active stretch captured',
    appBreakdown,
    allAppBreakdown,
    topAppCountLabel:
      topAppCount > 0
        ? `Top ${topAppCount} of ${allAppBreakdown.length} apps`
        : 'No apps captured',
    activityBuckets,
    activityTickLabels: createBucketTickLabels(activityBuckets),
    timelineBins,
    timelineTicks: createTicks(runStart, runEnd),
    timelineLegendItems: createTimelineLegend({
      appBreakdown,
      idleSeconds,
      timelineBins,
    }),
    reflectionLines: buildReflection({
      dominantApp,
      activeSeconds,
      idleSeconds,
      trackedSeconds,
      switchCount,
      uniqueApps,
      longestSession,
    }),
    sourceFileName: report?.source_file_name ?? 'No saved report file detected',
    sourceFilePath: report?.source_file_path ?? '',
    pollIntervalSeconds: report?.poll_interval_seconds ?? null,
    idleThresholdSeconds: report?.idle_threshold_seconds ?? null,
    idleColor: IDLE_COLOR,
    emptyColor: EMPTY_COLOR,
  }
}
