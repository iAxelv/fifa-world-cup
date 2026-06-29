import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { groupsData as initialGroups, matchesData as initialMatches, type Team, type Match } from '../../data/groups.ts'
import { knockoutData, type KnockoutMatch, type KnockoutTeam } from '../../data/knockout.ts'
import { db } from '../../firebase.ts'
import './Menu.css'

const GroupModal = lazy(() => import('../GroupModal/GroupModal.tsx'))
const KnockoutModal = lazy(() => import('../KnockoutModal/KnockoutModal.tsx'))

interface MenuProps {
  isAdmin: boolean
  onLogout: () => Promise<void>
}

type MatchResult = {
  homeGoals: number
  awayGoals: number
  homePenalties?: number | null
  awayPenalties?: number | null
}

type OfficialResults = Record<string, {
  date?: string
  homeGoals: number | null
  awayGoals: number | null
  homePenalties?: number | null
  awayPenalties?: number | null
}>

type TodayGroupMatch = Match & {
  kind: 'group'
  stageLabel: string
  group: string
}

type TodayKnockoutMatch = KnockoutMatch & {
  kind: 'knockout'
  stageLabel: string
}

type TodayMatch = TodayGroupMatch | TodayKnockoutMatch

type ThirdWinnerSlot = '1A' | '1B' | '1D' | '1E' | '1G' | '1I' | '1K' | '1L'
type ThirdPlayoffSlot = '3-CEFHI' | '3-EFGIJ' | '3-BEFIJ' | '3-ABCDF' | '3-AEHIJ' | '3-CDFGH' | '3-DEIJL' | '3-EHIJK'

const THIRD_WINNER_COLUMNS: ThirdWinnerSlot[] = ['1A', '1B', '1D', '1E', '1G', '1I', '1K', '1L']
const THIRD_PLAYOFF_SLOT_BY_WINNER: Record<ThirdWinnerSlot, ThirdPlayoffSlot> = {
  '1A': '3-CEFHI',
  '1B': '3-EFGIJ',
  '1D': '3-BEFIJ',
  '1E': '3-ABCDF',
  '1G': '3-AEHIJ',
  '1I': '3-CDFGH',
  '1K': '3-DEIJL',
  '1L': '3-EHIJK'
}

