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

function createHourlyBuckets(sessions, runStart, runEnd) {
  const startHour = new Date(runStart)
  startHour.setMinutes(0, 0, 0)

  const endHour = new Date(runEnd)
  endHour.setMinutes(0, 0, 0)

  const buckets = new Map()
  for (
    let cursor = new Date(startHour);
    cursor <= endHour;
    cursor = new Date(cursor.getTime() + 60 * 60 * 1000)
  ) {
    const key = cursor.toISOString()
    buckets.set(key, {
      hourKey: key,
      label: cursor.toLocaleTimeString([], { hour: 'numeric' }),
      active: 0,
      idle: 0,
    })
  }

  sessions.forEach((session) => {
    let segmentStart = toDate(session.start_timestamp)
    const sessionEnd = toDate(session.end_timestamp)

    while (segmentStart < sessionEnd) {
      const nextHour = new Date(segmentStart)
      nextHour.setMinutes(60, 0, 0)

      const sliceEnd = nextHour < sessionEnd ? nextHour : sessionEnd
      const sliceSeconds = Math.max((sliceEnd - segmentStart) / 1000, 0)
      const bucketKey = new Date(
        segmentStart.getFullYear(),
        segmentStart.getMonth(),
        segmentStart.getDate(),
        segmentStart.getHours(),
      ).toISOString()
      const bucket = buckets.get(bucketKey)

      if (bucket) {
        if (session.session_type === 'idle') {
          bucket.idle += sliceSeconds
        } else {
          bucket.active += sliceSeconds
        }
      }

      segmentStart = sliceEnd
    }
  })

  return [...buckets.values()]
}

function summarizeApps(activeSessions) {
  const appTotals = new Map()

  activeSessions.forEach((session) => {
    const key = session.app_name || 'Unknown'
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
      displayApps: sortedApps,
      allApps: sortedApps,
    }
  }

  const visibleApps = sortedApps.slice(0, 5)
  const otherTotals = sortedApps.slice(5).reduce(
    (accumulator, item) => {
      accumulator.seconds += item.seconds
      accumulator.sessions += item.sessions
      return accumulator
    },
    { name: 'Other', seconds: 0, sessions: 0 },
  )

  return {
    displayApps: [...visibleApps, otherTotals],
    allApps: sortedApps,
  }
}

function countSwitches(activeSessions) {
  if (activeSessions.length <= 1) {
    return 0
  }

  let switches = 0
  let previous = activeSessions[0].app_name

  for (const session of activeSessions.slice(1)) {
    if (session.app_name !== previous) {
      switches += 1
      previous = session.app_name
    }
  }

  return switches
}

function buildTimelineSegments(sessions, runStart, runEnd, appColors) {
  const totalMs = Math.max(runEnd - runStart, 1)

  return sessions.map((session) => {
    const sessionStart = toDate(session.start_timestamp)
    const sessionEnd = toDate(session.end_timestamp)
    const left = clamp(((sessionStart - runStart) / totalMs) * 100, 0, 100)
    const width = clamp(((sessionEnd - sessionStart) / totalMs) * 100, 0.4, 100)
    const idle = session.session_type === 'idle'

    return {
      key: `${session.start_timestamp}-${session.app_name}-${session.session_type}`,
      label: idle ? 'Idle' : session.app_name,
      detail: `${formatClock(session.start_timestamp)} - ${formatClock(session.end_timestamp)}`,
      left,
      width,
      color: idle ? IDLE_COLOR : appColors.get(session.app_name) ?? APP_COLORS[0],
      idle,
    }
  })
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
      `Your longest uninterrupted stretch lasted ${formatDuration(longestSession.duration_seconds)} in ${longestSession.app_name}.`,
    )
  }

  if (idleSeconds > activeSeconds * 0.35) {
    lines.push('There was a meaningful amount of pause time, so this reads more like a full-day rhythm than nonstop screen work.')
  }

  return lines
}

export function buildDashboardModel(report) {
  const sessions = [...(report?.sessions ?? [])].sort((left, right) => {
    return toDate(left.start_timestamp) - toDate(right.start_timestamp)
  })

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
  const uniqueApps = new Set(activeSessions.map((session) => session.app_name)).size

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
    hourlyBuckets: createHourlyBuckets(sessions, runStart, runEnd),
    timelineSegments: buildTimelineSegments(sessions, runStart, runEnd, appColors),
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
