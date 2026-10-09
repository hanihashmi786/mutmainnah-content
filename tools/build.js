#!/usr/bin/env node
/**
 * Turns the day files into the feed the Mutma'innah app reads.
 *
 *   node tools/build.js           build into _site/ (what GitHub Pages serves)
 *   node tools/build.js --check   read and report every file, write nothing
 *
 * THE DAY FILES
 * -------------
 * rawd/<YYYY-MM-DD>.txt is one hadith of Al-Rawd al-Basim min Khuluq al-Nabi
 * al-Khatim, pasted as the book prints it. The file's name is the day it
 * opens in the app, at midnight on the reader's own phone; a file dated ahead
 * waits for its day.
 *
 *   Title: His generosity              the day's name in English    optional
 *   فَصْلٌ فِي ...                      a fasl heading (Arabic)      optional
 *   حضور ﷺ کا ...                      its Urdu                     optional
 *   (9) أَجْرُ مَنْ ...                 the topic heading, numbered  optional
 *   ضرورت مندوں کی ...                 its Urdu                     optional
 *   17. عَنْ أَبِي هُرَيْرَةَ ...         the hadith, by its number    REQUIRED
 *   أخرجه الطبراني ...                 the takhrij                  expected
 *   حضرت ابو ہریرہ ...                  the Urdu translation         REQUIRED
 *
 * A post copied out of WhatsApp reads as it stands: the hadith may open on
 * ">" instead of its number, a "(1)" before the takhrij is the book's
 * footnote mark, and the chat's "[9/1, 16:16] ..." line, links, the الحديث /
 * القرآن label and the book's name signed at the foot are all left out.
 *
 * Blank lines do not matter, and neither does a ">" a chat window put in
 * front of a line. Which line is which is read from the text itself: the
 * matn and the headings are fully vowelled Arabic, the takhrij is unvowelled
 * Arabic opening on أخرجه (or ذكره, رواه, ...), and Urdu is the only one
 * that writes ے ں ٹ ڈ ڑ.
 *
 * WHAT IS CHANGED, AND WHAT IS NOT
 * --------------------------------
 * The words are the book's. Two things are touched:
 * - Allah in the Arabic (matn and headings, not the takhrij) is written
 *   اللّٰه with its case vowel, as everywhere else in the app. A bare one takes
 *   the nominative after رضي / صلى / قال and the genitive otherwise.
 * - Runs of spaces are folded to one.
 *
 * A file that cannot be read stops the whole build, so nothing half-read
 * reaches anyone; GitHub emails the repo's owner when that happens, and the
 * log names the file and the line.
 *
 * The marks are built from their code points below, never typed: Arabic typed
 * through an editing tool can come back with its marks reordered.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SRC = path.join(ROOT, 'rawd')
const OUT = path.join(ROOT, '_site', 'rawd')
const CHECK = process.argv.includes('--check')

// latest.json, the one file the app fetches every day, carries this many days
// back from the build and everything scheduled ahead. Older days are in the
// month files, read only when someone scrolls that far.
const LATEST_DAYS = 75

// ---- Characters -------------------------------------------------------------

const ch = (...cps) => String.fromCharCode(...cps)
const range = (a, b) => `${ch(a)}-${ch(b)}`

const MK = range(0x064b, 0x065f) + ch(0x0670, 0x0640) // harakat, dagger alif, tatweel
const LETTER = range(0x0621, 0x063a) + range(0x0641, 0x064a) + range(0x0671, 0x06d3)
const VOWELS = new RegExp(`[${range(0x064b, 0x0652)}${ch(0x0670)}]`, 'g')
const LETTERS = new RegExp(`[${LETTER}]`, 'g')
// ٹ ڈ ڑ ں ے ۓ: no Arabic word has them, even typed on an Urdu keyboard.
const URDU_ONLY = new RegExp(`[${ch(0x0679, 0x0688, 0x0691, 0x06ba, 0x06d2, 0x06d3)}]`)

const INVISIBLE = new RegExp(`[${ch(0xfeff, 0x200b)}]`, 'g') // BOM, zero-width space
const NBSP = new RegExp(ch(0x00a0), 'g')

// Arabic-Indic and Urdu digits, read as numbers.
const toInt = (s) =>
  parseInt(
    s.replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x0660).replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 0x06f0),
    10,
  )
const DIGITS = `[0-9${range(0x0660, 0x0669)}${range(0x06f0, 0x06f9)}]+`

// ---- Reading a line ---------------------------------------------------------

const clean = (line) =>
  line
    .replace(INVISIBLE, '')
    .replace(NBSP, ' ')
    .replace(/^\s*>+\s*/, '')
    .replace(/[ \t]+/g, ' ')
    .trim()