const FIFA_THIRD_PLACE_MATRIX: Record<string, string> = {
  'EFGHIJKL': 'EJIFHGLK',
  'DFGHIJKL': 'HGIDJFLK',
  'DEGHIJKL': 'EJIDHGLK',
  'DEFHIJKL': 'EJIDHFLK',
  'DEFGIJKL': 'EGIDJFLK',
  'DEFGHJKL': 'EGJDHFLK',
  'DEFGHIKL': 'EGIDHFLK',
  'DEFGHIJL': 'EGJDHFLI',
  'DEFGHIJK': 'EGJDHFIK',
  'CFGHIJKL': 'HGICJFLK',
  'CEGHIJKL': 'EJICHGLK',
  'CEFHIJKL': 'EJICHFLK',
  'CEFGIJKL': 'EGICJFLK',
  'CEFGHJKL': 'EGJCHFLK',
  'CEFGHIKL': 'EGICHFLK',
  'CEFGHIJL': 'EGJCHFLI',
  'CEFGHIJK': 'EGJCHFIK',
  'CDGHIJKL': 'HGICJDLK',
  'CDFHIJKL': 'CJIDHFLK',
  'CDFGIJKL': 'CGIDJFLK',
  'CDFGHJKL': 'CGJDHFLK',
  'CDFGHIKL': 'CGIDHFLK',
  'CDFGHIJL': 'CGJDHFLI',
  'CDFGHIJK': 'CGJDHFIK',
  'CDEHIJKL': 'EJICHDLK',
  'CDEGIJKL': 'EGICJDLK',
  'CDEGHJKL': 'EGJCHDLK',
  'CDEGHIKL': 'EGICHDLK',
  'CDEGHIJL': 'EGJCHDLI',
  'CDEGHIJK': 'EGJCHDIK',
  'CDEFIJKL': 'CJEDIFLK',
  'CDEFHJKL': 'CJEDHFLK',
  'CDEFHIKL': 'CEIDHFLK',
  'CDEFHIJL': 'CJEDHFLI',
  'CDEFHIJK': 'CJEDHFIK',
  'CDEFGJKL': 'CGEDJFLK',
  'CDEFGIKL': 'CGEDIFLK',
  'CDEFGIJL': 'CGEDJFLI',
  'CDEFGIJK': 'CGEDJFIK',
  'CDEFGHKL': 'CGEDHFLK',
  'CDEFGHJL': 'CGJDHFLE',
  'CDEFGHJK': 'CGJDHFEK',
  'CDEFGHIL': 'CGEDHFLI',
  'CDEFGHIK': 'CGEDHFIK',
  'CDEFGHIJ': 'CGJDHFEI',
  'BFGHIJKL': 'HJBFIGLK',
  'BEGHIJKL': 'EJIBHGLK',
  'BEFHIJKL': 'EJBFIHLK',
  'BEFGIJKL': 'EJBFIGLK',
  'BEFGHJKL': 'EJBFHGLK',
  'BEFGHIKL': 'EGBFIHLK',
  'BEFGHIJL': 'EJBFHGLI',
  'BEFGHIJK': 'EJBFHGIK',
  'BDGHIJKL': 'HJBDIGLK',
  'BDFHIJKL': 'HJBDIFLK',
  'BDFGIJKL': 'IGBDJFLK',
  'BDFGHJKL': 'HGBDJFLK',
  'BDFGHIKL': 'HGBDIFLK',
  'BDFGHIJL': 'HGBDJFLI',
  'BDFGHIJK': 'HGBDJFIK',
  'BDEHIJKL': 'EJBDIHLK',
  'BDEGIJKL': 'EJBDIGLK',
  'BDEGHJKL': 'EJBDHGLK',
  'BDEGHIKL': 'EGBDIHLK',
  'BDEGHIJL': 'EJBDHGLI',
  'BDEGHIJK': 'EJBDHGIK',
  'BDEFIJKL': 'EJBDIFLK',
  'BDEFHJKL': 'EJBDHFLK',
  'BDEFHIKL': 'EIBDHFLK',
  'BDEFHIJL': 'EJBDHFLI',
  'BDEFHIJK': 'EJBDHFIK',
  'BDEFGJKL': 'EGBDJFLK',
  'BDEFGIKL': 'EGBDIFLK',
  'BDEFGIJL': 'EGBDJFLI',
  'BDEFGIJK': 'EGBDJFIK',
  'BDEFGHKL': 'EGBDHFLK',
  'BDEFGHJL': 'HGBDJFLE',
  'BDEFGHJK': 'HGBDJFEK',
  'BDEFGHIL': 'EGBDHFLI',
  'BDEFGHIK': 'EGBDHFIK',
  'BDEFGHIJ': 'HGBDJFEI',
  'BCGHIJKL': 'HJBCIGLK',
  'BCFHIJKL': 'HJBCIFLK',
  'BCFGIJKL': 'IGBCJFLK',
  'BCFGHJKL': 'HGBCJFLK',
  'BCFGHIKL': 'HGBCIFLK',
  'BCFGHIJL': 'HGBCJFLI',
  'BCFGHIJK': 'HGBCJFIK',
  'BCEHIJKL': 'EJBCIHLK',
  'BCEGIJKL': 'EJBCIGLK',
  'BCEGHJKL': 'EJBCHGLK',
  'BCEGHIKL': 'EGBCIHLK',
  'BCEGHIJL': 'EJBCHGLI',
  'BCEGHIJK': 'EJBCHGIK',
  'BCEFIJKL': 'EJBCIFLK',
  'BCEFHJKL': 'EJBCHFLK',
  'BCEFHIKL': 'EIBCHFLK',
  'BCEFHIJL': 'EJBCHFLI',
  'BCEFHIJK': 'EJBCHFIK',
  'BCEFGJKL': 'EGBCJFLK',
  'BCEFGIKL': 'EGBCIFLK',
  'BCEFGIJL': 'EGBCJFLI',
  'BCEFGIJK': 'EGBCJFIK',
  'BCEFGHKL': 'EGBCHFLK',
  'BCEFGHJL': 'HGBCJFLE',
  'BCEFGHJK': 'HGBCJFEK',
  'BCEFGHIL': 'EGBCHFLI',
  'BCEFGHIK': 'EGBCHFIK',
  'BCEFGHIJ': 'HGBCJFEI',
  'BCDHIJKL': 'HJBCIDLK',
  'BCDGIJKL': 'IGBCJDLK',
  'BCDGHJKL': 'HGBCJDLK',
  'BCDGHIKL': 'HGBCIDLK',
  'BCDGHIJL': 'HGBCJDLI',
  'BCDGHIJK': 'HGBCJDIK',
  'BCDFIJKL': 'CJBDIFLK',
  'BCDFHJKL': 'CJBDHFLK',
  'BCDFHIKL': 'CIBDHFLK',
  'BCDFHIJL': 'CJBDHFLI',
  'BCDFHIJK': 'CJBDHFIK',
  'BCDFGJKL': 'CGBDJFLK',
  'BCDFGIKL': 'CGBDIFLK',
  'BCDFGIJL': 'CGBDJFLI',
  'BCDFGIJK': 'CGBDJFIK',
  'BCDFGHKL': 'CGBDHFLK',
  'BCDFGHJL': 'CGBDHFLJ',
  'BCDFGHJK': 'HGBCJFDK',
  'BCDFGHIL': 'CGBDHFLI',
  'BCDFGHIK': 'CGBDHFIK',
  'BCDFGHIJ': 'HGBCJFDI',
  'BCDEIJKL': 'EJBCIDLK',
  'BCDEHJKL': 'EJBCHDLK',
  'BCDEHIKL': 'EIBCHDLK',
  'BCDEHIJL': 'EJBCHDLI',
  'BCDEHIJK': 'EJBCHDIK',
  'BCDEGJKL': 'EGBCJDLK',
  'BCDEGIKL': 'EGBCIDLK',
  'BCDEGIJL': 'EGBCJDLI',
  'BCDEGIJK': 'EGBCJDIK',
  'BCDEGHKL': 'EGBCHDLK',
  'BCDEGHJL': 'HGBCJDLE',
  'BCDEGHJK': 'HGBCJDEK',
  'BCDEGHIL': 'EGBCHDLI',
  'BCDEGHIK': 'EGBCHDIK',
  'BCDEGHIJ': 'HGBCJDEI',
  'BCDEFJKL': 'CJBDEFLK',
  'BCDEFIKL': 'CEBDIFLK',
  'BCDEFIJL': 'CJBDEFLI',
  'BCDEFIJK': 'CJBDEFIK',
  'BCDEFHKL': 'CEBDHFLK',
  'BCDEFHJL': 'CJBDHFLE',
  'BCDEFHJK': 'CJBDHFEK',
  'BCDEFHIL': 'CEBDHFLI',
  'BCDEFHIK': 'CEBDHFIK',
  'BCDEFHIJ': 'CJBDHFEI',
  'BCDEFGL' : 'CGBDAFLE',
  'BCDEFGK' : 'CGBDAFEK',
  'BCDEFGJ' : 'CGBDAFEJ',
  'BCDEFGI' : 'CGBDAFEI',
  'BCDEFGHL': 'CGBDHFLE',
  'BCDEFGHK': 'CGBDHFEK',
  'BCDEFGHJ': 'HGBCJFDE',
  'BCDEFGHI': 'CGBDHFEI',
  'AFGHIJKL': 'HJIFAGLK',
  'AEGHIJKL': 'EJIAHGLK',
  'AEFHIJKL': 'EJIFAHLK',
  'AEFGIJKL': 'EJIFAGLK',
  'AEFGHJKL': 'EGJFAHLK',
  'AEFGHIKL': 'EGIFAHLK',
  'AEFGHIJL': 'EGJFAHLI',
  'AEFGHIJK': 'EGJFAHIK',
  'ADGHIJKL': 'HJIDAGLK',
  'ADFHIJKL': 'HJIDAFLK',
  'ADFGIJKL': 'IGJDAFLK',
  'ADFGHJKL': 'HGJDAFLK',
  'ADFGHIKL': 'HGIDAFLK',
  'ADFGHIJL': 'HGJDAFLI',
  'ADFGHIJK': 'HGJDAFIK',
  'ADEHIJKL': 'EJIDAHLK',
  'ADEGIJKL': 'EJIDAGLK',
  'ADEGHJKL': 'EGJDAHLK',
  'ADEGHIKL': 'EGIDAHLK',
  'ADEGHIJL': 'EGJDAHLI',
  'ADEGHIJK': 'EGJDAHIK',
  'ADEFIJKL': 'EJIDAFLK',
  'ADEFHJKL': 'HJEDAFLK',
  'ADEFHIKL': 'HEIDAFLK',
  'ADEFHIJL': 'HJEDAFLI',
  'ADEFHIJK': 'HJEDAFIK',
  'ADEFGJKL': 'EGJDAFLK',
  'ADEFGIKL': 'EGIDAFLK',
  'ADEFGIJL': 'EGJDAFLI',
  'ADEFGIJK': 'EGJDAFIK',
  'ADEFGHKL': 'HGEDAFLK',
  'ADEFGHJL': 'HGJDAFLE',
  'ADEFGHJK': 'HGJDAFEK',
  'ADEFGHIL': 'HGEDAFLI',
  'ADEFGHIK': 'HGEDAFIK',
  'ADEFGHIJ': 'HGJDAFEI',
  'ACGHIJKL': 'HJICAGLK',
  'ACFHIJKL': 'HJICAFLK',
  'ACFGIJKL': 'IGJCAFLK',
  'ACFGHJKL': 'HGJCAFLK',
  'ACFGHIKL': 'HGICAFLK',
  'ACFGHIJL': 'HGJCAFLI',
  'ACFGHIJK': 'HGJCAFIK',
  'ACEHIJKL': 'EJICAHLK',
  'ACEGIJKL': 'EJICAGLK',
  'ACEGHJKL': 'EGJCAHLK',
  'ACEGHIKL': 'EGICAHLK',
  'ACEGHIJL': 'EGJCAHLI',
  'ACEGHIJK': 'EGJCAHIK',
  'ACEFIJKL': 'EJICAFLK',
  'ACEFHJKL': 'HJECAFLK',
  'ACEFHIKL': 'HEICAFLK',
  'ACEFHIJL': 'HJECAFLI',
  'ACEFHIJK': 'HJECAFIK',
  'ACEFGJKL': 'EGJCAFLK',
  'ACEFGIKL': 'EGICAFLK',
  'ACEFGIJL': 'EGJCAFLI',
  'ACEFGIJK': 'EGJCAFIK',
  'ACEFGHKL': 'HGECAFLK',
  'ACEFGHJL': 'HGJCAFLE',
  'ACEFGHJK': 'HGJCAFEK',
  'ACEFGHIL': 'HGECAFLI',
  'ACEFGHIK': 'HGECAFIK',
  'ACEFGHIJ': 'HGJCAFEI',
  'ACDHIJKL': 'HJICADLK',
  'ACDGIJKL': 'IGJCADLK',
  'ACDGHJKL': 'HGJCADLK',
  'ACDGHIKL': 'HGICADLK',
  'ACDGHIJL': 'HGJCADLI',
  'ACDGHIJK': 'HGJCADIK',
  'ACDFIJKL': 'CJIDAFLK',
  'ACDFHJKL': 'HJFCADLK',
  'ACDFHIKL': 'HFICADLK',
  'ACDFHIJL': 'HJFCADLI',
  'ACDFHIJK': 'HJFCADIK',
  'ACDFGJKL': 'CGJDAFLK',
  'ACDFGIKL': 'CGIDAFLK',
  'ACDFGIJL': 'CGJDAFLI',
  'ACDFGIJK': 'CGJDAFIK',
  'ACDFGHKL': 'HGFCADLK',
  'ACDFGHJL': 'CGJDAFLH',
  'ACDFGHJK': 'HGJCAFDK',
  'ACDFGHIL': 'HGFCADLI',
  'ACDFGHIK': 'HGFCADIK',
  'ACDFGHIJ': 'HGJCAFDI',
  'ACDEIJKL': 'EJICADLK',
  'ACDEHJKL': 'HJECADLK',
  'ACDEHIKL': 'HEICADLK',
  'ACDEHIJL': 'HJECADLI',
  'ACDEHIJK': 'HJECADIK',
  'ACDEGJKL': 'EGJCADLK',
  'ACDEGIKL': 'EGICADLK',
  'ACDEGIJL': 'EGJCADLI',
  'ACDEGIJK': 'EGJCADIK',
  'ACDEGHKL': 'HGECADLK',
  'ACDEGHJL': 'HGJCADLE',
  'ACDEGHJK': 'HGJCADEK',
  'ACDEGHIL': 'HGECADLI',
  'ACDEGHIK': 'HGECADIK',
  'ACDEGHIJ': 'HGJCADEI',
  'ACDEFJKL': 'CJEDAFLK',
  'ACDEFIKL': 'CEIDAFLK',
  'ACDEFIJL': 'CJEDAFLI',
  'ACDEFIJK': 'CJEDAFIK',
  'ACDEFHKL': 'HEFCADLK',
  'ACDEFHJL': 'HJFCADLE',
  'ACDEFHJK': 'HJECAFDK',
  'ACDEFHIL': 'HEFCADLI',
  'ACDEFHIK': 'HEFCADIK',
  'ACDEFHIJ': 'HJECAFDI',
  'ACDEFGKL': 'CGEDAFLK',
  'ACDEFGJL': 'CGJDAFLE',
  'ACDEFGJK': 'CGJDAFEK',
  'ACDEFGIL': 'CGEDAFLI',
  'ACDEFGIK': 'CGEDAFIK',
  'ACDEFGIJ': 'CGJDAFEI',
  'ACDEFGHL': 'HGFCADLE',
  'ACDEFGHK': 'HGECAFDK',
  'ACDEFGHJ': 'HGJCAFDE',
  'ACDEFGHI': 'HGECAFDI',
  'ABGHIJKL': 'HJBAIGLK',
  'ABFHIJKL': 'HJBAIFLK',
  'ABFGIJKL': 'IJBFAGLK',
  'ABFGHJKL': 'HJBFAGLK',
  'ABFGHIKL': 'HGBAIFLK',
  'ABFGHIJL': 'HJBFAGLI',
  'ABFGHIJK': 'HJBFAGIK',
  'ABEHIJKL': 'EJBAIHLK',
  'ABEGIJKL': 'EJBAIGLK',
  'ABEGHJKL': 'EJBAHGLK',
  'ABEGHIKL': 'EGBAIHLK',
  'ABEGHIJL': 'EJBAHGLI',
  'ABEGHIJK': 'EJBAHGIK',
  'ABEFIJKL': 'EJBAIFLK',
  'ABEFHJKL': 'EJBFAHLK',
  'ABEFHIKL': 'EIBFAHLK',
  'ABEFHIJL': 'EJBFAHLI',
  'ABEFHIJK': 'EJBFAHIK',
  'ABEFGJKL': 'EJBFAGLK',
  'ABEFGIKL': 'EGBAIFLK',
  'ABEFGIJL': 'EJBFAGLI',
  'ABEFGIJK': 'EJBFAGIK',
  'ABEFGHKL': 'EGBFAHLK',
  'ABEFGHJL': 'HJBFAGLE',
  'ABEFGHJK': 'HJBFAGEK',
  'ABEFGHIL': 'EGBFAHLI',
  'ABEFGHIK': 'EGBFAHIK',
  'ABEFGHIJ': 'HJBFAGEI',
  'ABDHIJKL': 'IJBDAHLK',
  'ABDGIJKL': 'IJBDAGLK',
  'ABDGHJKL': 'HJBDAGLK',
  'ABDGHIKL': 'IGBDAHLK',
  'ABDGHIJL': 'HJBDAGLI',
  'ABDGHIJK': 'HJBDAGIK',
  'ABDFIJKL': 'IJBDAFLK',
  'ABDFHJKL': 'HJBDAFLK',
  'ABDFHIKL': 'HIBDAFLK',
  'ABDFHIJL': 'HJBDAFLI',
  'ABDFHIJK': 'HJBDAFIK',
  'ABDFGJKL': 'FJBDAGLK',
  'ABDFGIKL': 'IGBDAFLK',
  'ABDFGIJL': 'FJBDAGLI',
  'ABDFGIJK': 'FJBDAGIK',
  'ABDFGHKL': 'HGBDAFLK',
  'ABDFGHJL': 'HGBDAFLJ',
  'ABDFGHJK': 'HGBDAFJK',
  'ABDFGHIL': 'HGBDAFLI',
  'ABDFGHIK': 'HGBDAFIK',
  'ABDFGHIJ': 'HGBDAFIJ',
  'ABDEIJKL': 'EJBAIDLK',
  'ABDEHJKL': 'EJBDAHLK',
  'ABDEHIKL': 'EIBDAHLK',
  'ABDEHIJL': 'EJBDAHLI',
  'ABDEHIJK': 'EJBDAHIK',
  'ABDEGJKL': 'EJBDAGLK',
  'ABDEGIKL': 'EGBAIDLK',
  'ABDEGIJL': 'EJBDAGLI',
  'ABDEGIJK': 'EJBDAGIK',
  'ABDEGHKL': 'EGBDAHLK',
  'ABDEGHJL': 'HJBDAGLE',
  'ABDEGHJK': 'HJBDAGEK',
  'ABDEGHIL': 'EGBDAHLI',
  'ABDEGHIK': 'EGBDAHIK',
  'ABDEGHIJ': 'HJBDAGEI',
  'ABDEFJKL': 'EJBDAFLK',
  'ABDEFIKL': 'EIBDAFLK',
  'ABDEFIJL': 'EJBDAFLI',
  'ABDEFIJK': 'EJBDAFIK',
  'ABDEFHKL': 'HEBDAFLK',
  'ABDEFHJL': 'HJBDAFLE',
  'ABDEFHJK': 'HJBDAFEK',
  'ABDEFHIL': 'HEBDAFLI',
  'ABDEFHIK': 'HEBDAFIK',
  'ABDEFHIJ': 'HJBDAFEI',
  'ABDEFGKL': 'EGBDAFLK',
  'ABDEFGJL': 'EGBDAFLJ',
  'ABDEFGJK': 'EGBDAFJK',
  'ABDEFGIL': 'EGBDAFLI',
  'ABDEFGIK': 'EGBDAFIK',
  'ABDEFGIJ': 'EGBDAFIJ',
  'ABDEFGHL': 'HGBDAFLE',
  'ABDEFGHK': 'HGBDAFEK',
  'ABDEFGHJ': 'HGBDAFEJ',
  'ABDEFGHI': 'HGBDAFEI',
  'ABCHIJKL': 'IJBCAHLK',
  'ABCGIJKL': 'IJBCAGLK',
  'ABCGHJKL': 'HJBCAGLK',
  'ABCGHIKL': 'IGBCAHLK',
  'ABCGHIJL': 'HJBCAGLI',
  'ABCGHIJK': 'HJBCAGIK',
  'ABCFIJKL': 'IJBCAFLK',
  'ABCFHJKL': 'HJBCAFLK',
  'ABCFHIKL': 'HIBCAFLK',
  'ABCFHIJL': 'HJBCAFLI',
  'ABCFHIJK': 'HJBCAFIK',
  'ABCFGJKL': 'CJBFAGLK',
  'ABCFGIKL': 'IGBCAFLK',
  'ABCFGIJL': 'CJBFAGLI',
  'ABCFGIJK': 'CJBFAGIK',
  'ABCFGHKL': 'HGBCAFLK',
  'ABCFGHJL': 'HGBCAFLJ',
  'ABCFGHJK': 'HGBCAFJK',
  'ABCFGHIL': 'HGBCAFLI',
  'ABCFGHIK': 'HGBCAFIK',
  'ABCFGHIJ': 'HGBCAFIJ',
  'ABCEIJKL': 'EJBAICLK',
  'ABCEHJKL': 'EJBCAHLK',
  'ABCEHIKL': 'EIBCAHLK',
  'ABCEHIJL': 'EJBCAHLI',
  'ABCEHIJK': 'EJBCAHIK',
  'ABCEGJKL': 'EJBCAGLK',
  'ABCEGIKL': 'EGBAICLK',
  'ABCEGIJL': 'EJBCAGLI',
  'ABCEGIJK': 'EJBCAGIK',
  'ABCEGHKL': 'EGBCAHLK',
  'ABCEGHJL': 'HJBCAGLE',
  'ABCEGHJK': 'HJBCAGEK',
  'ABCEGHIL': 'EGBCAHLI',
  'ABCEGHIK': 'EGBCAHIK',
  'ABCEGHIJ': 'HJBCAGEI',
  'ABCEFJKL': 'EJBCAFLK',
  'ABCEFIKL': 'EIBCAFLK',
  'ABCEFIJL': 'EJBCAFLI',
  'ABCEFIJK': 'EJBCAFIK',
  'ABCEFHKL': 'HEBCAFLK',
  'ABCEFHJL': 'HJBCAFLE',
  'ABCEFHJK': 'HJBCAFEK',
  'ABCEFHIL': 'HEBCAFLI',
  'ABCEFHIK': 'HEBCAFIK',
  'ABCEFHIJ': 'HJBCAFEI',
  'ABCEFGKL': 'EGBCAFLK',
  'ABCEFGJL': 'EGBCAFLJ',
  'ABCEFGJK': 'EGBCAFJK',
  'ABCEFGIL': 'EGBCAFLI',
  'ABCEFGIK': 'EGBCAFIK',
  'ABCEFGIJ': 'EGBCAFIJ',
  'ABCEFGHL': 'HGBCAFLE',
  'ABCEFGHK': 'HGBCAFEK',
  'ABCEFGHJ': 'HGBCAFEJ',
  'ABCEFGHI': 'HGBCAFEI',
  'ABCDIJKL': 'IJBCADLK',
  'ABCDHJKL': 'HJBCADLK',
  'ABCDHIKL': 'HIBCADLK',
  'ABCDHIJL': 'HJBCADLI',
  'ABCDHIJK': 'HJBCADIK',
  'ABCDGJKL': 'CJBDAGLK',
  'ABCDGIKL': 'IGBCADLK',
  'ABCDGIJL': 'CJBDAGLI',
  'ABCDGIJK': 'CJBDAGIK',
  'ABCDGHKL': 'HGBCADLK',
  'ABCDGHJL': 'HGBCADLJ',
  'ABCDGHJK': 'HGBCADJK',
  'ABCDGHIL': 'HGBCADLI',
  'ABCDGHIK': 'HGBCADIK',
  'ABCDGHIJ': 'HGBCADIJ',
  'ABCDFJKL': 'CJBDAFLK',
  'ABCDFIKL': 'CIBDAFLK',
  'ABCDFIJL': 'CJBDAFLI',
  'ABCDFIJK': 'CJBDAFIK',
  'ABCDFHKL': 'HFBCADLK',
  'ABCDFHJL': 'CJBDAFLH',
  'ABCDFHJK': 'HJBCAFDK',
  'ABCDFHIL': 'HFBCADLI',
  'ABCDFHIK': 'HFBCADIK',
  'ABCDFHIJ': 'HJBCAFDI',
  'ABCDFGKL': 'CGBDAFLK',
  'ABCDFGJL': 'CGBDAFLJ',
  'ABCDFGJK': 'CGBDAFJK',
  'ABCDFGIL': 'CGBDAFLI',
  'ABCDFGIK': 'CGBDAFIK',
  'ABCDFGIJ': 'CGBDAFIJ',
  'ABCDFGHL': 'CGBDAFLH',
  'ABCDFGHK': 'HGBCAFDK',
  'ABCDFGHJ': 'HGBCAFDJ',
  'ABCDFGHI': 'HGBCAFDI',
  'ABCDEJKL': 'EJBCADLK',
  'ABCDEIKL': 'EIBCADLK',
  'ABCDEIJL': 'EJBCADLI',
  'ABCDEIJK': 'EJBCADIK',
  'ABCDEHKL': 'HEBCADLK',
  'ABCDEHJL': 'HJBCADLE',
  'ABCDEHJK': 'HJBCADEK',
  'ABCDEHIL': 'HEBCADLI',
  'ABCDEHIK': 'HEBCADIK',
  'ABCDEHIJ': 'HJBCADEK',
  'ABCDEGKL': 'EGBCADLK',
  'ABCDEGJL': 'EGBCADLJ',
  'ABCDEGJK': 'EGBCADJK',
  'ABCDEGIL': 'EGBCADLI',
  'ABCDEGIK': 'EGBCADIK',
  'ABCDEGIJ': 'EGBCADIJ',
  'ABCDEGHL': 'HGBCADLE',
  'ABCDEGHK': 'HGBCADEK',
  'ABCDEGHJ': 'HGBCADEJ',
  'ABCDEGHI': 'HGBCADEI',
  'ABCDEFKL': 'CEBDAFLK',
  'ABCDEFJL': 'CJBDAFLE',
  'ABCDEFJK': 'CJBDAFEK',
  'ABCDEFIL': 'CEBDAFLI',
  'ABCDEFIK': 'CEBDAFIK',
  'ABCDEFIJ': 'CJBDAFEI',
  'ABCDEFHL': 'HFBCADLE',
  'ABCDEFHK': 'HEBCAFDK',
  'ABCDEFHJ': 'HJBCAFDE',
  'ABCDEFHI': 'HEBCAFDI',
  'ABCDEFGL': 'CGBDAFLE',
  'ABCDEFGK': 'CGBDAFEK',
  'ABCDEFGJ': 'CGBDAFEJ',
  'ABCDEFGI': 'CGBDAFEI',
  'ABCDEFGH': 'HGBCAFDE'
}

