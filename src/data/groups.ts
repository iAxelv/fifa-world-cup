export interface Team {
  id: string
  name: string
  pj: number
  g: number
  e: number
  p: number
  gf: number
  gc: number
  pts: number
}

export interface Match {
  id: string
  home: Team
  away: Team
  date: string
  homeGoals: number | null
  awayGoals: number | null
}

export const groupsData: Record<string, Team[]> = {
  A: [
    { id: 'mx', name: 'México', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'za', name: 'Sudáfrica', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'kr', name: 'Corea del Sur', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'cz', name: 'Chequia', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }
  ],
  B: [
    { id: 'ca', name: 'Canadá', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'ba', name: 'Bosnia y Herzegovina', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'qa', name: 'Qatar', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'ch', name: 'Suiza', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }
  ],
  C: [
    { id: 'br', name: 'Brasil', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'ma', name: 'Marruecos', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'ht', name: 'Haití', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'gb-sct', name: 'Escocia', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }
  ],
  D: [
    { id: 'us', name: 'Estados Unidos', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'py', name: 'Paraguay', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'au', name: 'Australia', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'tr', name: 'Turquía', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }
  ],
  E: [
    { id: 'de', name: 'Alemania', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'cw', name: 'Curazao', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'ci', name: 'Costa de Marfil', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'ec', name: 'Ecuador', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }
  ],
  F: [
    { id: 'nl', name: 'Países Bajos', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'jp', name: 'Japón', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'se', name: 'Suecia', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'tn', name: 'Túnez', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }
  ],
  G: [
    { id: 'be', name: 'Bélgica', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'eg', name: 'Egipto', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'ir', name: 'Irán', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'nz', name: 'Nueva Zelanda', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }
  ],
  H: [
    { id: 'es', name: 'España', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'cv', name: 'Cabo Verde', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'sa', name: 'Arabia Saudita', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'uy', name: 'Uruguay', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }
  ],
  I: [
    { id: 'fr', name: 'Francia', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'sn', name: 'Senegal', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'iq', name: 'Irak', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'no', name: 'Noruega', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }
  ],
  J: [
    { id: 'ar', name: 'Argentina', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'dz', name: 'Argelia', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'at', name: 'Austria', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'jo', name: 'Jordania', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }
  ],
  K: [
    { id: 'pt', name: 'Portugal', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'cd', name: 'RD del Congo', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'uz', name: 'Uzbekistán', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'co', name: 'Colombia', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }
  ],
  L: [
    { id: 'gb-eng', name: 'Inglaterra', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'hr', name: 'Croacia', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'gh', name: 'Ghana', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
    { id: 'pa', name: 'Panamá', pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }
  ]
}

const rawDates: Record<string, string[]> = {
  A: [
    '2026-06-11T19:00:00Z',
    '2026-06-12T02:00:00Z',
    '2026-06-18T16:00:00Z',
    '2026-06-19T01:00:00Z',
    '2026-06-25T01:00:00Z',
    '2026-06-25T01:00:00Z'
  ],
  B: [
    '2026-06-12T19:00:00Z',
    '2026-06-13T19:00:00Z',
    '2026-06-18T19:00:00Z',
    '2026-06-18T19:00:00Z',
    '2026-06-24T19:00:00Z',
    '2026-06-24T19:00:00Z'
  ],
  C: [
    '2026-06-13T22:00:00Z',
    '2026-06-14T01:00:00Z',
    '2026-06-20T01:00:00Z',
    '2026-06-19T22:00:00Z',
    '2026-06-24T22:00:00Z',
    '2026-06-24T22:00:00Z'
  ],
  D: [
    '2026-06-13T01:00:00Z',
    '2026-06-13T04:00:00Z',
    '2026-06-19T04:00:00Z',
    '2026-06-16T16:00:00Z',
    '2026-06-26T02:00:00Z',
    '2026-06-26T02:00:00Z'
  ],
  E: [
    '2026-06-14T17:00:00Z',
    '2026-06-14T23:00:00Z',
    '2026-06-20T20:00:00Z',
    '2026-06-21T00:00:00Z',
    '2026-06-25T20:00:00Z',
    '2026-06-25T20:00:00Z'
  ],
  F: [
    '2026-06-14T20:00:00Z',
    '2026-06-15T02:00:00Z',
    '2026-06-20T17:00:00Z',
    '2026-06-21T04:00:00Z',
    '2026-06-25T23:00:00Z',
    '2026-06-25T23:00:00Z'
  ],
  G: [
    '2026-06-15T19:00:00Z',
    '2026-06-16T01:00:00Z',
    '2026-06-21T19:00:00Z',
    '2026-06-22T01:00:00Z',
    '2026-06-27T03:00:00Z',
    '2026-06-27T03:00:00Z'
  ],
  H: [
    '2026-06-15T16:00:00Z',
    '2026-06-15T22:00:00Z',
    '2026-06-21T16:00:00Z',
    '2026-06-21T22:00:00Z',
    '2026-06-27T00:00:00Z',
    '2026-06-27T00:00:00Z'
  ],
  I: [
    '2026-06-16T19:00:00Z',
    '2026-06-16T22:00:00Z',
    '2026-06-22T21:00:00Z',
    '2026-06-23T00:00:00Z',
    '2026-06-26T19:00:00Z',
    '2026-06-26T19:00:00Z'
  ],
  J: [
    '2026-06-17T01:00:00Z',
    '2026-06-17T04:00:00Z',
    '2026-06-22T17:00:00Z',
    '2026-06-23T03:00:00Z',
    '2026-06-28T02:00:00Z',
    '2026-06-28T02:00:00Z'
  ],
  K: [
    '2026-06-17T17:00:00Z',
    '2026-06-18T02:00:00Z',
    '2026-06-23T17:00:00Z',
    '2026-06-24T02:00:00Z',
    '2026-06-27T23:30:00Z',
    '2026-06-27T23:30:00Z'
  ],
  L: [
    '2026-06-17T20:00:00Z',
    '2026-06-17T23:00:00Z',
    '2026-06-23T20:00:00Z',
    '2026-06-23T23:00:00Z',
    '2026-06-27T21:00:00Z',
    '2026-06-27T21:00:00Z'
  ]
}

export const matchesData: Record<string, Match[]> = Object.keys(groupsData).reduce((acc, groupKey) => {
  const teams = groupsData[groupKey]
  const dates = rawDates[groupKey]
  const buildId = (homeId: string, awayId: string) => `${groupKey}-${homeId}${awayId}`

  acc[groupKey] = [
    { id: buildId(teams[0].id, teams[1].id), home: teams[0], away: teams[1], date: dates[0], homeGoals: null, awayGoals: null },
    { id: buildId(teams[2].id, teams[3].id), home: teams[2], away: teams[3], date: dates[1], homeGoals: null, awayGoals: null },
    { id: buildId(teams[0].id, teams[2].id), home: teams[0], away: teams[2], date: dates[2], homeGoals: null, awayGoals: null },
    { id: buildId(teams[3].id, teams[1].id), home: teams[3], away: teams[1], date: dates[3], homeGoals: null, awayGoals: null },
    { id: buildId(teams[3].id, teams[0].id), home: teams[3], away: teams[0], date: dates[4], homeGoals: null, awayGoals: null },
    { id: buildId(teams[1].id, teams[2].id), home: teams[1], away: teams[2], date: dates[5], homeGoals: null, awayGoals: null }
  ]
  
  return acc
}, {} as Record<string, Match[]>)