const vowelRatio = (s) => {
  const letters = (s.match(LETTERS) || []).length
  return letters ? (s.match(VOWELS) || []).length / letters : 0
}
const isVowelled = (s) => vowelRatio(s) >= 0.3
const isUrdu = (s) => !isVowelled(s) && URDU_ONLY.test(s)

// Letters only, one form of each, so a prefix is recognised however the line
// is vowelled or whichever keyboard typed it.
const fold = (s) =>
  s
    .replace(new RegExp(`[${MK}]`, 'g'), '')
    .replace(new RegExp(`[${ch(0x0622, 0x0623, 0x0625, 0x0671)}]`, 'g'), ch(0x0627))
    .replace(new RegExp(`[${ch(0x06c1, 0x06be)}]`, 'g'), ch(0x0647))
    .replace(new RegExp(`[${ch(0x06cc, 0x0649)}]`, 'g'), ch(0x064a))
    .replace(new RegExp(ch(0x06a9), 'g'), ch(0x0643))
    .replace(new RegExp(ch(0x06c3), 'g'), ch(0x0629))

// The footnote number the book sets before a takhrij, "(1) أخرجه ...".
const FOOTNOTE = new RegExp(`^\\(\\s*${DIGITS}\\s*\\)\\s*`)
// Whatever stands before the first letter: a stray ")" a right-to-left
// paste leaves at the start of a line, a list number.
const LEADING_NON_LETTER = new RegExp(`^[^${LETTER}]+`)

const TAKHRIJ_WORDS = ['اخرجه', 'واخرجه', 'اخرجها', 'ذكره', 'وذكره', 'اورده', 'انظر', 'ينظر']
const isTakhrij = (s) => {
  if (isVowelled(s)) return false
  // A footnote mark on unvowelled Arabic is the takhrij whatever its first
  // word: "(2) أبو نعيم في حلية الأولياء".
  if (FOOTNOTE.test(s) && !isUrdu(s)) return true
  const first = fold(s).replace(LEADING_NON_LETTER, '').split(/\s+/)[0] || ''
  return TAKHRIJ_WORDS.includes(first) || first === 'رواه'
}

// What a WhatsApp post carries around the text, dropped wherever it stands:
// the "[9/1, 16:16] +92 ...:" line a copied chat puts over each message, a
// link on a line of its own, the الحديث label (on a page of hadith it says
// nothing), and the book's name signed under the post. The other section
// labels, القرآن and الآثار والأقوال, stay as headings: they tell the reader
// that the day's text is an ayah or a saying, not a hadith.
const CHAT_HEADER = /^\[\d{1,2}\/\d{1,2}(?:\/\d{2,4})?,\s*\d{1,2}:\d{2}[^\]]*\]/
const LINK = /^https?:\/\/\S+$/
const NOT_LETTER = new RegExp(`[^${LETTER}]`, 'g')
const isScaffold = (s) => {
  if (CHAT_HEADER.test(s) || LINK.test(s)) return true
  const letters = fold(s).replace(NOT_LETTER, '')
  return letters === 'الحديث' || letters.startsWith('الروضالباسم')
}

// A line of English before the hadith, "Title: His generosity" or just the
// words, names the day in the app's list of earlier days.
const ARABIC_LETTER = new RegExp(`[${LETTER}]`)
const isEnglish = (s) => /[A-Za-z]/.test(s) && !ARABIC_LETTER.test(s)
const TITLE_PREFIX = /^title\s*[:\-]\s*/i

const HADITH_START = new RegExp(`^(${DIGITS})\\s*(?:\\/\\s*(${DIGITS})\\s*)?[.${ch(0x06d4)}\\-,${ch(0x060c)}]\\s*`)
const TOPIC_START = new RegExp(`^\\(\\s*(${DIGITS})\\s*\\)\\s*`)
const isFasl = (s) => fold(s).startsWith('فصل')

