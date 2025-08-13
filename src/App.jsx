import React, { useEffect, useMemo, useRef, useState } from 'react'
import bundledQuestions from './data/questions.json';

// ------- Configurable card sizing -------
const CARD_MIN_H = 240         // base min height (px) when showing the question
const CARD_EXPANDED_MIN_H = 360 // expanded min height (px) when revealing the answer

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function normalizeRecords(rows) {
  const mapKey = (k) => {
    const s = String(k || '').trim().toLowerCase()
    if (s.includes('company')) return 'Company'
    if (s.includes('question')) return 'Question'
    if (s.includes('answer')) return 'Answer'
    if (s.includes('behav')) return 'Type'
    if (s.includes('techn') || s === 'type') return 'Type'
    return k
  }
  return rows
    .map((r) => {
      const out = { Company: '', Type: '', Question: '', Answer: '' }
      for (const [k, v] of Object.entries(r)) {
        const kk = mapKey(k)
        if (kk in out) out[kk] = v == null ? '' : String(v)
      }
      return out
    })
    .filter((r) => r.Question && r.Answer)
}

// NEW: split a Company cell into multiple companies (comma/semicolon/newline separated)
function splitCompanies(value) {
  const raw = String(value || '')
  return raw
    .split(/[;,\n]/g)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

export default function App() {
  const [allData, setAllData] = useState([])
  const [company, setCompany] = useState('all')
  const [type, setType] = useState('all')
  const [sortBy, setSortBy] = useState('none')
  const [randomized, setRandomized] = useState(false)

  // Views
  const [singleView, setSingleView] = useState(false) // one card at a time with Prev/Next
  const [studyMode, setStudyMode] = useState(false)   // run-through mode (adds autoplay)

  // Card interaction
  const [revealAnswer, setRevealAnswer] = useState(false)
  const [index, setIndex] = useState(0)
  const [autoplay, setAutoplay] = useState(false)
  const [autoplaySeconds, setAutoplaySeconds] = useState(6)
  const [error, setError] = useState('')
  const timerRef = useRef(null)

  // Load default dataset from /public/questions.json (relative path works on GitHub Pages)
  useEffect(() => {
    // Always load the bundled data so the GitHub-hosted build has Q&A baked in
    setAllData(normalizeRecords(bundledQuestions));
  }, []);

  // Build the selectable company list by splitting multi-company cells
  const companies = useMemo(() => {
    const set = new Set()
    for (const d of allData) splitCompanies(d.Company).forEach((c) => set.add(c))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [allData])

  const filtered = useMemo(() => {
    let list = allData.filter((d) => {
      const comps = splitCompanies(d.Company)
      const matchCompany = company === 'all' || comps.includes(company)
      const t = String(d.Type || '').toLowerCase()
      const normalizedType = t.includes('behav') ? 'behavioral' : t.includes('tech') ? 'technical' : t || ''
      const matchType = type === 'all' || normalizedType === type
      return matchCompany && matchType
    })

    if (sortBy !== 'none') {
      const cmp = (a, b, k) => String(a[k] || '').localeCompare(String(b[k] || ''))
      if (sortBy === 'company') list = [...list].sort((a, b) => cmp(a, b, 'Company'))
      if (sortBy === 'type') list = [...list].sort((a, b) => cmp(a, b, 'Type'))
      if (sortBy === 'question') list = [...list].sort((a, b) => cmp(a, b, 'Question'))
    }

    if (randomized) list = shuffleArray(list)
    return list
  }, [allData, company, type, sortBy, randomized])

  // Reset position when the filtered list or view changes
  useEffect(() => {
    setIndex(0)
    setRevealAnswer(false)
  }, [filtered, singleView])

  // Autoplay: reveal then advance (studyMode only)
  useEffect(() => {
    if (!studyMode || !autoplay) return
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      setRevealAnswer((r) => {
        if (!r) return true
        setIndex((i) => (i + 1) % Math.max(filtered.length, 1))
        return false
      })
    }, autoplaySeconds * 1000)
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [studyMode, autoplay, autoplaySeconds, revealAnswer, index, filtered.length])

  const current = filtered[index] || null

  async function onUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    try {
      const ext = file.name.toLowerCase().split('.').pop()

      if (ext === 'json') {
        const text = await file.text()
        setAllData(normalizeRecords(JSON.parse(text)))
        return
      }

      if (ext === 'csv') {
        const text = await file.text()
        const { data } = Papa.parse(text, { header: true, skipEmptyLines: true })
        setAllData(normalizeRecords(data))
        return
      }

      throw new Error('Please upload a CSV or JSON file.')
    } catch (err) {
      console.error(err)
      setError('Failed to read that file. Please upload CSV or JSON with columns Company, Type, Question, Answer.')
    }
  }

  function downloadJSON() {
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'questions.json'
    a.click()
  }

  // Reusable single-card navigation bar
  function SingleCardNav({ compact = false }) {
    return (
      <div className={`flex items-center justify-center gap-2 ${compact ? '' : 'mt-2'}`}>
        <button
          className="px-3 py-1.5 border rounded-xl bg-white hover:bg-gray-50"
          onClick={() => {
            setIndex((i) => Math.max(0, i - 1))
            setRevealAnswer(false)
          }}
        >
          Prev
        </button>
        <button
          className="px-3 py-1.5 border rounded-xl bg-white hover:bg-gray-50"
          onClick={() => setRevealAnswer((r) => !r)}
        >
          {revealAnswer ? 'Hide Answer' : 'Show Answer'}
        </button>
        <button
          className="px-3 py-1.5 border rounded-xl bg-white hover:bg-gray-50"
          onClick={() => {
            setIndex((i) => (i + 1) % Math.max(filtered.length, 1))
            setRevealAnswer(false)
          }}
        >
          Next
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Interview Flashcards</h1>
            <p className="text-sm text-gray-600 mt-1">Load your CSV/JSON, then filter, sort, shuffle, and study.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 text-sm bg-white border rounded-xl px-3 py-2 shadow-sm">
              <input type="file" accept=".csv,.json" onChange={onUpload} className="w-56" />
            </label>
            <button
              className="px-3 py-2 border rounded-xl bg-white hover:bg-gray-50"
              onClick={() => {
                setCompany('all'); setType('all'); setSortBy('none'); setRandomized(false)
              }}
            >
              Reset
            </button>
            <button className="px-3 py-2 border rounded-xl bg-white hover:bg-gray-50" onClick={downloadJSON}>
              Download JSON
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="text-xs text-gray-600">Company</label>
            <select
              className="w-full border rounded-xl bg-white px-3 py-2"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            >
              <option value="all">All companies</option>
              {companies.map((c) => (
                <option key={c} value={c}>{c || '(blank)'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600">Type</label>
            <select
              className="w-full border rounded-xl bg-white px-3 py-2"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="all">All</option>
              <option value="technical">Technical</option>
              <option value="behavioral">Behavioral</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600">Sort by</label>
            <select
              className="w-full border rounded-xl bg-white px-3 py-2"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="none">None</option>
              <option value="company">Company (A→Z)</option>
              <option value="type">Type (A→Z)</option>
              <option value="question">Question (A→Z)</option>
            </select>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-xl border bg-white">
            <input id="rand" type="checkbox" checked={randomized} onChange={(e) => setRandomized(e.target.checked)} />
            <label htmlFor="rand" className="text-sm">Randomize</label>
          </div>
        </section>

        <section className="flex flex-wrap items-center gap-2 text-sm">
          <div className="px-2 py-1 rounded-full bg-gray-200 inline-flex items-center gap-2">
            <span>{filtered.length}</span><span>cards</span>
          </div>

          <button className="px-3 py-1.5 border rounded-xl bg-white hover:bg-gray-50"
            onClick={() => setAllData(shuffleArray(allData))}
          >
            Shuffle dataset
          </button>

          {/* toggle single-card view */}
          <label className="px-3 py-1.5 border rounded-xl bg-white hover:bg-gray-50 inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={singleView} onChange={(e) => { setSingleView(e.target.checked); setStudyMode(false); }} />
            Single Card View
          </label>

          <button className="px-3 py-1.5 border rounded-xl bg-white hover:bg-gray-50"
            onClick={() => { setStudyMode(true); setSingleView(false); setIndex(0); setRevealAnswer(false) }}
          >
            Run Through It All
          </button>
        </section>

        {/* STUDY MODE: single-card + autoplay controls */}
        {studyMode && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">Card {filtered.length ? index + 1 : 0} / {filtered.length}</div>
              <div className="flex items-center gap-4">
                <label className="text-sm flex items-center gap-2">
                  <input type="checkbox" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} />
                  Autoplay
                </label>
                <label className="text-xs text-gray-600 flex items-center gap-2">
                  Interval: {autoplaySeconds}s
                  <input type="range" min="3" max="15" value={autoplaySeconds}
                    onChange={(e) => setAutoplaySeconds(parseInt(e.target.value))}
                  />
                </label>
                <button className="px-3 py-1.5 border rounded-xl bg-white hover:bg-gray-50" onClick={() => setStudyMode(false)}>Exit</button>
              </div>
            </div>

            <div className="grid grid-cols-1">
              {current ? (
                <FlashCard
                  key={index}
                  qa={current}
                  reveal={revealAnswer}
                  onToggle={() => setRevealAnswer((r) => !r)}
                  baseMin={CARD_MIN_H}
                  expandedMin={CARD_EXPANDED_MIN_H}
                />
              ) : (
                <div className="text-center text-gray-500 p-8 border rounded-xl bg-white">No cards match your filters.</div>
              )}
            </div>

            <SingleCardNav />
          </div>
        )}

        {/* SINGLE VIEW (no autoplay): one card at a time with Prev/Next */}
        {!studyMode && singleView && (
          <div className="space-y-3">
            <div className="text-sm text-gray-600">Card {filtered.length ? index + 1 : 0} / {filtered.length}</div>
            <div className="grid grid-cols-1">
              {current ? (
                <FlashCard
                  key={index}
                  qa={current}
                  reveal={revealAnswer}
                  onToggle={() => setRevealAnswer((r) => !r)}
                  baseMin={CARD_MIN_H}
                  expandedMin={CARD_EXPANDED_MIN_H}
                />
              ) : (
                <div className="text-center text-gray-500 p-8 border rounded-xl bg-white">No cards match your filters.</div>
              )}
            </div>
            <SingleCardNav compact />
          </div>
        )}

        {/* GRID VIEW: all cards visible, consistent base height */}
        {!studyMode && !singleView && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((qa, i) => (
              <FlashCard key={i} qa={qa} baseMin={CARD_MIN_H} expandedMin={CARD_EXPANDED_MIN_H} />
            ))}
          </div>
        )}

        {error && <div className="p-3 rounded-md bg-red-50 text-red-700 border">{error}</div>}
      </div>
    </div>
  )
}

function FlashCard({ qa, reveal, onToggle, baseMin = CARD_MIN_H, expandedMin = CARD_EXPANDED_MIN_H }) {
  const [flipped, setFlipped] = useState(false)
  const isRevealed = reveal ?? flipped

  // Height logic: same size when showing question; expands when revealing answer
  const minHeight = isRevealed ? expandedMin : baseMin

  const companyLabel = splitCompanies(qa.Company).join(' • ')

  return (
    <div
      className="flip-container cursor-pointer"
      onClick={() => (onToggle ? onToggle() : setFlipped(!flipped))}
      style={{ minHeight }}
    >
      <div className="relative flip-inner" style={{ transform: `rotateY(${isRevealed ? 180 : 0}deg)` }}>
        {/* Front (Question) */}
        <div
          className="rounded-2xl border bg-white shadow-sm p-4 flex flex-col gap-2 flip-front absolute inset-0"
          style={{ minHeight }}
        >
          <div className="text-xs uppercase tracking-wide text-gray-500">
            {companyLabel || '(No company)'} • {qa.Type || 'Type'}
          </div>
          <div className="text-lg font-semibold leading-snug line-clamp-6">{qa.Question}</div>
          <div className="text-xs text-gray-500 mt-auto">Click to reveal answer</div>
        </div>

        {/* Back (Answer) */}
        <div
          className="rounded-2xl border bg-white shadow-sm p-4 flex flex-col gap-2 flip-back"
          style={{ minHeight }}
        >
          <div className="text-xs uppercase tracking-wide text-gray-500">Answer</div>
          <div className="text-base leading-relaxed whitespace-pre-wrap">{qa.Answer || '(No answer provided)'}</div>
          <div className="text-xs text-gray-500 mt-2">Click to flip back</div>
        </div>
      </div>
    </div>
  )
}
