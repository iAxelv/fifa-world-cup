import { useCallback, useState, useRef, useEffect, useMemo } from 'react'
import type { WheelEvent, MouseEvent, TouchEvent } from 'react'
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../../firebase.ts'
import { groupsData as initialGroups, matchesData as initialMatches, type Team, type Match } from '../../data/groups.ts'
import { knockoutData, type KnockoutMatch, type KnockoutTeam } from '../../data/knockout.ts'
import './KnockoutModal.css'

interface KnockoutModalProps {
  onClose: () => void
  isAdmin: boolean
}

const MIN_SCALE = 0.7
const MAX_SCALE = 2.8
const MOBILE_BREAKPOINT = 760
const MOBILE_MIN_SCALE = 0.45
const MOBILE_MAX_SCALE = 2.3
const DRAG_MOVE_THRESHOLD = 8
const LOCAL_PREDICTIONS_KEY = 'worldcup_local_predictions'
const LOCAL_KNOCKOUT_PREDICTIONS_KEY = 'worldcup_local_knockout_predictions'

type MatchResult = {
  homeGoals: number
  awayGoals: number
  homePenalties?: number | null
  awayPenalties?: number | null
}

type KnockoutPrediction = {
  homeGoals: number
  awayGoals: number
  homePenalties: number | null
  awayPenalties: number | null
}

type KnockoutPredictions = Record<string, KnockoutPrediction>

type EditingDraft = {
  homeGoals: string
  awayGoals: string
  homePenalties: string
  awayPenalties: string
}

type DraftValidation = {
  result: MatchResult | null
  error: string | null
}

const cloneTeamWithZeroStats = (team: Team): Team => ({
  ...team,
  pj: 0,
  g: 0,
  e: 0,
  p: 0,
  gf: 0,
  gc: 0,
  pts: 0
})

const compareByGeneralCriteria = (a: Team, b: Team) => {
  if (b.pts !== a.pts) return b.pts - a.pts
  const dgB = b.gf - b.gc
  const dgA = a.gf - a.gc
  if (dgB !== dgA) return dgB - dgA
  if (b.gf !== a.gf) return b.gf - a.gf
  return a.name.localeCompare(b.name)
}

const sortTeams = (teams: Team[], groupMatches?: Match[]) => {
  const sorted = [...teams]
  sorted.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts
    if (groupMatches) {
      const tiedTeams = sorted.filter((team) => team.pts === a.pts)
      const tiedTeamIds = new Set(tiedTeams.map((team) => team.id))
      const hasComparableHeadToHead = tiedTeamIds.has(a.id) && tiedTeamIds.has(b.id)
      if (hasComparableHeadToHead) {
        const headToHeadPoints = tiedTeams.reduce((acc, team) => {
          acc[team.id] = 0
          return acc
        }, {} as Record<string, number>)
        groupMatches.forEach((match) => {
          if (match.homeGoals === null || match.awayGoals === null) return
          if (!tiedTeamIds.has(match.home.id) || !tiedTeamIds.has(match.away.id)) return
          if (match.homeGoals > match.awayGoals) {
            headToHeadPoints[match.home.id] += 3
            return
          }
          if (match.homeGoals < match.awayGoals) {
            headToHeadPoints[match.away.id] += 3
            return
          }
          headToHeadPoints[match.home.id] += 1
          headToHeadPoints[match.away.id] += 1
        })
        if (headToHeadPoints[b.id] !== headToHeadPoints[a.id]) {
          return headToHeadPoints[b.id] - headToHeadPoints[a.id]
        }
      }
    }
    return compareByGeneralCriteria(a, b)
  })
  return sorted
}

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString)
  const formattedDate = date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  const formattedTime = date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23'
  })
  return `${formattedDate} ${formattedTime}`
}

const assignThirds = (bestThirds: Array<Team & { group: string }>) => {
  const slots = ['3-CDFGH', '3-ABCDF', '3-BEFIJ', '3-AEHIJ', '3-CEFHI', '3-EHIJK', '3-EFGIJ', '3-DEIJL']
  const assignments: Record<string, Team> = {}
  
  const resolve = (slotIndex: number, availableTeams: Array<Team & { group: string }>) => {
    if (slotIndex >= slots.length) return true
    const slot = slots[slotIndex]
    const allowedGroups = slot.split('-')[1].split('')
    
    for (let i = 0; i < availableTeams.length; i++) {
      const candidate = availableTeams[i]
      if (!allowedGroups.includes(candidate.group)) continue
      
      assignments[slot] = candidate
      const remaining = [...availableTeams]
      remaining.splice(i, 1)
      
      if (resolve(slotIndex + 1, remaining)) {
        return true
      }
      delete assignments[slot]
    }
    return false
  }
  
  resolve(0, bestThirds)
  return assignments
}

interface MatchBoxProps {
  match: KnockoutMatch
  lineClassName?: string
  side?: 'left' | 'right' | 'center'
  onClick?: (match: KnockoutMatch) => void
}

