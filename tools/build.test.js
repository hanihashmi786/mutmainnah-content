// node --test tools/
// The shapes a pasted day can arrive in, and the ones that must stop the build.

const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { parseDay, buildIndex, FileError } = require('./build')

const ch = (...cps) => String.fromCharCode(...cps)
// اللّٰه with its marks in the order the app's tests require: lam, shadda, dagger alif, heh.
const ALLAH_MARKED = 'ال' + 'ل' + ch(0x0651, 0x0670) + 'ه'

const sample = fs.readFileSync(path.join(__dirname, '..', 'rawd', '2026-10-04.txt'), 'utf8')

test('the sample day reads into its parts', () => {
  const d = parseDay(sample)
  assert.strictEqual(d.n, 17)
  assert.deepStrictEqual(
    d.headings.map((h) => [h.kind, h.n]),
    [
      ['fasl', undefined],
      ['topic', 9],
    ],
  )
  assert.ok(d.headings.every((h) => h.ar && h.ur))
  assert.ok(d.headings[1].ar.startsWith('أَجْرُ'))
  assert.ok(d.arabic.startsWith('عَنْ'))
  assert.ok(d.takhrij.startsWith('أخرجه'))
  assert.ok(d.urdu.startsWith('حضرت'))
  assert.strictEqual(d.urdu.split('\n').length, 2)
  // Every Allah in the matn carries its marks; the Urdu is left as written.
  assert.strictEqual(d.arabic.split(ALLAH_MARKED).length - 1, 3)
  assert.ok(d.urdu.includes('رسول الله'))
})

test('headings are optional', () => {
  const d = parseDay(sample.split('\n').slice(6).join('\n'))
  assert.strictEqual(d.headings.length, 0)
  assert.strictEqual(d.n, 17)
})

test('an English line before the hadith is the day\'s title', () => {
  assert.strictEqual(parseDay(sample).title, undefined)
  const d = parseDay('Title: Relieving a believer\n' + sample)
  assert.strictEqual(d.title, 'Relieving a believer')
  assert.strictEqual(d.headings.length, 2)
  assert.strictEqual(parseDay('Relieving a believer\n' + sample).title, 'Relieving a believer')
})

test('a takhrij over several lines stays one takhrij', () => {
  const text = sample.replace('الرقم 4504،', 'الرقم 4504،\nوالديلمي في مسند الفردوس، 3/568، الرقم 5826.')
  const d = parseDay(text)
  assert.strictEqual(d.takhrij.split('\n').length, 2)
  assert.ok(d.urdu.startsWith('حضرت'))
})

test('a vowelled riwayah line stays in the matn', () => {
  const text = sample.replace(' رَوَاهُ الطَّبَرَانِيُّ', '\nرَوَاهُ الطَّبَرَانِيُّ')
  const d = parseDay(text)
  assert.strictEqual(d.arabic.split('\n').length, 2)
  assert.ok(d.takhrij.startsWith('أخرجه'))
})

test('Urdu or Arabic-Indic digits number the hadith too', () => {
  assert.strictEqual(parseDay(sample.replace('17.', ch(0x06f1, 0x06f7) + '.')).n, 17)
  assert.strictEqual(parseDay(sample.replace('17.', ch(0x0661, 0x0667) + '.')).n, 17)
})

test('a hadith quoted with ">" needs no number', () => {
  const d = parseDay(sample.replace('17. ', ''))
  assert.strictEqual(d.n, null)
  assert.ok(d.arabic.startsWith('عَنْ'))
  assert.ok(d.takhrij.startsWith('أخرجه'))
})

test('a day with neither the number nor ">" stops the build', () => {
  assert.throws(() => parseDay(sample.replace('> 17. ', '')), FileError)
})

test('a WhatsApp post reads as it stands', () => {
  const post = [
    '[9/1, 16:16] +92 300 0000000: https://chat.whatsapp.com/abc...',
    'https://www.facebook.com/share/abc/',
    sample.replace('أخرجه', '(1) أخرجه').replace('(9)', 'الْحَدِيث\n\n(9)'),
    '',
    ' الرَّوضُ البَاسِم مِن خُلُقِ النَّبِی الخَاتِمﷺ',
  ].join('\n')
  const d = parseDay(post)
  assert.strictEqual(d.title, undefined)
  assert.deepStrictEqual(d.headings.map((h) => h.kind), ['fasl', 'topic'])
  assert.ok(d.takhrij.startsWith('أخرجه'))
  assert.strictEqual(d.urdu.split('\n').length, 2)
})

