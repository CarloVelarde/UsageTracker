const APP_COLORS = [
  '#5b7cfa',
  '#f58b54',
  '#5ec5a7',
  '#b284f9',
  '#ef6f9a',
  '#f2c86c',
  '#6da5ff',
  '#8bc7ff',
]

const IDLE_COLOR = '#cfd7ea'

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

    let dominantApp = 'No Tracking'
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
      isEmpty: dominantApp === 'No Tracking',
    }
  })
}

function createTimelineBins(sessions, runStart, runEnd, appColors) {
  return createTimeBuckets(sessions, runStart, runEnd, 32, 72, 12).map((bucket) => {
    let color = '#e4ebf7'
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
  return createTimeBuckets(sessions, runStart, runEnd, 20, 48, 20).map((bucket) => ({
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

  const sortedApps = [...appTotals.values()].sort((left, right) => {
    return right.seconds - left.seconds
  })

  if (sortedApps.length === 0) {
    return {
      displayApps: [],
      allApps: [],
    }
  }

  if (sortedApps.length <= 5) {
    return {
      displayApps: sortedApps.slice(0, 5),
      allApps: sortedApps,
    }
  }

  return {
    displayApps: sortedApps.slice(0, 5),
    allApps: sortedApps,
  }
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

function buildReflection({
  dominantApp,
  activeSeconds,
  idleSeconds,
  switchCount,
  uniqueApps,
  longestSession,
}) {
  if (!dominantApp) {
    return [
      'No active app sessions were captured in this report.',
      'Keep the dashboard open as you refine the tracker and richer daily patterns will appear here.',
    ]
  }

  const activeShare = activeSeconds > 0 ? dominantApp.seconds / activeSeconds : 0
  const lines = [
    `${dominantApp.name} anchored ${Math.round(activeShare * 100)}% of your active time today.`,
    `You moved across ${uniqueApps} apps with ${switchCount} context switches, keeping the day fairly ${switchCount > 10 ? 'dynamic' : 'steady'}.`,
  ]

  if (longestSession) {
    lines.push(
      `Your longest uninterrupted stretch lasted ${formatDuration(longestSession.duration_seconds)} in ${longestSession.app_display_name}.`,
    )
  }

  if (idleSeconds > activeSeconds * 0.35) {
    lines.push('There was a meaningful amount of pause time, so this reads more like a full-day rhythm than nonstop screen work.')
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
  const { displayApps, allApps } = summarizeApps(activeSessions)
  const appColors = new Map(
    allApps.map((app, index) => [app.name, APP_COLORS[index % APP_COLORS.length]]),
  )
  const appBreakdown = displayApps.map((app, index) => ({
    ...app,
    color: APP_COLORS[index % APP_COLORS.length],
    share: activeSeconds > 0 ? app.seconds / activeSeconds : 0,
  }))
  const dominantApp = appBreakdown[0] ?? null
  const longestSession = [...activeSessions].sort((left, right) => {
    return (right.duration_seconds ?? 0) - (left.duration_seconds ?? 0)
  })[0]
  const switchCount = countSwitches(activeSessions)
  const uniqueApps = new Set(activeSessions.map((session) => session.app_display_name)).size
  const timelineBins = createTimelineBins(sessions, runStart, runEnd, appColors)
  const activityBuckets = createRhythmBuckets(sessions, runStart, runEnd)

  return {
    report,
    runStart,
    runEnd,
    trackedSeconds,
    activeSeconds,
    idleSeconds,
    activeShare: trackedSeconds > 0 ? activeSeconds / trackedSeconds : 0,
    sessionCount: sessions.length,
    breakCount: idleSessions.length,
    switchCount,
    uniqueApps,
    dominantApp,
    longestSession,
    appBreakdown,
    activityBuckets,
    activityTickLabels: createBucketTickLabels(activityBuckets),
    timelineBins,
    timelineTicks: createTicks(runStart, runEnd),
    reflectionLines: buildReflection({
      dominantApp,
      activeSeconds,
      idleSeconds,
      switchCount,
      uniqueApps,
      longestSession,
    }),
    idleColor: IDLE_COLOR,
  }
}