// Where the hadith starts: the line a WhatsApp post quotes with ">", or the
// line that opens on the hadith's number, "17. عَنْ ...". Only Arabic counts,
// so an Urdu line numbered "23. اور ..." is never taken for a hadith.
const opensHadith = (l) => l.quoted || (HADITH_START.test(l.text) && isVowelled(l.text.replace(HADITH_START, '')))

// ---- The Name ---------------------------------------------------------------

const ALLAH = new RegExp(
  `(?<![${LETTER}${MK}])(?:[وفبتك][${MK}]*){0,2}(?:[اٱأ][${MK}]*ل[${MK}]*|ل[${MK}]*)ل[${MK}]*[هہ][${MK}]*(?:م[${MK}]*)?(?![${LETTER}])`,
  'g',
)
const SHADDA_DAGGER = ch(0x0651, 0x0670)
const DAMMA = ch(0x064f)
const KASRA = ch(0x0650)
const CASE_VOWEL = new RegExp(`[${range(0x064b, 0x0650)}${ch(0x0652)}]`)
const bare = (w) => w.replace(new RegExp(`[${MK}]`, 'g'), '')
const NOMINATIVE_AFTER = new Set(['رضي', 'رضى', 'رضی', 'صلى', 'صلی', 'قال'])

const markAllah = (text) =>
  text.replace(ALLAH, (word, offset, whole) => {
    const heh = Math.max(word.lastIndexOf('ه'), word.lastIndexOf('ہ'))
    const lam = word.lastIndexOf('ل', heh)
    const after = word.slice(heh + 1)
    const meem = after.indexOf('م')
    let hehMarks = meem >= 0 ? after.slice(0, meem) : after
    const rest = meem >= 0 ? after.slice(meem) : ''
    if (!CASE_VOWEL.test(hehMarks)) {
      const before = bare(whole.slice(0, offset).trim().split(/\s+/).pop() || '')
      hehMarks = (rest || NOMINATIVE_AFTER.has(before) ? DAMMA : KASRA) + hehMarks
    }
    return word.slice(0, lam + 1) + SHADDA_DAGGER + word[heh] + hehMarks + rest
  })

// ---- One file ---------------------------------------------------------------

class FileError extends Error {}

/**
 * One day file's text → { n, headings, arabic, takhrij, urdu }, or a FileError
 * that says what is wrong with it in words the person who wrote it can act on.
 * `n` is null when the hadith came without its number (a WhatsApp post that
 * marks it with ">" alone); the app shows no number either way.
 */
