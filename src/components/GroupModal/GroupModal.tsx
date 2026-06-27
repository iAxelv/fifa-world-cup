import { useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { groupsData as initialGroups, matchesData as initialMatches, type Team, type Match } from '../../data/groups.ts'
import { db } from '../../firebase.ts'
import './GroupModal.css'

const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
const LOCAL_PREDICTIONS_KEY = 'worldcup_local_predictions'

type LocalPredictions = Record<string, { homeGoals: number; awayGoals: number }>
type DraftScores = Record<string, { home: string; away: string }>
type OfficialResults = Record<string, { date?: string; homeGoals: number | null; awayGoals: number | null }>

interface GroupModalProps {
  onClose: () => void
  isAdmin: boolean
  onLogout: () => Promise<void>
  initialGroup?: string
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

const readLocalPredictions = (): LocalPredictions => {
  try {
    const raw = localStorage.getItem(LOCAL_PREDICTIONS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, { homeGoals?: unknown; awayGoals?: unknown }>
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
          awayGoals: Math.floor(values.awayGoals)
        }
      }
      return acc
    }, {} as LocalPredictions)
  } catch {
    return {}
  }
}

const persistLocalPredictions = (predictions: LocalPredictions) => {
  localStorage.setItem(LOCAL_PREDICTIONS_KEY, JSON.stringify(predictions))
}

