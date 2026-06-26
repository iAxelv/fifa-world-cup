import { useCallback, useState, useRef } from 'react'
import type { WheelEvent, MouseEvent } from 'react'
import { knockoutData, type KnockoutMatch } from '../../data/knockout.ts'
import './KnockoutModal.css'

interface KnockoutModalProps {
  onClose: () => void
}

const MIN_SCALE = 0.7
const MAX_SCALE = 2.8

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

interface MatchBoxProps {
  match: KnockoutMatch
  lineClassName?: string
}

const MatchBox = ({ match, lineClassName = '' }: MatchBoxProps) => (
  <div className={`knockout-match ${lineClassName}`}>
    <div className="knockout-match-datetime">{formatDateTime(match.date)}</div>
    <div className="knockout-team">
      <span className="knockout-team-name">{match.home.name}</span>
      <span className="knockout-team-score">{match.homeGoals ?? '-'}</span>
    </div>
    <div className="knockout-team">
      <span className="knockout-team-name">{match.away.name}</span>
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
  const viewportRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const dragStart = useRef({ x: 0, y: 0 })

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
                  <Spines count={knockoutData.leftRoundOf32.length} side="right" />
                  {knockoutData.leftRoundOf32.map((match) => (
                    <MatchBox key={match.id} match={match} lineClassName="line-out-right" />
                  ))}
                </div>
              </div>

              <div className="knockout-round">
                <h4 className="knockout-round-title">Octavos</h4>
                <div className="knockout-matches-col">
                  <Spines count={knockoutData.leftRoundOf16.length} side="right" />
                  {knockoutData.leftRoundOf16.map((match) => (
                    <MatchBox key={match.id} match={match} lineClassName="line-in-left line-out-right" />
                  ))}
                </div>
              </div>

              <div className="knockout-round">
                <h4 className="knockout-round-title">Cuartos</h4>
                <div className="knockout-matches-col">
                  <Spines count={knockoutData.leftQuarterfinals.length} side="right" />
                  {knockoutData.leftQuarterfinals.map((match) => (
                    <MatchBox key={match.id} match={match} lineClassName="line-in-left line-out-right" />
                  ))}
                </div>
              </div>

              <div className="knockout-round">
                <h4 className="knockout-round-title">Semifinal</h4>
                <div className="knockout-matches-col">
                  {knockoutData.leftSemifinals.map((match) => (
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
                  <MatchBox match={knockoutData.final} lineClassName="line-in-left line-in-right" />
                </div>

                <div className="knockout-final-group">
                  <h4 className="knockout-round-title knockout-bronze knockout-center-title">Tercer Puesto</h4>
                  <MatchBox match={knockoutData.thirdPlace} lineClassName="line-in-left line-in-right" />
                </div>
              </div>
            </div>

            <div className="knockout-side">
              <div className="knockout-round">
                <h4 className="knockout-round-title">Semifinal</h4>
                <div className="knockout-matches-col">
                  {knockoutData.rightSemifinals.map((match) => (
                    <MatchBox key={match.id} match={match} lineClassName="line-in-right line-out-left" />
                  ))}
                </div>
              </div>

              <div className="knockout-round">
                <h4 className="knockout-round-title">Cuartos</h4>
                <div className="knockout-matches-col">
                  <Spines count={knockoutData.rightQuarterfinals.length} side="left" />
                  {knockoutData.rightQuarterfinals.map((match) => (
                    <MatchBox key={match.id} match={match} lineClassName="line-in-right line-out-left" />
                  ))}
                </div>
              </div>

              <div className="knockout-round">
                <h4 className="knockout-round-title">Octavos</h4>
                <div className="knockout-matches-col">
                  <Spines count={knockoutData.rightRoundOf16.length} side="left" />
                  {knockoutData.rightRoundOf16.map((match) => (
                    <MatchBox key={match.id} match={match} lineClassName="line-in-right line-out-left" />
                  ))}
                </div>
              </div>

              <div className="knockout-round">
                <h4 className="knockout-round-title">16avos</h4>
                <div className="knockout-matches-col">
                  <Spines count={knockoutData.rightRoundOf32.length} side="left" />
                  {knockoutData.rightRoundOf32.map((match) => (
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