const parseDay = (text) => {
  const lines = text
    .split(/\r?\n/)
    .map((raw) => ({ quoted: /^\s*>/.test(raw.replace(INVISIBLE, '')), text: clean(raw) }))
    .filter((l) => l.text && !isScaffold(l.text))
  const headings = []
  let title = ''
  let i = 0

  // Headings, each Arabic line with the Urdu line under it, up to the hadith.
  for (; i < lines.length && !opensHadith(lines[i]); i++) {
    const line = lines[i].text
    if (isEnglish(line)) {
      const words = line.replace(TITLE_PREFIX, '')
      title = title ? `${title} ${words}` : words
      continue
    }
    if (isUrdu(line)) {
      headings.push({ kind: 'other', ar: '', ur: line })
      continue
    }
    const heading = { kind: isFasl(line) ? 'fasl' : 'other', ar: line, ur: '' }
    const topic = line.match(TOPIC_START)
    if (topic) {
      heading.kind = 'topic'
      heading.n = toInt(topic[1])
      heading.ar = line.slice(topic[0].length)
    } else if (heading.kind === 'other' && headings.some((h) => h.kind === 'fasl')) {
      // A heading under a fasl is its topic, numbered in the book or not.
      heading.kind = 'topic'
    }
    const next = lines[i + 1]
    if (next && !opensHadith(next) && isUrdu(next.text)) {
      heading.ur = next.text
      i++
    }
    headings.push(heading)
  }

  if (i >= lines.length) {
    // No hadith: a day that opens a fasl with the book's own Urdu
    // introduction to it. The Urdu after the fasl is the text. Only a fasl may
    // stand over it: any other Arabic line means a hadith that lost its number
    // and its ">", which must stop the build, not pass for an introduction.
    let last = headings.length
    while (last > 0 && !headings[last - 1].ar) last--
    const prose = headings.slice(last).map((h) => h.ur)
    const arabicHeads = headings.filter((h) => h.ar)
    if (!prose.length || !arabicHeads.length || arabicHeads.some((h) => h.kind !== 'fasl')) {
      throw new FileError('no hadith found: start the hadith with its number, like "17. عَنْ ...", or with ">"')
    }
    return {
      n: null,
      ...(title && { title }),
      kind: 'intro',
      headings: headings.slice(0, last).map((h) => ({ ...h, ar: markAllah(h.ar) })),
      arabic: '',
      takhrij: '',
      urdu: prose.join('\n'),
    }
  }

  const start = lines[i].text.match(HADITH_START)
  const n = start ? toInt(start[2] || start[1]) : null
  const arabic = [start ? lines[i].text.slice(start[0].length) : lines[i].text]
  const takhrij = []
  const urdu = []
  let state = 'matn'

  for (i++; i < lines.length; i++) {
    const { text: line, quoted } = lines[i]
    if (state !== 'matn' && isVowelled(line) && isFasl(line)) {
      throw new FileError(`a second post starts at "${line.slice(0, 40)}": one day per file`)
    }
    // A post may set its Arabic in more than one block, an ayah and its
    // translation, then the next ayah ("> 2, ..." or "5 - ...") and its own.
    // The later blocks join the Arabic and their translations the Urdu, each
    // in order. Two posts pasted into one file are caught by their second
    // fasl heading above, not here.
    if (state !== 'matn' && isVowelled(line) && (quoted || HADITH_START.test(line))) {
      arabic.push(line.replace(HADITH_START, ''))
      continue
    }
    if (state === 'matn') {
      if (isTakhrij(line)) state = 'takhrij'
      else if (isUrdu(line)) state = 'urdu'
    } else if (state === 'takhrij' && isUrdu(line)) {
      state = 'urdu'
    }
    ;({ matn: arabic, takhrij, urdu })[state].push(state === 'takhrij' ? line.replace(FOOTNOTE, '') : line)
  }

  if (!arabic.join('').trim()) throw new FileError('the hadith has no Arabic after its number')
  if (!urdu.length) throw new FileError('no Urdu translation found after the Arabic and the takhrij')

  return {
    n,
    ...(title && { title }),
    headings: headings.map((h) => ({ ...h, ar: markAllah(h.ar) })),
    arabic: markAllah(arabic.join('\n')),
    takhrij: takhrij.join('\n'),
    urdu: urdu.join('\n'),
  }
}

// Characters that come in with a paste and draw as empty boxes in the app:
// Hebrew, Devanagari, the private-use area, and the replacement character.
const strays = (s) => {
  const found = new Set()
  for (const c of s) {
    const cp = c.codePointAt(0)
    if ((cp >= 0x0590 && cp <= 0x05ff) || (cp >= 0x0900 && cp <= 0x097f) || (cp >= 0xe000 && cp <= 0xf8ff) || cp === 0xfffd) {
      found.add(`U+${cp.toString(16).toUpperCase().padStart(4, '0')}`)
    }
  }
  return [...found]
}

const DAY_FILE = /^(\d{4})-(\d{2})-(\d{2})\.txt$/
const isRealDay = (y, m, d) => {
  const date = new Date(Date.UTC(+y, +m - 1, +d))
  return date.getUTCFullYear() === +y && date.getUTCMonth() === +m - 1 && date.getUTCDate() === +d
}

// ---- The index --------------------------------------------------------------

/**
 * Every day ever posted, a line each, for the app's chapter list and calendar:
 * those reach back past latest.json's seventy-five days, and the month files
 * behind them are fetched only when a day is opened.
 *
 *   chapters  [{ ar, ur }]                 each fasl, in the order it first came
 *   days      [{ date, chapter, name, title? }]   oldest first
 *
 * A fasl is known by its letters alone, so the same heading pasted with a
 * vowel more or less is one chapter. A day without a fasl heading stays in the
 * one before it. `name` is what the app's row shows in Urdu: the topic's Urdu,
 * else the first line of the translation. Not the fasl's: the row stands
 * under its fasl already.
 */