const parseOptionalGoal = (value: string): number | null => {
  if (value.trim() === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.floor(parsed)
}

const getTeamStateClass = (match: Match, side: 'home' | 'away') => {
  if (match.homeGoals === null || match.awayGoals === null) {
    return 'team-state-pending'
  }

  if (match.homeGoals === match.awayGoals) {
    return 'team-state-draw'
  }

  const isWinner =
    side === 'home'
      ? match.homeGoals > match.awayGoals
      : match.awayGoals > match.homeGoals

  return isWinner ? 'team-state-leading' : 'team-state-losing'
}

const GroupModal = ({ onClose, isAdmin, onLogout, initialGroup }: GroupModalProps) => {
  const [activeGroup, setActiveGroup] = useState(initialGroup ?? 'A')
  const [officialResults, setOfficialResults] = useState<OfficialResults>({})
  const [localPredictions, setLocalPredictions] = useState<LocalPredictions>(() => readLocalPredictions())
  const [draftScores, setDraftScores] = useState<DraftScores>({})

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'worldcup'), (snapshot) => {
      const nextOfficial: OfficialResults = {}
      snapshot.forEach((document) => {
        const data = document.data() as {
          date?: string
          homeGoals?: number | null
          awayGoals?: number | null
        }
        nextOfficial[document.id] = {
          date: typeof data.date === 'string' ? data.date : undefined,
          homeGoals: typeof data.homeGoals === 'number' ? data.homeGoals : null,
          awayGoals: typeof data.awayGoals === 'number' ? data.awayGoals : null
        }
      })
      setOfficialResults(nextOfficial)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const cleaned = { ...localPredictions }
    let changed = false
    Object.entries(officialResults).forEach(([matchId, official]) => {
      if (official.homeGoals !== null && cleaned[matchId]) {
        delete cleaned[matchId]
        changed = true
      }
    })

    if (changed) {
      setLocalPredictions(cleaned)
      persistLocalPredictions(cleaned)
    }
  }, [officialResults, localPredictions])

  const liveMatchesData = useMemo<Record<string, Match[]>>(() => {
    return Object.keys(initialMatches).reduce((acc, groupKey) => {
      acc[groupKey] = initialMatches[groupKey].map((match) => {
        const official = officialResults[match.id]
        const hasOfficial = official?.homeGoals !== null && official?.homeGoals !== undefined
        const local = localPredictions[match.id]
        const homeGoals = hasOfficial ? official?.homeGoals ?? null : (local?.homeGoals ?? null)
        const awayGoals = hasOfficial ? official?.awayGoals ?? null : (local?.awayGoals ?? null)

        return {
          ...match,
          date: official?.date ?? match.date,
          homeGoals,
          awayGoals
        }
      })
      return acc
    }, {} as Record<string, Match[]>)
  }, [officialResults, localPredictions])

  useEffect(() => {
    const nextDrafts: DraftScores = {}
    Object.values(liveMatchesData).forEach((matches) => {
      matches.forEach((match) => {
        nextDrafts[match.id] = {
          home: match.homeGoals === null ? '' : String(match.homeGoals),
          away: match.awayGoals === null ? '' : String(match.awayGoals)
        }
      })
    })
    setDraftScores(nextDrafts)
  }, [liveMatchesData])

  const liveGroupsData = useMemo<Record<string, Team[]>>(() => {
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

  const updateLocalPrediction = (matchId: string, homeGoals: number | null, awayGoals: number | null) => {
    setLocalPredictions((prev) => {
      const next = { ...prev }
      if (homeGoals === null || awayGoals === null) {
        delete next[matchId]
      } else {
        next[matchId] = { homeGoals, awayGoals }
      }
      persistLocalPredictions(next)
      return next
    })
  }

  const updateOfficialResult = async (match: Match, homeGoals: number | null, awayGoals: number | null) => {
    const winner =
      homeGoals === null || awayGoals === null
        ? null
        : homeGoals > awayGoals
          ? match.home.id
          : homeGoals < awayGoals
            ? match.away.id
            : 'draw'

    const pointsObtained =
      homeGoals === null || awayGoals === null
        ? null
        : homeGoals > awayGoals
          ? { [match.home.id]: 3, [match.away.id]: 0 }
          : homeGoals < awayGoals
            ? { [match.home.id]: 0, [match.away.id]: 3 }
            : { [match.home.id]: 1, [match.away.id]: 1 }

    await setDoc(
      doc(db, 'worldcup', match.id),
      {
        date: match.date,
        homeGoals,
        awayGoals,
        winner,
        pointsObtained
      },
      { merge: true }
    )
  }

  const handleScoreChange = (matchId: string, side: 'home' | 'away', value: string) => {
    if (value !== '' && !/^\d+$/.test(value)) {
      return
    }
    setDraftScores((prev) => ({
      ...prev,
      [matchId]: {
        home: prev[matchId]?.home ?? '',
        away: prev[matchId]?.away ?? '',
        [side]: value
      }
    }))
  }

  const handleMatchBlur = async (match: Match) => {
    const draft = draftScores[match.id] || { home: '', away: '' }
    const homeGoals = parseOptionalGoal(draft.home)
    const awayGoals = parseOptionalGoal(draft.away)
    const official = officialResults[match.id]

    if (!isAdmin && official?.homeGoals !== null && official?.homeGoals !== undefined) {
      return
    }

    if (homeGoals === null && awayGoals === null) {
      if (isAdmin) {
        await updateOfficialResult(match, null, null)
      } else {
        updateLocalPrediction(match.id, null, null)
      }
      return
    }

    if (homeGoals === null || awayGoals === null) {
      return
    }

    if (isAdmin) {
      await updateOfficialResult(match, homeGoals, awayGoals)
      return
    }

    updateLocalPrediction(match.id, homeGoals, awayGoals)
  }

  const getThirdPlaceTeams = () => {
    const thirds: Array<Team & { originalGroup: string }> = []
    groups.forEach((groupKey) => {
      const teams = sortTeams(liveGroupsData[groupKey] || [], liveMatchesData[groupKey])
      if (teams[2]) {
        thirds.push({ ...teams[2], originalGroup: groupKey })
      }
    })

    return sortTeams(thirds)
  }

  const qualifiedThirdIds = useMemo(() => {
    return new Set(getThirdPlaceTeams().slice(0, 8).map((team) => team.id))
  }, [liveGroupsData, liveMatchesData])

  const currentGroupTeams: Array<Team & { originalGroup?: string }> = activeGroup === '3ROS' 
    ? getThirdPlaceTeams() 
    : sortTeams(liveGroupsData[activeGroup] || [], liveMatchesData[activeGroup])

  const currentMatches = activeGroup === '3ROS' ? [] : (liveMatchesData[activeGroup] || [])

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

  const getStatusClass = (position: number, team: Team & { originalGroup?: string }) => {
    if (activeGroup === '3ROS') {
      if (position <= 8) return 'status-direct'
      return 'status-eliminated'
    }

    if (position === 1 || position === 2) {
      return 'status-direct'
    }
    if (position === 3) {
      return qualifiedThirdIds.has(team.id) ? 'status-third-qualified' : 'status-eliminated'
    }
    return 'status-eliminated'
  }

  const getMatchStatus = (match: Match) => {
    const official = officialResults[match.id]
    const hasOfficial = official?.homeGoals !== null && official?.homeGoals !== undefined
    const hasLocalPrediction = localPredictions[match.id] !== undefined

    if (hasOfficial) {
      return {
        label: 'Resultado oficial',
        className: 'match-status-official'
      }
    }

    if (hasLocalPrediction) {
      return {
        label: 'Prediccion local',
        className: 'match-status-local'
      }
    }

    return {
      label: isAdmin ? 'Carga pendiente' : 'Sin pronostico',
      className: 'match-status-pending'
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </button>

        {isAdmin && (
          <button className="admin-logout-button" onClick={onLogout}>
            Cerrar sesion
          </button>
        )}

        <h2 className="modal-title">
          {activeGroup === '3ROS' ? 'MEJORES 3ROS' : `GRUPO ${activeGroup}`}
        </h2>

        <div className="group-pagination">
          {groups.map((group) => (
            <button
              key={group}
              className={`pagination-button ${activeGroup === group ? 'active' : ''}`}
              onClick={() => setActiveGroup(group)}
            >
              {group}
            </button>
          ))}
          <button
            className={`pagination-button special-button ${activeGroup === '3ROS' ? 'active' : ''}`}
            onClick={() => setActiveGroup('3ROS')}
          >
            Mejores 3ros
          </button>
        </div>

        <div className="group-data-container">
          <table className="standings-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th className="team-col-header">Selección</th>
                <th>PJ</th>
                <th>G</th>
                <th>E</th>
                <th>P</th>
                <th>GF</th>
                <th>GC</th>
                <th>DG</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {currentGroupTeams.map((team, index) => {
                const position = index + 1
                return (
                  <tr key={team.id} className={getStatusClass(position, team)}>
                    <td className="pos-col">{position}</td>
                    <td className="team-col">
                      <img src={`https://flagcdn.com/${team.id}.svg`} alt={team.name} className="team-flag" />
                      <span>{team.name} {activeGroup === '3ROS' && `(${team.originalGroup})`}</span>
                    </td>
                    <td>{team.pj}</td>
                    <td>{team.g}</td>
                    <td>{team.e}</td>
                    <td>{team.p}</td>
                    <td>{team.gf}</td>
                    <td>{team.gc}</td>
                    <td>{team.gf - team.gc}</td>
                    <td className="pts-col">{team.pts}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {activeGroup !== '3ROS' && (
            <div className="matches-section">
              <h3 className="matches-title">Partidos del Grupo</h3>
              <div className="matches-list">
                {currentMatches.map((match) => {
                  const matchStatus = getMatchStatus(match)
                  return (
                    <div key={match.id} className={`match-card ${matchStatus.className}`}>
                      <div className="match-card-top">
                        <span className={`match-status-badge ${matchStatus.className}`}>{matchStatus.label}</span>
                        <span className="match-datetime">{formatDateTime(match.date)}</span>
                      </div>

                      <div className="match-card-main">
                        <div className={`match-team ${getTeamStateClass(match, 'home')}`}>
                          <img src={`https://flagcdn.com/${match.home.id}.svg`} alt={match.home.name} className="match-team-flag" />
                          <span className="match-team-name">{match.home.name}</span>
                        </div>

                        <div className="match-score">
                          <input
                            type="number"
                            min="0"
                            className="score-box"
                            value={draftScores[match.id]?.home ?? ''}
                            onChange={(e) => handleScoreChange(match.id, 'home', e.target.value)}
                            onBlur={() => void handleMatchBlur(match)}
                            disabled={!isAdmin && officialResults[match.id]?.homeGoals !== null && officialResults[match.id]?.homeGoals !== undefined}
                            placeholder="-"
                          />
                        </div>

                        <div className="match-score-separator">vs</div>

                        <div className="match-score">
                          <input
                            type="number"
                            min="0"
                            className="score-box"
                            value={draftScores[match.id]?.away ?? ''}
                            onChange={(e) => handleScoreChange(match.id, 'away', e.target.value)}
                            onBlur={() => void handleMatchBlur(match)}
                            disabled={!isAdmin && officialResults[match.id]?.homeGoals !== null && officialResults[match.id]?.homeGoals !== undefined}
                            placeholder="-"
                          />
                        </div>

                        <div className={`match-team match-team-right ${getTeamStateClass(match, 'away')}`}>
                          <img src={`https://flagcdn.com/${match.away.id}.svg`} alt={match.away.name} className="match-team-flag" />
                          <span className="match-team-name">{match.away.name}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default GroupModal