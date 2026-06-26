import { useCallback, useState, useRef, useEffect, useMemo } from 'react'
import type { WheelEvent, MouseEvent } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase.ts'
import { groupsData as initialGroups, matchesData as initialMatches, type Team, type Match } from '../../data/groups.ts'
import { knockoutData, type KnockoutMatch, type KnockoutTeam } from '../../data/knockout.ts'
import './KnockoutModal.css'

interface KnockoutModalProps {
  onClose: () => void
}

const MIN_SCALE = 0.7
const MAX_SCALE = 2.8
const LOCAL_PREDICTIONS_KEY = 'worldcup_local_predictions'

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
  const formattedDate = date.toLocaleDateString([], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  const formattedTime = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  return `${formattedDate} ${formattedTime}`
}

const assignThirds = (bestThirds: Array<Team & { group: string }>) => {
  const slots = ['3-ABCDF', '3-CDFGH', '3-BEFIJ', '3-AEHIJ', '3-CEFHI', '3-EHIJK', '3-EFGIJ', '3-DEIJL']
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
}

const MatchBox = ({ match, lineClassName = '' }: MatchBoxProps) => (
  <div className={`knockout-match ${lineClassName}`}>
    <div className="knockout-match-datetime">{formatDateTime(match.date)}</div>
    <div className="knockout-team">
      <div className="knockout-team-info">
        {match.home.id !== 'tbd' && !match.home.isPlaceholder && (
          <img src={`https://flagcdn.com/${match.home.id}.svg`} alt={match.home.name} className="knockout-flag" />
        )}
        <span className="knockout-team-name">{match.home.name}</span>
      </div>
      <span className="knockout-team-score">{match.homeGoals ?? '-'}</span>
    </div>
    <div className="knockout-team">
      <div className="knockout-team-info">
        {match.away.id !== 'tbd' && !match.away.isPlaceholder && (
          <img src={`https://flagcdn.com/${match.away.id}.svg`} alt={match.away.name} className="knockout-flag" />
        )}
        <span className="knockout-team-name">{match.away.name}</span>
      </div>
      <span className="knockout-team-score">{match.awayGoals ?? '-'}</span>
    </div>
  </div>
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

const KnockoutModal = ({ onClose }: KnockoutModalProps) => {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [officialResults, setOfficialResults] = useState<Record<string, any>>({})
  const [localPredictions, setLocalPredictions] = useState<Record<string, any>>({})
  
  const viewportRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const dragStart = useRef({ x: 0, y: 0 })

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

        if (match.home.name.startsWith('Ganador ')) {
          const prevId = match.home.name.replace('Ganador ', '')
          const winner = knockoutResults[prevId]
          home = winner ? { id: winner.id, name: winner.name } : { id: 'tbd', name: match.home.name, isPlaceholder: true }
        } else if (match.home.name.startsWith('Perdedor ')) {
          const prevId = match.home.name.replace('Perdedor ', '')
          const loser = knockoutLosers[prevId]
          home = loser ? { id: loser.id, name: loser.name } : { id: 'tbd', name: match.home.name, isPlaceholder: true }
        } else {
          home = resolveTeam(match.home.name)
        }

        if (match.away.name.startsWith('Ganador ')) {
          const prevId = match.away.name.replace('Ganador ', '')
          const winner = knockoutResults[prevId]
          away = winner ? { id: winner.id, name: winner.name } : { id: 'tbd', name: match.away.name, isPlaceholder: true }
        } else if (match.away.name.startsWith('Perdedor ')) {
          const prevId = match.away.name.replace('Perdedor ', '')
          const loser = knockoutLosers[prevId]
          away = loser ? { id: loser.id, name: loser.name } : { id: 'tbd', name: match.away.name, isPlaceholder: true }
        } else {
          away = resolveTeam(match.away.name)
        }

        const official = officialResults[match.id]
        const local = localPredictions[match.id]
        const homeGoals = (official?.homeGoals !== undefined && official?.homeGoals !== null) ? official.homeGoals : (local?.homeGoals ?? null)
        const awayGoals = (official?.awayGoals !== undefined && official?.awayGoals !== null) ? official.awayGoals : (local?.awayGoals ?? null)

        if (homeGoals !== null && awayGoals !== null && home.id !== 'tbd' && away.id !== 'tbd' && !home.isPlaceholder && !away.isPlaceholder) {
          if (homeGoals > awayGoals) {
            knockoutResults[match.id] = home as Team
            knockoutLosers[match.id] = away as Team
          } else if (awayGoals > homeGoals) {
            knockoutResults[match.id] = away as Team
            knockoutLosers[match.id] = home as Team
          }
        }

        return { ...match, home, away, homeGoals, awayGoals }
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
  }, [standings, officialResults, localPredictions])

  const clampPosition = useCallback((nextPosition: { x: number; y: number }, nextScale: number) => {
    const viewport = viewportRef.current
    const board = boardRef.current
    if (!viewport || !board) {
      return nextPosition
    }
    const scaledWidth = board.offsetWidth * nextScale
    const scaledHeight = board.offsetHeight * nextScale
    const maxOffsetX = Math.max((scaledWidth - viewport.clientWidth) / 2, 0)
    const maxOffsetY = Math.max((scaledHeight - viewport.clientHeight) / 2, 0)
    return {
      x: Math.min(Math.max(nextPosition.x, -maxOffsetX), maxOffsetX),
      y: Math.min(Math.max(nextPosition.y, -maxOffsetY), maxOffsetY)
    }
  }, [])

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault()
    const zoomFactor = 0.08
    const newScale = e.deltaY < 0 ? scale + zoomFactor : scale - zoomFactor
    const boundedScale = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE)
    setScale(boundedScale)
    setPosition((current) => clampPosition(current, boundedScale))
  }

  const handleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) {
      return
    }
    e.preventDefault()
    setIsDragging(true)
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      e.preventDefault()
      setPosition(clampPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      }, scale))
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    window.getSelection()?.removeAllRanges()
  }

  return (
    <div className="knockout-overlay" onClick={onClose}>
      <div className="knockout-content" onClick={(e) => e.stopPropagation()}>
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
                    <MatchBox key={match.id} match={match} lineClassName="line-out-right" />
                  ))}
                </div>
              </div>
              <div className="knockout-round">
                <h4 className="knockout-round-title">Octavos</h4>
                <div className="knockout-matches-col">
                  <Spines count={liveKnockout.leftRoundOf16.length} side="right" />
                  {liveKnockout.leftRoundOf16.map((match) => (
                    <MatchBox key={match.id} match={match} lineClassName="line-in-left line-out-right" />
                  ))}
                </div>
              </div>
              <div className="knockout-round">
                <h4 className="knockout-round-title">Cuartos</h4>
                <div className="knockout-matches-col">
                  <Spines count={liveKnockout.leftQuarterfinals.length} side="right" />
                  {liveKnockout.leftQuarterfinals.map((match) => (
                    <MatchBox key={match.id} match={match} lineClassName="line-in-left line-out-right" />
                  ))}
                </div>
              </div>
              <div className="knockout-round">
                <h4 className="knockout-round-title">Semifinal</h4>
                <div className="knockout-matches-col">
                  {liveKnockout.leftSemifinals.map((match) => (
                    <MatchBox key={match.id} match={match} lineClassName="line-in-left line-out-right" />
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
                  <MatchBox match={liveKnockout.final} lineClassName="line-in-left line-in-right" />
                </div>
                <div className="knockout-final-group">
                  <h4 className="knockout-round-title knockout-bronze knockout-center-title">Tercer Puesto</h4>
                  <MatchBox match={liveKnockout.thirdPlace} lineClassName="line-in-left line-in-right" />
                </div>
              </div>
            </div>
            <div className="knockout-side">
              <div className="knockout-round">
                <h4 className="knockout-round-title">Semifinal</h4>
                <div className="knockout-matches-col">
                  {liveKnockout.rightSemifinals.map((match) => (
                    <MatchBox key={match.id} match={match} lineClassName="line-in-right line-out-left" />
                  ))}
                </div>
              </div>
              <div className="knockout-round">
                <h4 className="knockout-round-title">Cuartos</h4>
                <div className="knockout-matches-col">
                  <Spines count={liveKnockout.rightQuarterfinals.length} side="left" />
                  {liveKnockout.rightQuarterfinals.map((match) => (
                    <MatchBox key={match.id} match={match} lineClassName="line-in-right line-out-left" />
                  ))}
                </div>
              </div>
              <div className="knockout-round">
                <h4 className="knockout-round-title">Octavos</h4>
                <div className="knockout-matches-col">
                  <Spines count={liveKnockout.rightRoundOf16.length} side="left" />
                  {liveKnockout.rightRoundOf16.map((match) => (
                    <MatchBox key={match.id} match={match} lineClassName="line-in-right line-out-left" />
                  ))}
                </div>
              </div>
              <div className="knockout-round">
                <h4 className="knockout-round-title">16avos</h4>
                <div className="knockout-matches-col">
                  <Spines count={liveKnockout.rightRoundOf32.length} side="left" />
                  {liveKnockout.rightRoundOf32.map((match) => (
                    <MatchBox key={match.id} match={match} lineClassName="line-out-left" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default KnockoutModal