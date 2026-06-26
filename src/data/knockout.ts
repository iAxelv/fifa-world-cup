export interface KnockoutTeam {
  id: string
  name: string
  isPlaceholder?: boolean
}

export interface KnockoutMatch {
  id: string
  date: string
  home: KnockoutTeam
  away: KnockoutTeam
  homeGoals: number | null
  awayGoals: number | null
}

export interface KnockoutData {
  leftRoundOf32: KnockoutMatch[]
  leftRoundOf16: KnockoutMatch[]
  leftQuarterfinals: KnockoutMatch[]
  leftSemifinals: KnockoutMatch[]
  rightSemifinals: KnockoutMatch[]
  rightQuarterfinals: KnockoutMatch[]
  rightRoundOf16: KnockoutMatch[]
  rightRoundOf32: KnockoutMatch[]
  final: KnockoutMatch
  thirdPlace: KnockoutMatch
}

const createMatch = (id: string, date: string, homeName: string, awayName: string): KnockoutMatch => ({
  id,
  date,
  home: { id: 'tbd', name: homeName, isPlaceholder: true },
  away: { id: 'tbd', name: awayName, isPlaceholder: true },
  homeGoals: null,
  awayGoals: null
})

export const knockoutData: KnockoutData = {
  leftRoundOf32: [
    createMatch('L32-1', '2026-06-29T20:30:00Z', '1E', '3-ABCDF'),
    createMatch('L32-2', '2026-06-30T21:00:00Z', '1I', '3-CDFGH'),
    createMatch('L32-3', '2026-06-28T19:00:00Z', '2A', '2B'),
    createMatch('L32-4', '2026-06-30T01:00:00Z', '1F', '2C'),
    createMatch('L32-5', '2026-07-02T23:00:00Z', '2K', '2L'),
    createMatch('L32-6', '2026-07-02T19:00:00Z', '1H', '2J'),
    createMatch('L32-7', '2026-07-02T00:00:00Z', '1D', '3-BEFIJ'),
    createMatch('L32-8', '2026-07-01T20:00:00Z', '1G', '3-AEHIJ')
  ],
  leftRoundOf16: [
    createMatch('L16-1', '2026-07-04T21:00:00Z', 'Ganador L32-1', 'Ganador L32-2'),
    createMatch('L16-2', '2026-07-04T17:00:00Z', 'Ganador L32-3', 'Ganador L32-4'),
    createMatch('L16-3', '2026-07-06T19:00:00Z', 'Ganador L32-5', 'Ganador L32-6'),
    createMatch('L16-4', '2026-07-07T00:00:00Z', 'Ganador L32-7', 'Ganador L32-8')
  ],
  leftQuarterfinals: [
    createMatch('LQF-1', '2026-07-09T20:00:00Z', 'Ganador L16-1', 'Ganador L16-2'),
    createMatch('LQF-2', '2026-07-10T19:00:00Z', 'Ganador L16-3', 'Ganador L16-4')
  ],
  leftSemifinals: [
    createMatch('LSF-1', '2026-07-14T19:00:00Z', 'Ganador LQF-1', 'Ganador LQF-2')
  ],
  rightSemifinals: [
    createMatch('RSF-1', '2026-07-15T19:00:00Z', 'Ganador RQF-1', 'Ganador RQF-2')
  ],
  rightQuarterfinals: [
    createMatch('RQF-1', '2026-07-11T21:00:00Z', 'Ganador R16-1', 'Ganador R16-2'),
    createMatch('RQF-2', '2026-07-12T01:00:00Z', 'Ganador R16-3', 'Ganador R16-4')
  ],
  rightRoundOf16: [
    createMatch('R16-1', '2026-07-05T20:00:00Z', 'Ganador R32-1', 'Ganador R32-2'),
    createMatch('R16-2', '2026-07-06T00:00:00Z', 'Ganador R32-3', 'Ganador R32-4'),
    createMatch('R16-3', '2026-07-07T16:00:00Z', 'Ganador R32-5', 'Ganador R32-6'),
    createMatch('R16-4', '2026-07-07T20:00:00Z', 'Ganador R32-7', 'Ganador R32-8')
  ],
  rightRoundOf32: [
    createMatch('R32-1', '2026-06-29T17:00:00Z', '1C', '2F'),
    createMatch('R32-2', '2026-06-30T17:00:00Z', '2E', '2I'),
    createMatch('R32-3', '2026-06-30T01:00:00Z', '1A', '3-CEFHI'),
    createMatch('R32-4', '2026-07-01T16:00:00Z', '1L', '3-EHIJK'),
    createMatch('R32-5', '2026-07-03T22:00:00Z', '1J', '2H'),
    createMatch('R32-6', '2026-07-03T18:00:00Z', '2D', '2G'),
    createMatch('R32-7', '2026-07-03T03:00:00Z', '1B', '3-EFGIJ'),
    createMatch('R32-8', '2026-07-04T01:30:00Z', '1K', '3-DEIJL')
  ],
  final: createMatch('FINAL', '2026-07-19T19:00:00Z', 'Ganador LSF-1', 'Ganador RSF-1'),
  thirdPlace: createMatch('THIRD', '2026-07-18T21:00:00Z', 'Perdedor LSF-1', 'Perdedor RSF-1')
}