const assignThirds = (bestThirds: Array<Team & { group: string }>) => {
  const qualifiedGroupsKey = bestThirds
    .map((team) => team.group)
    .sort((a, b) => a.localeCompare(b))
    .join('')
  const assignmentSequence = FIFA_THIRD_PLACE_MATRIX[qualifiedGroupsKey]
  if (!assignmentSequence) {
    return {}
  }
  const thirdTeamsByGroup = bestThirds.reduce((acc, team) => {
    acc[team.group] = team
    return acc
  }, {} as Record<string, Team & { group: string }>)
  const assignments: Record<string, Team> = {}
  THIRD_WINNER_COLUMNS.forEach((winnerSlot, index) => {
    const assignedGroup = assignmentSequence[index]
    const assignedTeam = thirdTeamsByGroup[assignedGroup]
    if (!assignedTeam) return
    const playoffSlot = THIRD_PLAYOFF_SLOT_BY_WINNER[winnerSlot]
    assignments[playoffSlot] = assignedTeam
  })
  return assignments
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

const getLocalDayKey = (dateInput: string | Date) => {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  return date.toLocaleDateString('en-CA')
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

const getTeamStateClass = (match: TodayMatch, side: 'home' | 'away') => {
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

const isPlaceholderTeam = (team: TodayMatch['home'] | TodayMatch['away']) => 'isPlaceholder' in team && team.isPlaceholder === true

const getTodayMatchTeamKey = (teamId: string) => /^[a-z]{2}(?:-[a-z]{2,3})?$/i.test(teamId)

const knockoutRounds = [
  { stageLabel: 'Dieciseisavos', matches: knockoutData.leftRoundOf32 },
  { stageLabel: 'Dieciseisavos', matches: knockoutData.rightRoundOf32 },
  { stageLabel: 'Octavos', matches: knockoutData.leftRoundOf16 },
  { stageLabel: 'Octavos', matches: knockoutData.rightRoundOf16 },
  { stageLabel: 'Cuartos', matches: knockoutData.leftQuarterfinals },
  { stageLabel: 'Cuartos', matches: knockoutData.rightQuarterfinals },
  { stageLabel: 'Semifinal', matches: knockoutData.leftSemifinals },
  { stageLabel: 'Semifinal', matches: knockoutData.rightSemifinals },
  { stageLabel: 'Tercer puesto', matches: [knockoutData.thirdPlace] },
  { stageLabel: 'Final', matches: [knockoutData.final] }
] as const

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
          homePenalties?: number | null
          awayPenalties?: number | null
        }
        nextOfficial[document.id] = {
          date: typeof data.date === 'string' ? data.date : undefined,
          homeGoals: typeof data.homeGoals === 'number' ? data.homeGoals : null,
          awayGoals: typeof data.awayGoals === 'number' ? data.awayGoals : null,
          homePenalties: typeof data.homePenalties === 'number' ? data.homePenalties : null,
          awayPenalties: typeof data.awayPenalties === 'number' ? data.awayPenalties : null
        }
      })
      setOfficialResults(nextOfficial)
    })
    return () => unsubscribe()
  }, [])

  const liveMatchesData = useMemo<Record<string, Match[]>>(() => {
    return Object.keys(initialMatches).reduce((acc, groupKey) => {
      acc[groupKey] = initialMatches[groupKey].map((match) => {
        const official = officialResults[match.id]
        return {
          ...match,
          date: official?.date ?? match.date,
          homeGoals: official?.homeGoals ?? null,
          awayGoals: official?.awayGoals ?? null
        }
      })
      return acc
    }, {} as Record<string, Match[]>)
  }, [officialResults])

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
    Object.keys(liveGroupsData).forEach((groupKey) => {
      const teams = liveGroupsData[groupKey]
      if (teams[0]) firsts[groupKey] = teams[0]
      if (teams[1]) seconds[groupKey] = teams[1]
      if (teams[2]) thirds.push({ ...teams[2], group: groupKey })
    })
    const bestThirds = (sortTeams(thirds) as Array<Team & { group: string }>).slice(0, 8)
    return { firsts, seconds, bestThirds }
  }, [liveGroupsData])

  const resolvedKnockoutMatches = useMemo<TodayKnockoutMatch[]>(() => {
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
    const processRound = (matches: readonly KnockoutMatch[], stageLabel: string) => {
      return matches.map((match) => {
        const homeReference = parseReference(match.home.name)
        const awayReference = parseReference(match.away.name)
        const home = homeReference?.type === 'W'
          ? (knockoutResults[homeReference.prevId] ? { id: knockoutResults[homeReference.prevId].id, name: knockoutResults[homeReference.prevId].name } : { id: 'tbd', name: match.home.name, isPlaceholder: true })
          : homeReference?.type === 'L'
            ? (knockoutLosers[homeReference.prevId] ? { id: knockoutLosers[homeReference.prevId].id, name: knockoutLosers[homeReference.prevId].name } : { id: 'tbd', name: match.home.name, isPlaceholder: true })
            : resolveTeam(match.home.name)
        const away = awayReference?.type === 'W'
          ? (knockoutResults[awayReference.prevId] ? { id: knockoutResults[awayReference.prevId].id, name: knockoutResults[awayReference.prevId].name } : { id: 'tbd', name: match.away.name, isPlaceholder: true })
          : awayReference?.type === 'L'
            ? (knockoutLosers[awayReference.prevId] ? { id: knockoutLosers[awayReference.prevId].id, name: knockoutLosers[awayReference.prevId].name } : { id: 'tbd', name: match.away.name, isPlaceholder: true })
            : resolveTeam(match.away.name)
        const official = officialResults[match.id]
        const homeGoals = official?.homeGoals ?? null
        const awayGoals = official?.awayGoals ?? null
        const homePenalties = official?.homePenalties ?? null
        const awayPenalties = official?.awayPenalties ?? null
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
        return {
          ...match,
          kind: 'knockout' as const,
          stageLabel,
          date: official?.date ?? match.date,
          home,
          away,
          homeGoals,
          awayGoals,
          homePenalties,
          awayPenalties
        }
      })
    }
    return knockoutRounds.flatMap(({ stageLabel, matches }) => processRound(matches, stageLabel))
  }, [officialResults, standings])

  const todaysMatches = useMemo<TodayMatch[]>(() => {
    const todayKey = getLocalDayKey(new Date())
    const groupMatches: TodayGroupMatch[] = Object.entries(liveMatchesData)
      .flatMap(([group, groupMatches]) =>
        groupMatches.map((match) => {
          return {
            ...match,
            kind: 'group' as const,
            stageLabel: `Grupo ${group}`,
            group
          }
        })
      )
    return [...groupMatches, ...resolvedKnockoutMatches]
      .filter((match) => getLocalDayKey(match.date) === todayKey)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [liveMatchesData, resolvedKnockoutMatches])

  const openGroupModal = (group: string) => {
    setInitialGroup(group)
    setIsGroupModalOpen(true)
  }

  const openTodayMatch = (match: TodayMatch) => {
    if (match.kind === 'group') {
      openGroupModal(match.group)
      return
    }
    setIsKnockoutModalOpen(true)
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
                    onClick={() => openTodayMatch(match)}
                  >
                    <div className="today-match-header">
                      <span className="today-match-group">{match.stageLabel}</span>
                      <span className="today-match-datetime">
                        <span className="today-datetime-icon"><ClockIcon /></span>
                        {formatLocalDateTime(match.date)}
                      </span>
                    </div>
                    <div className="today-match-teams">
                      <span className={`today-match-team ${getTeamStateClass(match, 'home')}`}>
                        {!isPlaceholderTeam(match.home) && getTodayMatchTeamKey(match.home.id) ? (
                          <img src={`https://flagcdn.com/${match.home.id}.svg`} alt={match.home.name} className="today-match-flag" width={22} height={14} />
                        ) : null}
                        <span className="today-match-team-name">{match.home.name}</span>
                      </span>
                      <span className="today-match-score">
                        {match.homeGoals ?? '-'} - {match.awayGoals ?? '-'}
                      </span>
                      <span className={`today-match-team today-match-team-right ${getTeamStateClass(match, 'away')}`}>
                        {!isPlaceholderTeam(match.away) && getTodayMatchTeamKey(match.away.id) ? (
                          <img src={`https://flagcdn.com/${match.away.id}.svg`} alt={match.away.name} className="today-match-flag" width={22} height={14} />
                        ) : null}
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