test('a footnote mark makes a takhrij of any unvowelled Arabic', () => {
  const d = parseDay(sample.replace('أخرجه الطبراني', '(2) أبو نعيم'))
  assert.ok(d.takhrij.startsWith('أبو نعيم'))
  assert.ok(!d.arabic.includes('أبو نعيم'))
})

test('a fasl opened by Urdu prose alone is an introduction', () => {
  const fasl = sample.split('\n').slice(0, 2).join('\n')
  const d = parseDay(`${fasl}\n\nانسان کتنا ہی صحت مند کیوں نہ ہو، وہ دوسروں کا ضرورت مند رہتا ہے۔\n`)
  assert.strictEqual(d.kind, 'intro')
  assert.strictEqual(d.arabic, '')
  assert.deepStrictEqual(d.headings.map((h) => h.kind), ['fasl'])
  assert.ok(d.headings[0].ur)
  assert.ok(d.urdu.startsWith('انسان'))
})

test('a stray ")" before the takhrij does not hide it', () => {
  const d = parseDay(sample.replace('أخرجه', ') أخرجه'))
  assert.ok(d.takhrij.startsWith(') أخرجه'))
  assert.ok(!d.arabic.includes('أخرجه'))
})

test('a post quoting two Arabic blocks keeps both, with both translations', () => {
  const lines = sample.split('\n')
  const matn = lines.find((l) => l.startsWith('> 17.'))
  const text = sample.replace('> 17. ', '> 1, ') + '\n> 2, ' + matn.slice(6) + '\n\n10. ' + 'دوسرا ترجمہ ہے۔\n'
  const d = parseDay(text)
  assert.strictEqual(d.n, 1)
  assert.strictEqual(d.arabic.split('\n').length, 2)
  assert.ok(d.arabic.split('\n')[1].startsWith('عَنْ'))
  assert.ok(d.urdu.endsWith('دوسرا ترجمہ ہے۔'))
})

test('a later block numbered "5 -" without ">" joins the Arabic too', () => {
  const lines = sample.split('\n')
  const matn = lines.find((l) => l.startsWith('> 17.')).slice(6)
  const text = sample.replace('> 17. ', '4 - ') + '\n5 - ' + matn + '\n\nدوسرا ترجمہ ہے۔\n'
  const d = parseDay(text)
  assert.strictEqual(d.n, 4)
  assert.strictEqual(d.arabic.split('\n').length, 2)
  assert.ok(d.urdu.endsWith('دوسرا ترجمہ ہے۔'))
})

test('two posts in one file stop the build', () => {
  assert.throws(() => parseDay(sample + '\n' + sample), /second/)
})

test('an Urdu line numbered like a hadith is not taken for one', () => {
  const text = sample.replace('> 17. ', '').replace('حضرت ابو', '23. حضرت ابو')
  assert.throws(() => parseDay(text), FileError)
})

test('a day without the Urdu stops the build', () => {
  const text = sample.split('\n').filter((l) => !/[ےں]/.test(l)).join('\n')
  assert.throws(() => parseDay(text), /Urdu/)
})

test('the index puts each day under its fasl, known by its letters alone', () => {
  const day = parseDay(sample)
  const fasl = day.headings.find((h) => h.kind === 'fasl')
  const bare = fasl.ar.replace(new RegExp(`[${ch(0x064b)}-${ch(0x065f)}${ch(0x0670)}]`, 'g'), '')
  const other = { ...day, headings: [{ kind: 'fasl', ar: 'فَصْلٌ آخَرُ', ur: 'دوسری فصل' }], title: 'Another' }
  const plain = { ...day, headings: [] }
  const { chapters, days } = buildIndex([
    { date: '2026-10-01', ...day },
    { date: '2026-10-02', ...other },
    { date: '2026-10-03', ...plain },
    { date: '2026-10-04', ...day, headings: [{ ...fasl, ar: bare }] },
  ])
  assert.strictEqual(chapters.length, 2)
  assert.deepStrictEqual(days.map((d) => d.chapter), [0, 1, 1, 0])
  assert.strictEqual(days[1].title, 'Another')
  assert.strictEqual(days[1].name, 'دوسری فصل')
  assert.strictEqual(days[2].name, day.urdu.split('\n')[0])
  assert.ok(!('title' in days[0]) || days[0].title === day.title)
})
