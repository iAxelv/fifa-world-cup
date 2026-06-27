import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { matchesData, type Match } from '../../data/groups.ts'
import { db } from '../../firebase.ts'
import './Menu.css'

const GroupModal = lazy(() => import('../GroupModal/GroupModal.tsx'))
const KnockoutModal = lazy(() => import('../KnockoutModal/KnockoutModal.tsx'))

interface MenuProps {
  isAdmin: boolean
  onLogout: () => Promise<void>
}

type OfficialResults = Record<string, { date?: string; homeGoals: number | null; awayGoals: number | null }>

type MatchWithGroup = Match & {
  group: string
}

const formatLocalDateTime = (dateString: string) => {
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

const getTeamStateClass = (match: MatchWithGroup, side: 'home' | 'away') => {
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

const GroupIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="7" r="3"></circle>
    <circle cx="6" cy="17" r="3"></circle>
    <circle cx="18" cy="17" r="3"></circle>
    <path d="M9.5 9 7.8 14"></path>
    <path d="M14.5 9 16.2 14"></path>
    <path d="M9 17h6"></path>
  </svg>
)

const KnockoutIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M4 5h6v4H4z"></path>
    <path d="M14 5h6v4h-6z"></path>
    <path d="M9 13h6v4H9z"></path>
    <path d="M7 9v2h10V9"></path>
  </svg>
)

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="9"></circle>
    <path d="M12 7v6l4 2"></path>
  </svg>
)

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="2"></rect>
    <path d="M16 3v4"></path>
    <path d="M8 3v4"></path>
    <path d="M3 10h18"></path>
    <path d="M8 14h3"></path>
  </svg>
)

const Menu = ({ isAdmin, onLogout }: MenuProps) => {
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
  const [isKnockoutModalOpen, setIsKnockoutModalOpen] = useState(false)
  const [initialGroup, setInitialGroup] = useState('A')
  const [officialResults, setOfficialResults] = useState<OfficialResults>({})

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

  const todaysMatches = useMemo<MatchWithGroup[]>(() => {
    const now = new Date()

    return Object.entries(matchesData)
      .flatMap(([group, groupMatches]) =>
        groupMatches.map((match) => {
          const official = officialResults[match.id]
          const homeGoals = official?.homeGoals ?? null
          const awayGoals = official?.awayGoals ?? null
          return {
            ...match,
            group,
            date: official?.date ?? match.date,
            homeGoals,
            awayGoals
          }
        })
      )
      .filter((match) => {
        const matchDate = new Date(match.date)
        return (
          matchDate.getFullYear() === now.getFullYear() &&
          matchDate.getMonth() === now.getMonth() &&
          matchDate.getDate() === now.getDate()
        )
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [officialResults])

  const openGroupModal = (group: string) => {
    setInitialGroup(group)
    setIsGroupModalOpen(true)
  }

  return (
    <>
      <div className="menu-container">
        <div className="menu-main-actions">
          <div className="menu-buttons-row">
            <button className="menu-button" onClick={() => openGroupModal('A')}>
              <span className="menu-button-icon"><GroupIcon /></span>
              FASE DE GRUPOS
            </button>
            <button className="menu-button" onClick={() => setIsKnockoutModalOpen(true)}>
              <span className="menu-button-icon"><KnockoutIcon /></span>
              ELIMINATORIAS
            </button>
          </div>

          <div className="today-matches-container">
            <div className="today-matches-floating-icon">
              <CalendarIcon />
            </div>
            <h3 className="today-matches-title">
              PARTIDOS DE HOY
            </h3>
            <div className="today-matches-list">
              {todaysMatches.length > 0 ? (
                todaysMatches.map((match) => (
                  <button
                    key={match.id}
                    className="today-match-card"
                    onClick={() => openGroupModal(match.group)}
                  >
                    <div className="today-match-header">
                      <span className="today-match-group">Grupo {match.group}</span>
                      <span className="today-match-datetime">
                        <span className="today-datetime-icon"><ClockIcon /></span>
                        {formatLocalDateTime(match.date)}
                      </span>
                    </div>
                    <div className="today-match-teams">
                      <span className={`today-match-team ${getTeamStateClass(match, 'home')}`}>
                        <img src={`https://flagcdn.com/${match.home.id}.svg`} alt={match.home.name} className="today-match-flag" width={22} height={14} />
                        <span className="today-match-team-name">{match.home.name}</span>
                      </span>
                      <span className="today-match-score">
                        {match.homeGoals ?? '-'} - {match.awayGoals ?? '-'}
                      </span>
                      <span className={`today-match-team today-match-team-right ${getTeamStateClass(match, 'away')}`}>
                        <img src={`https://flagcdn.com/${match.away.id}.svg`} alt={match.away.name} className="today-match-flag" width={22} height={14} />
                        <span className="today-match-team-name">{match.away.name}</span>
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <p className="today-matches-empty">No hay partidos programados para hoy.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {isGroupModalOpen && (
        <Suspense fallback={null}>
          <GroupModal
            onClose={() => setIsGroupModalOpen(false)}
            isAdmin={isAdmin}
            onLogout={onLogout}
            initialGroup={initialGroup}
          />
        </Suspense>
      )}

      {isKnockoutModalOpen && (
        <Suspense fallback={null}>
          <KnockoutModal
            onClose={() => setIsKnockoutModalOpen(false)}
            isAdmin={isAdmin}
          />
        </Suspense>
      )}
    </>
  )
}

export default Menu