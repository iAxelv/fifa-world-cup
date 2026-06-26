export interface KnockoutTeam {
	id: string
	name: string
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

const tbdTeam: KnockoutTeam = {
	id: 'tbd',
	name: 'TBD'
}

const createMatch = (id: string, date: string): KnockoutMatch => ({
	id,
	date,
	home: tbdTeam,
	away: tbdTeam,
	homeGoals: null,
	awayGoals: null
})

export const knockoutData: KnockoutData = {
	leftRoundOf32: [
		createMatch('L32-1', '2026-06-30T18:00:00Z'),
		createMatch('L32-2', '2026-06-30T21:00:00Z'),
		createMatch('L32-3', '2026-07-01T18:00:00Z'),
		createMatch('L32-4', '2026-07-01T21:00:00Z'),
		createMatch('L32-5', '2026-07-02T18:00:00Z'),
		createMatch('L32-6', '2026-07-02T21:00:00Z'),
		createMatch('L32-7', '2026-07-03T18:00:00Z'),
		createMatch('L32-8', '2026-07-03T21:00:00Z')
	],
	leftRoundOf16: [
		createMatch('L16-1', '2026-07-05T18:00:00Z'),
		createMatch('L16-2', '2026-07-05T21:00:00Z'),
		createMatch('L16-3', '2026-07-06T18:00:00Z'),
		createMatch('L16-4', '2026-07-06T21:00:00Z')
	],
	leftQuarterfinals: [
		createMatch('LQF-1', '2026-07-08T19:00:00Z'),
		createMatch('LQF-2', '2026-07-09T19:00:00Z')
	],
	leftSemifinals: [
		createMatch('LSF-1', '2026-07-12T20:00:00Z')
	],
	rightSemifinals: [
		createMatch('RSF-1', '2026-07-13T20:00:00Z')
	],
	rightQuarterfinals: [
		createMatch('RQF-1', '2026-07-10T19:00:00Z'),
		createMatch('RQF-2', '2026-07-11T19:00:00Z')
	],
	rightRoundOf16: [
		createMatch('R16-1', '2026-07-07T18:00:00Z'),
		createMatch('R16-2', '2026-07-07T21:00:00Z'),
		createMatch('R16-3', '2026-07-08T18:00:00Z'),
		createMatch('R16-4', '2026-07-08T21:00:00Z')
	],
	rightRoundOf32: [
		createMatch('R32-1', '2026-07-03T00:00:00Z'),
		createMatch('R32-2', '2026-07-03T03:00:00Z'),
		createMatch('R32-3', '2026-07-04T00:00:00Z'),
		createMatch('R32-4', '2026-07-04T03:00:00Z'),
		createMatch('R32-5', '2026-07-05T00:00:00Z'),
		createMatch('R32-6', '2026-07-05T03:00:00Z'),
		createMatch('R32-7', '2026-07-06T00:00:00Z'),
		createMatch('R32-8', '2026-07-06T03:00:00Z')
	],
	final: createMatch('FINAL', '2026-07-19T19:00:00Z'),
	thirdPlace: createMatch('THIRD', '2026-07-18T19:00:00Z')
}
