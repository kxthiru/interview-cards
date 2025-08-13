import React, { useEffect, useMemo, useRef, useState } from 'react'
import bundledQuestions from './data/questions.json'

// ------- Configurable card sizing -------
const CARD_MIN_H = 260        // base min height (px) when showing the question
const CARD_EXPANDED_MIN_H = 400 // expanded min height (px) when revealing the answer
const SWIPE_THRESHOLD = 50     // px swipe distance to trigger next/prev

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

function splitCompanies(value) {
  const raw = String(value || '')
  return raw
    .split(/[;,\n]/g)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

export default function App() {
  // Data & filters
  const [allData, setAllData] = useState([])
  const [company, setCompany] = useState('all')
  const [type, setType] = useState('all')
  const [sortBy, setSortBy] = useState('none')
  const [randomized, setRandomized] = useState(false)

  // Views — default to SINGLE CARD view
  const [singleView, setSingleView] = useState(true) // default ON

  // Card interaction
  const [revealAnswer, setRevealAnswer] = useState(false)
  const [index, setIndex] = useState(0)
  const [error, setError] = useState('')

  // Touch/swipe state
  const touchStartX = useRef(null)
  const touchDeltaX = useRef(0)

  // Always load bundled data (works on GitHub Pages)
  useEffect(() => {
    setAllData(normalizeRecords(bundledQuestions))
  }, [])

  // Build company list from split tags
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

  // Reset position when list/view changes
  useEffect(() => {
    setIndex(0)
    setRevealAnswer(false)
  }, [filtered, singleView])

  const current = filtered[index] || null

  function prevCard() {
    if (!filtered.length) return
    setIndex((i) => (i - 1 + filtered.length) % filtered.length)
    setRevealAnswer(false)
  }
  function nextCard() {
    if (!filtered.length) return
    setIndex((i) => (i + 1) % filtered.length)
    setRevealAnswer(false)
  }

  // --- Mobile swipe handlers (works in Safari) ---
  function onTouchStart(e) {
    touchStartX.current = e.touches?.[0]?.clientX ?? null
    touchDeltaX.current = 0
  }
  function onTouchMove(e) {
    if (touchStartX.current == null) return
    touchDeltaX.current = (e.touches?.[0]?.clientX ?? 0) - touchStartX.current
  }
  function onTouchEnd() {
    if (touchStartX.current == null) return
    const dx = touchDeltaX.current
    touchStartX.current = null
    touchDeltaX.current = 0
    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      if (dx < 0) nextCard() // swipe left → next
      else prevCard()        // swipe right → prev
    }
  }

  // Keyboard shortcuts (desktop): ← → for prev/next, Space toggles reveal
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') nextCard()
      if (e.key === 'ArrowLeft') prevCard()
      if (e.code === 'Space') { e.preventDefault(); setRevealAnswer((r) => !r) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filtered.length])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Interview Flashcards</h1>
            <p className="text-sm text-gray-600 mt-1">Filter, sort, shuffle, and study. Swipe on mobile.</p>
          </div>
          {/* Toggle between single and multi-card view (default single) */}
          <div className="flex items-center gap-2">
            <label className="px-3 py-1.5 border rounded-xl bg-white inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!singleView}
                onChange={(e) => setSingleView(!e.target.checked)}
              />
              Multiple Cards (Grid)
            </label>
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
        </section>

        {/* SINGLE VIEW (default): one card with swipe + prev/next */}
        {singleView && (
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
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                />
              ) : (
                <div className="text-center text-gray-500 p-8 border rounded-xl bg-white">No cards match your filters.</div>
              )}
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                className="px-4 py-2 border rounded-xl bg-white hover:bg-gray-50 active:scale-[0.99]"
                onClick={prevCard}
              >
                Prev
              </button>
              <button
                className="px-4 py-2 border rounded-xl bg-white hover:bg-gray-50 active:scale-[0.99]"
                onClick={() => setRevealAnswer((r) => !r)}
              >
                {revealAnswer ? 'Hide Answer' : 'Show Answer'}
              </button>
              <button
                className="px-4 py-2 border rounded-xl bg-white hover:bg-gray-50 active:scale-[0.99]"
                onClick={nextCard}
              >
                Next
              </button>
            </div>
            <p className="text-center text-xs text-gray-500">Tip: swipe left/right on the card on mobile</p>
          </div>
        )}

        {/* GRID VIEW (optional): all cards visible, consistent base height */}
        {!singleView && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

function FlashCard({ qa, reveal, onToggle, baseMin = CARD_MIN_H, expandedMin = CARD_EXPANDED_MIN_H, onTouchStart, onTouchMove, onTouchEnd }) {
  const [flipped, setFlipped] = useState(false)
  const isRevealed = reveal ?? flipped

  // Height logic: same size when showing question; expands when revealing answer
  const minHeight = isRevealed ? expandedMin : baseMin
  const companyLabel = splitCompanies(qa.Company).join(' • ')

  return (
    <div
      className="flip-container cursor-pointer select-none"
      onClick={() => (onToggle ? onToggle() : setFlipped(!flipped))}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
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
          <div className="text-base sm:text-lg font-semibold leading-snug whitespace-pre-wrap">{qa.Question}</div>
          <div className="text-xs text-gray-500 mt-auto">Tap to reveal answer</div>
        </div>

        {/* Back (Answer) */}
        <div
          className="rounded-2xl border bg-white shadow-sm p-4 flex flex-col gap-2 flip-back"
          style={{ minHeight }}
        >
          <div className="text-xs uppercase tracking-wide text-gray-500">Answer</div>
          <div className="text-base leading-relaxed whitespace-pre-wrap">{qa.Answer || '(No answer provided)'}</div>
          <div className="text-xs text-gray-500 mt-2">Tap to flip back</div>
        </div>
      </div>
    </div>
  )
}