const normalizePlaceholder = (value: string) => {
  if (value.startsWith('Ganador ')) {
    return `W ${value.replace('Ganador ', '')}`
  }
  if (value.startsWith('Perdedor ')) {
    return `L ${value.replace('Perdedor ', '')}`
  }
  return value
}

const parseReference = (value: string): { type: 'W' | 'L'; prevId: string } | null => {
  if (value.startsWith('W ')) {
    return { type: 'W', prevId: value.replace('W ', '') }
  }
  if (value.startsWith('L ')) {
    return { type: 'L', prevId: value.replace('L ', '') }
  }
  if (value.startsWith('Ganador ')) {
    return { type: 'W', prevId: value.replace('Ganador ', '') }
  }
  if (value.startsWith('Perdedor ')) {
    return { type: 'L', prevId: value.replace('Perdedor ', '') }
  }
  return null
}

const parseOptionalGoal = (value: string): number | null => {
  if (value.trim() === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.floor(parsed)
}

const readLocalKnockoutPredictions = (): KnockoutPredictions => {
  try {
    const raw = localStorage.getItem(LOCAL_KNOCKOUT_PREDICTIONS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, {
      homeGoals?: unknown
      awayGoals?: unknown
      homePenalties?: unknown
      awayPenalties?: unknown
    }>
    
    return Object.entries(parsed).reduce((acc, [matchId, values]) => {
      if (
        typeof values.homeGoals === 'number' &&
        Number.isFinite(values.homeGoals) &&
        values.homeGoals >= 0 &&
        typeof values.awayGoals === 'number' &&
        Number.isFinite(values.awayGoals) &&
        values.awayGoals >= 0
      ) {
        acc[matchId] = {
          homeGoals: Math.floor(values.homeGoals),
          awayGoals: Math.floor(values.awayGoals),
          homePenalties:
            typeof values.homePenalties === 'number' && Number.isFinite(values.homePenalties) && values.homePenalties >= 0
              ? Math.floor(values.homePenalties)
              : null,
          awayPenalties:
            typeof values.awayPenalties === 'number' && Number.isFinite(values.awayPenalties) && values.awayPenalties >= 0
              ? Math.floor(values.awayPenalties)
              : null
        }
      }
      return acc
    }, {} as KnockoutPredictions)
  } catch {
    return {}
  }
}

const persistLocalKnockoutPredictions = (predictions: KnockoutPredictions) => {
  localStorage.setItem(LOCAL_KNOCKOUT_PREDICTIONS_KEY, JSON.stringify(predictions))
}

const resolveWinnerAndLoser = (
  home: KnockoutTeam,
  away: KnockoutTeam,
  result: MatchResult
): { winner: Team; loser: Team } | null => {
  if (home.id === 'tbd' || away.id === 'tbd' || home.isPlaceholder || away.isPlaceholder) {
    return null
  }
  
  const homeTeam = { id: home.id, name: home.name } as Team
  const awayTeam = { id: away.id, name: away.name } as Team
  
  if (result.homeGoals > result.awayGoals) {
    return { winner: homeTeam, loser: awayTeam }
  }
  if (result.awayGoals > result.homeGoals) {
    return { winner: awayTeam, loser: homeTeam }
  }
  
  const homePens = result.homePenalties
  const awayPens = result.awayPenalties
  
  if (homePens === null || homePens === undefined || awayPens === null || awayPens === undefined || homePens === awayPens) {
    return null
  }
  
  return homePens > awayPens
    ? { winner: homeTeam, loser: awayTeam }
    : { winner: awayTeam, loser: homeTeam }
}

const MatchBox = ({ match, lineClassName = '', side = 'left', onClick }: MatchBoxProps) => (
  <button type="button" className={`knockout-match ${lineClassName} side-${side}`} onClick={() => onClick?.(match)}>
    <div className="knockout-match-datetime">{formatDateTime(match.date)}</div>
    <div className="knockout-team">
      <div className="knockout-team-info">
        {match.home.id !== 'tbd' && !match.home.isPlaceholder && (
          <img src={`https://flagcdn.com/${match.home.id}.svg`} alt={match.home.name} className="knockout-flag" />
        )}
        <span className="knockout-team-name">{normalizePlaceholder(match.home.name)}</span>
      </div>
      <span className="knockout-team-score">{match.homeGoals ?? '-'}</span>
    </div>
    <div className="knockout-team">
      <div className="knockout-team-info">
        {match.away.id !== 'tbd' && !match.away.isPlaceholder && (
          <img src={`https://flagcdn.com/${match.away.id}.svg`} alt={match.away.name} className="knockout-flag" />
        )}
        <span className="knockout-team-name">{normalizePlaceholder(match.away.name)}</span>
      </div>
      <span className="knockout-team-score">{match.awayGoals ?? '-'}</span>
    </div>
    {(match.homeGoals !== null && match.awayGoals !== null) && (
      <div className="knockout-penalties-pill">
        Pen: {match.homePenalties ?? '-'} - {match.awayPenalties ?? '-'}
      </div>
    )}
  </button>
)

const Spines = ({ count, side }: { count: number; side: 'left' | 'right' }) => {
  if (count < 2) return null
  const spines = []
  for (let i = 0; i < count / 2; i++) {
    const totalNodes = count * 2
    const top = ((1 + 4 * i) / totalNodes) * 100
    const height = (2 / totalNodes) * 100
    spines.push(
      <div
        key={i}
        className={`knockout-spine knockout-spine-${side}`}
        style={{ top: `${top}%`, height: `${height}%` }}
      />
    )
  }
  return <>{spines}</>
}

const KnockoutModal = ({ onClose, isAdmin }: KnockoutModalProps) => {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches)
  
  const [officialResults, setOfficialResults] = useState<Record<string, any>>({})
  const [localPredictions, setLocalPredictions] = useState<Record<string, any>>({})
  const [localKnockoutPredictions, setLocalKnockoutPredictions] = useState<KnockoutPredictions>(() => readLocalKnockoutPredictions())
  
  const [editingMatch, setEditingMatch] = useState<KnockoutMatch | null>(null)
  const [editingDraft, setEditingDraft] = useState<EditingDraft>({ homeGoals: '', awayGoals: '', homePenalties: '', awayPenalties: '' })
  
  const viewportRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const dragStart = useRef({ x: 0, y: 0 })
  const dragMovedRef = useRef(false)
  const pinchStartDistanceRef = useRef<number | null>(null)
  const pinchStartScaleRef = useRef(1)

  const getScaleBounds = useCallback((mobile: boolean) => {
    if (mobile) {
      return { min: MOBILE_MIN_SCALE, max: MOBILE_MAX_SCALE }
    }
    return { min: MIN_SCALE, max: MAX_SCALE }
  }, [])

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'worldcup'), (snapshot) => {
      const nextOfficial: Record<string, any> = {}
      snapshot.forEach((document) => {
        nextOfficial[document.id] = document.data()
      })
      setOfficialResults(nextOfficial)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_PREDICTIONS_KEY)
      if (raw) setLocalPredictions(JSON.parse(raw))
    } catch {}
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches)
    }
    setIsMobile(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow
    const previousBodyOverscroll = document.body.style.overscrollBehavior
    const previousRootOverflow = document.documentElement.style.overflow
    const previousRootOverscroll = document.documentElement.style.overscrollBehavior

    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'
    document.documentElement.style.overflow = 'hidden'
    document.documentElement.style.overscrollBehavior = 'none'

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.body.style.overscrollBehavior = previousBodyOverscroll
      document.documentElement.style.overflow = previousRootOverflow
      document.documentElement.style.overscrollBehavior = previousRootOverscroll
    }
  }, [])

  useEffect(() => {
    const cleaned = { ...localKnockoutPredictions }
    let changed = false
    Object.entries(officialResults).forEach(([matchId, official]) => {
      if ((official as { homeGoals?: number | null }).homeGoals !== null && cleaned[matchId]) {
        delete cleaned[matchId]
        changed = true
      }
    })
    if (changed) {
      setLocalKnockoutPredictions(cleaned)
      persistLocalKnockoutPredictions(cleaned)
    }
  }, [officialResults, localKnockoutPredictions])

  const liveMatchesData = useMemo(() => {
    return Object.keys(initialMatches).reduce((acc, groupKey) => {
      acc[groupKey] = initialMatches[groupKey].map((match) => {
        const official = officialResults[match.id]
        const hasOfficial = official?.homeGoals !== null && official?.homeGoals !== undefined
        const local = localPredictions[match.id]
        const homeGoals = hasOfficial ? official?.homeGoals ?? null : (local?.homeGoals ?? null)
        const awayGoals = hasOfficial ? official?.awayGoals ?? null : (local?.awayGoals ?? null)
        return { ...match, homeGoals, awayGoals }
      })
      return acc
    }, {} as Record<string, Match[]>)
  }, [officialResults, localPredictions])

  const liveGroupsData = useMemo(() => {
    const base = Object.keys(initialGroups).reduce((acc, groupKey) => {
      acc[groupKey] = initialGroups[groupKey].map(cloneTeamWithZeroStats)
      return acc
    }, {} as Record<string, Team[]>)
    
    Object.keys(liveMatchesData).forEach((groupKey) => {
      const teamsById = base[groupKey].reduce((acc, team) => {
        acc[team.id] = team
        return acc
      }, {} as Record<string, Team>)
      
      liveMatchesData[groupKey].forEach((match) => {
        if (match.homeGoals === null || match.awayGoals === null) return
        const homeTeam = teamsById[match.home.id]
        const awayTeam = teamsById[match.away.id]
        if (!homeTeam || !awayTeam) return
        
        homeTeam.pj += 1
        awayTeam.pj += 1
        homeTeam.gf += match.homeGoals
        homeTeam.gc += match.awayGoals
        awayTeam.gf += match.awayGoals
        awayTeam.gc += match.homeGoals
        
        if (match.homeGoals > match.awayGoals) {
          homeTeam.g += 1
          awayTeam.p += 1
          homeTeam.pts += 3
        } else if (match.homeGoals < match.awayGoals) {
          awayTeam.g += 1
          homeTeam.p += 1
          awayTeam.pts += 3
        } else {
          homeTeam.e += 1
          awayTeam.e += 1
          homeTeam.pts += 1
          awayTeam.pts += 1
        }
      })
      base[groupKey] = sortTeams(base[groupKey], liveMatchesData[groupKey])
    })
    return base
  }, [liveMatchesData])

  const standings = useMemo(() => {
    const firsts: Record<string, Team> = {}
    const seconds: Record<string, Team> = {}
    const thirds: Array<Team & { group: string }> = []
    
    Object.keys(liveGroupsData).forEach(group => {
      const teams = liveGroupsData[group]
      if (teams[0]) firsts[group] = teams[0]
      if (teams[1]) seconds[group] = teams[1]
      if (teams[2]) thirds.push({ ...teams[2], group })
    })
    
    const bestThirds = (sortTeams(thirds) as Array<Team & { group: string }>).slice(0, 8)
    return { firsts, seconds, bestThirds }
  }, [liveGroupsData])

  const liveKnockout = useMemo(() => {
    const thirdsAssignments = assignThirds(standings.bestThirds)
    const knockoutResults: Record<string, Team> = {}
    const knockoutLosers: Record<string, Team> = {}
    
    const resolveTeam = (placeholder: string): KnockoutTeam => {
      if (placeholder.startsWith('1')) {
        const group = placeholder[1]
        const team = standings.firsts[group]
        return team ? { id: team.id, name: team.name } : { id: 'tbd', name: placeholder, isPlaceholder: true }
      }
      if (placeholder.startsWith('2')) {
        const group = placeholder[1]
        const team = standings.seconds[group]
        return team ? { id: team.id, name: team.name } : { id: 'tbd', name: placeholder, isPlaceholder: true }
      }
      if (placeholder.startsWith('3-')) {
        const team = thirdsAssignments[placeholder]
        return team ? { id: team.id, name: team.name } : { id: 'tbd', name: placeholder, isPlaceholder: true }
      }
      return { id: 'tbd', name: placeholder, isPlaceholder: true }
    }

    const processRound = (matches: KnockoutMatch[]) => {
      return matches.map(match => {
        let home: KnockoutTeam
        let away: KnockoutTeam
        
        const homeReference = parseReference(match.home.name)
        if (homeReference?.type === 'W') {
          const winner = knockoutResults[homeReference.prevId]
          home = winner ? { id: winner.id, name: winner.name } : { id: 'tbd', name: normalizePlaceholder(match.home.name), isPlaceholder: true }
        } else if (homeReference?.type === 'L') {
          const loser = knockoutLosers[homeReference.prevId]
          home = loser ? { id: loser.id, name: loser.name } : { id: 'tbd', name: normalizePlaceholder(match.home.name), isPlaceholder: true }
        } else {
          home = resolveTeam(match.home.name)
        }
        
        const awayReference = parseReference(match.away.name)
        if (awayReference?.type === 'W') {
          const winner = knockoutResults[awayReference.prevId]
          away = winner ? { id: winner.id, name: winner.name } : { id: 'tbd', name: normalizePlaceholder(match.away.name), isPlaceholder: true }
        } else if (awayReference?.type === 'L') {
          const loser = knockoutLosers[awayReference.prevId]
          away = loser ? { id: loser.id, name: loser.name } : { id: 'tbd', name: normalizePlaceholder(match.away.name), isPlaceholder: true }
        } else {
          away = resolveTeam(match.away.name)
        }
        
        const official = officialResults[match.id]
        const local = localKnockoutPredictions[match.id]
        
        const homeGoals = (official?.homeGoals !== undefined && official?.homeGoals !== null) ? official.homeGoals : (local?.homeGoals ?? null)
        const awayGoals = (official?.awayGoals !== undefined && official?.awayGoals !== null) ? official.awayGoals : (local?.awayGoals ?? null)
        const homePenalties = (official?.homePenalties !== undefined && official?.homePenalties !== null) ? official.homePenalties : (local?.homePenalties ?? null)
        const awayPenalties = (official?.awayPenalties !== undefined && official?.awayPenalties !== null) ? official.awayPenalties : (local?.awayPenalties ?? null)
        
        if (homeGoals !== null && awayGoals !== null) {
          const resolved = resolveWinnerAndLoser(home, away, {
            homeGoals,
            awayGoals,
            homePenalties,
            awayPenalties
          })
          if (resolved) {
            knockoutResults[match.id] = resolved.winner
            knockoutLosers[match.id] = resolved.loser
          }
        }
        
        return { ...match, home, away, homeGoals, awayGoals, homePenalties, awayPenalties }
      })
    }

    const leftRoundOf32 = processRound(knockoutData.leftRoundOf32)
    const rightRoundOf32 = processRound(knockoutData.rightRoundOf32)
    const leftRoundOf16 = processRound(knockoutData.leftRoundOf16)
    const rightRoundOf16 = processRound(knockoutData.rightRoundOf16)
    const leftQuarterfinals = processRound(knockoutData.leftQuarterfinals)
    const rightQuarterfinals = processRound(knockoutData.rightQuarterfinals)
    const leftSemifinals = processRound(knockoutData.leftSemifinals)
    const rightSemifinals = processRound(knockoutData.rightSemifinals)
    const final = processRound([knockoutData.final])[0]
    const thirdPlace = processRound([knockoutData.thirdPlace])[0]

    return {
      leftRoundOf32, rightRoundOf32,
      leftRoundOf16, rightRoundOf16,
      leftQuarterfinals, rightQuarterfinals,
      leftSemifinals, rightSemifinals,
      final, thirdPlace
    }
  }, [standings, officialResults, localKnockoutPredictions])

  const getMatchResultSource = useCallback((matchId: string) => {
    const official = officialResults[matchId]
    if (official?.homeGoals !== undefined && official?.homeGoals !== null && official?.awayGoals !== undefined && official?.awayGoals !== null) {
      return {
        source: 'official' as const,
        result: {
          homeGoals: official.homeGoals,
          awayGoals: official.awayGoals,
          homePenalties: official.homePenalties ?? null,
          awayPenalties: official.awayPenalties ?? null
        }
      }
    }
    const local = localKnockoutPredictions[matchId]
    if (local) {
      return {
        source: 'local' as const,
        result: {
          homeGoals: local.homeGoals,
          awayGoals: local.awayGoals,
          homePenalties: local.homePenalties ?? null,
          awayPenalties: local.awayPenalties ?? null
        }
      }
    }
    return { source: 'none' as const, result: null }
  }, [officialResults, localKnockoutPredictions])

  const updateLocalKnockoutPrediction = useCallback((matchId: string, result: MatchResult | null) => {
    setLocalKnockoutPredictions((prev) => {
      const next = { ...prev }
      if (!result) {
        delete next[matchId]
      } else {
        next[matchId] = {
          homeGoals: result.homeGoals,
          awayGoals: result.awayGoals,
          homePenalties: result.homePenalties ?? null,
          awayPenalties: result.awayPenalties ?? null
        }
      }
      persistLocalKnockoutPredictions(next)
      return next
    })
  }, [])

  const updateOfficialKnockoutResult = useCallback(async (match: KnockoutMatch, result: MatchResult | null) => {
    if (!result) {
      await setDoc(
        doc(db, 'worldcup', match.id),
        {
          date: match.date,
          homeGoals: null,
          awayGoals: null,
          homePenalties: null,
          awayPenalties: null,
          winner: null
        },
        { merge: true }
      )
      return
    }
    
    const resolved = resolveWinnerAndLoser(match.home, match.away, result)
    const winner = resolved ? resolved.winner.id : null
    
    await setDoc(
      doc(db, 'worldcup', match.id),
      {
        date: match.date,
        homeGoals: result.homeGoals,
        awayGoals: result.awayGoals,
        homePenalties: result.homePenalties ?? null,
        awayPenalties: result.awayPenalties ?? null,
        winner
      },
      { merge: true }
    )
  }, [])

  const buildResultFromDraft = useCallback((draft: EditingDraft): DraftValidation => {
    const homeGoals = parseOptionalGoal(draft.homeGoals)
    const awayGoals = parseOptionalGoal(draft.awayGoals)
    
    if (homeGoals === null && awayGoals === null) {
      return { result: null, error: null }
    }
    
    if (homeGoals === null || awayGoals === null) {
      return { result: null, error: 'Completa ambos marcadores o deja ambos vacios.' }
    }
    
    const homePenalties = parseOptionalGoal(draft.homePenalties)
    const awayPenalties = parseOptionalGoal(draft.awayPenalties)
    
    if (homeGoals !== awayGoals) {
      return {
        result: {
          homeGoals,
          awayGoals,
          homePenalties: null,
          awayPenalties: null
        },
        error: null
      }
    }
    
    if ((homePenalties === null) !== (awayPenalties === null)) {
      return { result: null, error: 'Si empatan, debes completar ambos penales.' }
    }
    
    if (homePenalties === null && awayPenalties === null) {
      return {
        result: {
          homeGoals,
          awayGoals,
          homePenalties: null,
          awayPenalties: null
        },
        error: null
      }
    }
    
    if (homePenalties === awayPenalties) {
      return { result: null, error: 'Los penales no pueden terminar empatados.' }
    }
    
    return {
      result: {
        homeGoals,
        awayGoals,
        homePenalties,
        awayPenalties
      },
      error: null
    }
  }, [])

  const canEditMatch = useCallback((match: KnockoutMatch) => {
    const hasTeamsReady =
      match.home.id !== 'tbd' &&
      match.away.id !== 'tbd' &&
      !match.home.isPlaceholder &&
      !match.away.isPlaceholder
      
    if (!hasTeamsReady) return false
    if (isAdmin) return true
    
    return !(officialResults[match.id]?.homeGoals !== null && officialResults[match.id]?.homeGoals !== undefined)
  }, [isAdmin, officialResults])

  const openMatchEditor = useCallback((match: KnockoutMatch) => {
    if (!canEditMatch(match) || isDragging) return
    const { result } = getMatchResultSource(match.id)
    setEditingMatch(match)
    setEditingDraft({
      homeGoals: result ? String(result.homeGoals) : '',
      awayGoals: result ? String(result.awayGoals) : '',
      homePenalties: result?.homePenalties === null || result?.homePenalties === undefined ? '' : String(result.homePenalties),
      awayPenalties: result?.awayPenalties === null || result?.awayPenalties === undefined ? '' : String(result.awayPenalties)
    })
  }, [canEditMatch, getMatchResultSource, isDragging])

  const closeEditor = () => {
    setEditingMatch(null)
  }

  const handleEditorChange = (field: keyof EditingDraft, value: string) => {
    if (value !== '' && !/^\d+$/.test(value)) {
      return
    }
    setEditingDraft((prev) => ({ ...prev, [field]: value }))
  }

  const handleSaveMatch = async () => {
    if (!editingMatch) return
    const validation = buildResultFromDraft(editingDraft)
    
    if (validation.error) {
      return
    }
    
    if (isAdmin) {
      await updateOfficialKnockoutResult(editingMatch, validation.result)
    } else {
      updateLocalKnockoutPrediction(editingMatch.id, validation.result)
    }
    
    closeEditor()
  }

  const clampPosition = useCallback((nextPosition: { x: number; y: number }, nextScale: number) => {
    const viewport = viewportRef.current
    const board = boardRef.current
    if (!viewport || !board) {
      return nextPosition
    }
    const scaledWidth = board.offsetWidth * nextScale
    const scaledHeight = board.offsetHeight * nextScale
    
    const maxOffsetX = Math.max((scaledWidth - viewport.clientWidth) / 2, 0) + 120
    const maxOffsetY = Math.max((scaledHeight - viewport.clientHeight) / 2, 0) + 180
    
    return {
      x: Math.min(Math.max(nextPosition.x, -maxOffsetX), maxOffsetX),
      y: Math.min(Math.max(nextPosition.y, -maxOffsetY), maxOffsetY)
    }
  }, [])

  const fitBoardForMobile = useCallback(() => {
    const viewport = viewportRef.current
    const board = boardRef.current
    if (!viewport || !board) {
      return
    }
    const boardWidth = board.offsetWidth
    const boardHeight = board.offsetHeight
    if (boardWidth <= 0 || boardHeight <= 0) {
      return
    }
    
    const { min, max } = getScaleBounds(true)
    const fitScale = Math.min(Math.max(0.55, min), max)
    
    setScale(fitScale)
    setPosition({ x: 0, y: 0 })
  }, [getScaleBounds])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }
    const updateLayout = () => {
      if (isMobile) {
        fitBoardForMobile()
        return
      }
      const { min, max } = getScaleBounds(false)
      setScale((currentScale) => {
        const bounded = Math.min(Math.max(currentScale, min), max)
        setPosition((currentPosition) => clampPosition(currentPosition, bounded))
        return bounded
      })
    }
    
    const frame = window.requestAnimationFrame(updateLayout)
    window.addEventListener('resize', updateLayout)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', updateLayout)
    }
  }, [isMobile, fitBoardForMobile, getScaleBounds, clampPosition])

  const handleWheel = (e: WheelEvent) => {
    if (isMobile) {
      return
    }
    e.preventDefault()
    const zoomFactor = 0.08
    const newScale = e.deltaY < 0 ? scale + zoomFactor : scale - zoomFactor
    
    const { min, max } = getScaleBounds(false)
    const boundedScale = Math.min(Math.max(newScale, min), max)
    
    setScale(boundedScale)
    setPosition((current) => clampPosition(current, boundedScale))
  }

  const blockWheelPropagation = (e: WheelEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleMouseDown = (e: MouseEvent) => {
    if (isMobile) {
      return
    }
    if (e.button !== 0) {
      return
    }
    e.preventDefault()
    setIsDragging(true)
    dragMovedRef.current = false
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isMobile) {
      return
    }
    if (isDragging) {
      e.preventDefault()
      if (Math.abs(e.clientX - (dragStart.current.x + position.x)) > 3 || Math.abs(e.clientY - (dragStart.current.y + position.y)) > 3) {
        dragMovedRef.current = true
      }
      setPosition(clampPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      }, scale))
    }
  }

  const handleMouseUp = () => {
    if (isMobile) {
      return
    }
    setIsDragging(false)
    window.getSelection()?.removeAllRanges()
  }

  const getTouchDistance = (touchA: { clientX: number; clientY: number }, touchB: { clientX: number; clientY: number }) => {
    return Math.hypot(touchA.clientX - touchB.clientX, touchA.clientY - touchB.clientY)
  }

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (!isMobile) {
      return
    }
    if (event.touches.length === 1) {
      const touch = event.touches[0]
      dragMovedRef.current = false
      pinchStartDistanceRef.current = null
      pinchStartScaleRef.current = scale
      
      setIsDragging(true)
      dragStart.current = {
        x: touch.clientX - position.x,
        y: touch.clientY - position.y
      }
      return
    }
    if (event.touches.length === 2) {
      const first = event.touches[0]
      const second = event.touches[1]
      
      dragMovedRef.current = true
      setIsDragging(false)
      pinchStartDistanceRef.current = getTouchDistance(first, second)
      pinchStartScaleRef.current = scale
    }
  }

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (!isMobile) {
      return
    }
    if (event.touches.length === 2) {
      event.preventDefault()
      const first = event.touches[0]
      const second = event.touches[1]
      const currentDistance = getTouchDistance(first, second)
      
      const startDistance = pinchStartDistanceRef.current
      if (!startDistance || startDistance <= 0) {
        return
      }
      
      const rawScale = pinchStartScaleRef.current * (currentDistance / startDistance)
      const { min, max } = getScaleBounds(true)
      const boundedScale = Math.min(Math.max(rawScale, min), max)
      
      setScale(boundedScale)
      setPosition((current) => clampPosition(current, boundedScale))
      return
    }
    
    if (event.touches.length === 1 && isDragging) {
      event.preventDefault()
      const touch = event.touches[0]
      const nextPosition = {
        x: touch.clientX - dragStart.current.x,
        y: touch.clientY - dragStart.current.y
      }
      
      if (
        Math.abs(nextPosition.x - position.x) > DRAG_MOVE_THRESHOLD ||
        Math.abs(nextPosition.y - position.y) > DRAG_MOVE_THRESHOLD
      ) {
        dragMovedRef.current = true
      }
      
      setPosition(clampPosition(nextPosition, scale))
    }
  }

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (!isMobile) {
      return
    }
    if (event.touches.length === 0) {
      setIsDragging(false)
      pinchStartDistanceRef.current = null
      return
    }
    if (event.touches.length === 1) {
      const touch = event.touches[0]
      setIsDragging(true)
      dragStart.current = {
        x: touch.clientX - position.x,
        y: touch.clientY - position.y
      }
      pinchStartDistanceRef.current = null
    }
  }

  const editorValidation = editingMatch ? buildResultFromDraft(editingDraft) : null

  return (
    <div className="knockout-overlay" onClick={onClose} onWheel={blockWheelPropagation}>
      <div className={`knockout-content ${isMobile ? 'is-mobile' : 'is-desktop'}`} onClick={(e) => e.stopPropagation()} onWheel={blockWheelPropagation}>
        <button className="knockout-close-button" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </button>
        <h2 className="knockout-title">ELIMINATORIAS</h2>
        <div
          className={`knockout-viewport ${isDragging ? 'is-dragging' : ''}`}
          ref={viewportRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="knockout-board"
            ref={boardRef}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`
            }}
          >
            <div className="knockout-side">
              <div className="knockout-round">
                <h4 className="knockout-round-title">16avos</h4>
                <div className="knockout-matches-col">
                  <Spines count={liveKnockout.leftRoundOf32.length} side="right" />
                  {liveKnockout.leftRoundOf32.map((match) => (
                    <MatchBox key={match.id} match={match} side="left" lineClassName="line-out-right" onClick={(matchData) => {
                      if (dragMovedRef.current) return
                      openMatchEditor(matchData)
                    }} />
                  ))}
                </div>
              </div>
              <div className="knockout-round">
                <h4 className="knockout-round-title">Octavos</h4>
                <div className="knockout-matches-col">
                  <Spines count={liveKnockout.leftRoundOf16.length} side="right" />
                  {liveKnockout.leftRoundOf16.map((match) => (
                    <MatchBox key={match.id} match={match} side="left" lineClassName="line-in-left line-out-right" onClick={(matchData) => {
                      if (dragMovedRef.current) return
                      openMatchEditor(matchData)
                    }} />
                  ))}
                </div>
              </div>
              <div className="knockout-round">
                <h4 className="knockout-round-title">Cuartos</h4>
                <div className="knockout-matches-col">
                  <Spines count={liveKnockout.leftQuarterfinals.length} side="right" />
                  {liveKnockout.leftQuarterfinals.map((match) => (
                    <MatchBox key={match.id} match={match} side="left" lineClassName="line-in-left line-out-right" onClick={(matchData) => {
                      if (dragMovedRef.current) return
                      openMatchEditor(matchData)
                    }} />
                  ))}
                </div>
              </div>
              <div className="knockout-round">
                <h4 className="knockout-round-title">Semifinal</h4>
                <div className="knockout-matches-col">
                  {liveKnockout.leftSemifinals.map((match) => (
                    <MatchBox key={match.id} match={match} side="left" lineClassName="line-in-left line-out-right" onClick={(matchData) => {
                      if (dragMovedRef.current) return
                      openMatchEditor(matchData)
                    }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="knockout-center">
              <div className="knockout-matches-col">
                <Spines count={2} side="left" />
                <Spines count={2} side="right" />
                <div className="knockout-final-group">
                  <h4 className="knockout-round-title knockout-gold knockout-center-title">Final</h4>
                  <MatchBox match={liveKnockout.final} side="center" lineClassName="line-in-left line-in-right" onClick={(matchData) => {
                    if (dragMovedRef.current) return
                    openMatchEditor(matchData)
                  }} />
                </div>
                <div className="knockout-final-group">
                  <h4 className="knockout-round-title knockout-bronze knockout-center-title">Tercer Puesto</h4>
                  <MatchBox match={liveKnockout.thirdPlace} side="center" lineClassName="line-in-left line-in-right" onClick={(matchData) => {
                    if (dragMovedRef.current) return
                    openMatchEditor(matchData)
                  }} />
                </div>
              </div>
            </div>
            <div className="knockout-side">
              <div className="knockout-round">
                <h4 className="knockout-round-title">Semifinal</h4>
                <div className="knockout-matches-col">
                  {liveKnockout.rightSemifinals.map((match) => (
                    <MatchBox key={match.id} match={match} side="right" lineClassName="line-in-right line-out-left" onClick={(matchData) => {
                      if (dragMovedRef.current) return
                      openMatchEditor(matchData)
                    }} />
                  ))}
                </div>
              </div>
              <div className="knockout-round">
                <h4 className="knockout-round-title">Cuartos</h4>
                <div className="knockout-matches-col">
                  <Spines count={liveKnockout.rightQuarterfinals.length} side="left" />
                  {liveKnockout.rightQuarterfinals.map((match) => (
                    <MatchBox key={match.id} match={match} side="right" lineClassName="line-in-right line-out-left" onClick={(matchData) => {
                      if (dragMovedRef.current) return
                      openMatchEditor(matchData)
                    }} />
                  ))}
                </div>
              </div>
              <div className="knockout-round">
                <h4 className="knockout-round-title">Octavos</h4>
                <div className="knockout-matches-col">
                  <Spines count={liveKnockout.rightRoundOf16.length} side="left" />
                  {liveKnockout.rightRoundOf16.map((match) => (
                    <MatchBox key={match.id} match={match} side="right" lineClassName="line-in-right line-out-left" onClick={(matchData) => {
                      if (dragMovedRef.current) return
                      openMatchEditor(matchData)
                    }} />
                  ))}
                </div>
              </div>
              <div className="knockout-round">
                <h4 className="knockout-round-title">16avos</h4>
                <div className="knockout-matches-col">
                  <Spines count={liveKnockout.rightRoundOf32.length} side="left" />
                  {liveKnockout.rightRoundOf32.map((match) => (
                    <MatchBox key={match.id} match={match} side="right" lineClassName="line-out-left" onClick={(matchData) => {
                      if (dragMovedRef.current) return
                      openMatchEditor(matchData)
                    }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        {editingMatch && (
          <div className="knockout-editor-overlay" onClick={closeEditor}>
            <div className="knockout-editor-modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="knockout-editor-title">Editar Resultado</h3>
              <MatchBox match={editingMatch} side="center" />
              <div className="knockout-editor-grid">
                <label>
                  <span>{editingMatch.home.name}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editingDraft.homeGoals}
                    onChange={(e) => handleEditorChange('homeGoals', e.target.value)}
                    placeholder="Goles"
                  />
                </label>
                <label>
                  <span>{editingMatch.away.name}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editingDraft.awayGoals}
                    onChange={(e) => handleEditorChange('awayGoals', e.target.value)}
                    placeholder="Goles"
                  />
                </label>
                <label>
                  <span>Penales {editingMatch.home.name}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editingDraft.homePenalties}
                    onChange={(e) => handleEditorChange('homePenalties', e.target.value)}
                    placeholder="Opcional"
                  />
                </label>
                <label>
                  <span>Penales {editingMatch.away.name}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editingDraft.awayPenalties}
                    onChange={(e) => handleEditorChange('awayPenalties', e.target.value)}
                    placeholder="Opcional"
                  />
                </label>
              </div>
              <p className="knockout-editor-help">
                Si hay empate en goles, completa ambos penales para definir al ganador.
              </p>
              {editorValidation?.error && (
                <p className="knockout-editor-error">{editorValidation.error}</p>
              )}
              <div className="knockout-editor-actions">
                <button type="button" className="knockout-editor-btn ghost" onClick={closeEditor}>Cancelar</button>
                <button type="button" className="knockout-editor-btn" onClick={handleSaveMatch}>Guardar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default KnockoutModal