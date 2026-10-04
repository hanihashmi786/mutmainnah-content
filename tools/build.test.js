// node --test tools/
// The shapes a pasted day can arrive in, and the ones that must stop the build.

const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { parseDay, FileError } = require('./build')

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

test('a day without the hadith number stops the build', () => {
  assert.throws(() => parseDay(sample.replace('17. ', '')), FileError)
})

test('a day without the Urdu stops the build', () => {
  const text = sample.split('\n').filter((l) => !/[ےں]/.test(l)).join('\n')
  assert.throws(() => parseDay(text), /Urdu/)
})