// A row shows one line of the name, and a translation's first line can be a
// whole paragraph: the index keeps the first words of it, cut at a space.
const NAME_MAX = 100
const clip = (s) => {
  if (s.length <= NAME_MAX) return s
  const cut = s.lastIndexOf(' ', NAME_MAX)
  return `${s.slice(0, cut > 0 ? cut : NAME_MAX)}…`
}

const buildIndex = (entries) => {
  const chapters = []
  const byKey = new Map()
  let current = null
  const days = entries.map((e) => {
    const fasl = e.headings.find((h) => h.kind === 'fasl' && h.ar)
    if (fasl) {
      const key = fold(fasl.ar).replace(NOT_LETTER, '')
      if (!byKey.has(key)) {
        byKey.set(key, chapters.length)
        chapters.push({ ar: fasl.ar, ur: fasl.ur })
      }
      current = byKey.get(key)
    }
    const name = clip(e.headings.find((h) => h.kind !== 'fasl' && h.ur)?.ur || e.urdu.split('\n')[0])
    return { date: e.date, chapter: current, name, ...(e.title && { title: e.title }) }
  })
  return { chapters, days }
}

// ---- The build --------------------------------------------------------------

const main = () => {
  const files = fs.existsSync(SRC) ? fs.readdirSync(SRC).filter((f) => !f.startsWith('.')).sort() : []
  const entries = []
  const errors = []
  const warnings = []

  for (const file of files) {
    const day = file.match(DAY_FILE)
    if (!day || !isRealDay(day[1], day[2], day[3])) {
      errors.push(`${file}: the name must be the date, like 2026-10-04.txt`)
      continue
    }
    const text = fs.readFileSync(path.join(SRC, file), 'utf8')
    try {
      const entry = { date: `${day[1]}-${day[2]}-${day[3]}`, ...parseDay(text) }
      const bad = strays(JSON.stringify(entry))
      if (bad.length) throw new FileError(`characters that show as empty boxes: ${bad.join(', ')}`)
      if (!entry.takhrij && entry.kind !== 'intro') warnings.push(`${file}: no takhrij found (a line starting أخرجه ...)`)
      entries.push(entry)
    } catch (e) {
      if (!(e instanceof FileError)) throw e
      errors.push(`${file}: ${e.message}`)
    }
  }

  for (const e of entries) {
    console.log(
      `${e.date}  hadith ${String(e.n ?? '-').padStart(4)}  ` +
        `${e.headings.map((h) => h.kind + (h.n ? ` ${h.n}` : '')).join(', ') || 'no headings'}  ` +
        `arabic ${e.arabic.length}  takhrij ${e.takhrij.length}  urdu ${e.urdu.length}`,
    )
  }
  warnings.forEach((w) => console.log(`warning  ${w}`))
  if (errors.length) {
    errors.forEach((e) => console.error(`ERROR  ${e}`))
    console.error(`\n${errors.length} file(s) could not be read; nothing was published.`)
    process.exit(1)
  }
  console.log(`${entries.length} day(s) read`)
  if (CHECK) return

  const built = new Date()
  const cutoff = new Date(built.getTime() - LATEST_DAYS * 86400000).toISOString().slice(0, 10)
  const months = [...new Set(entries.map((e) => e.date.slice(0, 7)))]

  fs.rmSync(OUT, { recursive: true, force: true })
  fs.mkdirSync(OUT, { recursive: true })
  const write = (name, data) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(data) + '\n', 'utf8')

  write('latest.json', {
    v: 1,
    book: 'rawd',
    built: built.toISOString(),
    // The first day ever posted: the app offers older months only while the
    // days it holds do not reach back this far.
    earliest: entries.length ? entries[0].date : null,
    months,
    index: buildIndex(entries),
    entries: entries.filter((e) => e.date >= cutoff),
  })
  for (const month of months) {
    write(`${month}.json`, { v: 1, book: 'rawd', month, entries: entries.filter((e) => e.date.startsWith(month)) })
  }
  console.log(`wrote latest.json and ${months.length} month file(s) to ${path.relative(ROOT, OUT)}`)
}

if (require.main === module) main()

module.exports = { parseDay, markAllah, buildIndex, FileError }
