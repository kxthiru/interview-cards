import React, { useEffect, useMemo, useRef, useState } from 'react'
import bundledQuestions from './data/questions.json'

// ------- Configurable card sizing / interactions -------
const CARD_MIN_H = 280         // base min height (px) when showing the question
const CARD_EXPANDED_MIN_H = 420 // expanded min height (px) when revealing the answer
const SWIPE_THRESHOLD = 50      // px swipe distance to trigger next/prev

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

// Split a Company cell into multiple companies (comma/semicolon/newline)
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
  const [singleView, setSingleView] = useState(true)

  // Card interaction
  const [revealAnswer, setRevealAnswer] = useState(false)
  const [index, setIndex] = useState(0)

  // UI state
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Touch/swipe state
  const touchStartX = useRef(null)
  const touchDeltaX = useRef(0)

  // Load bundled data so GitHub Pages always has content
  useEffect(() => {
    setAllData(normalizeRecords(bundledQuestions))
  }, [])

  // Build company list from split company tags
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

  // --- Mobile swipe handlers (Safari-friendly) ---
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
    <div className="min-h-screen text-slate-100 bg-[radial-gradient(1200px_600px_at_-10%_-10%,#1f2937_0%,transparent_60%),radial-gradient(800px_400px_at_120%_-20%,#0ea5e9_0%,transparent_50%),radial-gradient(700px_400px_at_50%_120%,#9333ea_0%,transparent_40%)] bg-slate-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-10 space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-white/10 border border-white/20 backdrop-blur" />
            <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight">Interview Flashcards</h1>
          </div>

          {/* Right controls: mobile icon buttons, desktop inline */}
          <div className="flex items-center gap-2">
            {/* Mobile: filter FAB */}
            <button
              className="md:hidden h-10 w-10 rounded-xl bg-white/10 border border-white/20 backdrop-blur flex items-center justify-center active:scale-95"
              onClick={() => setFiltersOpen(true)}
              aria-label="Open filters"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12 10 19 14 21 14 12 22 3"></polygon></svg>
            </button>

            {/* Desktop: toggle grid */}
            <label className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/20 backdrop-blur cursor-pointer select-none">
              <input type="checkbox" className="accent-cyan-400" checked={!singleView} onChange={(e) => setSingleView(!e.target.checked)} />
              <span className="text-sm">Multiple Cards</span>
            </label>
          </div>
        </header>

        {/* Desktop filters row */}
        <section className="hidden md:grid grid-cols-12 gap-3">
          <div className="col-span-5">
            <label className="text-xs text-slate-300">Company</label>
            <select className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 backdrop-blur"
              value={company} onChange={(e) => setCompany(e.target.value)}>
              <option value="all">All companies</option>
              {companies.map((c) => <option key={c} value={c}>{c || '(blank)'}</option>)}
            </select>
          </div>
          <div className="col-span-3">
            <label className="text-xs text-slate-300">Type</label>
            <select className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 backdrop-blur"
              value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">All</option>
              <option value="technical">Technical</option>
              <option value="behavioral">Behavioral</option>
            </select>
          </div>
          <div className="col-span-3">
            <label className="text-xs text-slate-300">Sort by</label>
            <select className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 backdrop-blur"
              value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="none">None</option>
              <option value="company">Company (A→Z)</option>
              <option value="type">Type (A→Z)</option>
              <option value="question">Question (A→Z)</option>
            </select>
          </div>
          <div className="col-span-1 flex items-end">
            <label className="w-full h-[42px] px-3 py-2 rounded-xl bg-white/10 border border-white/20 backdrop-blur inline-flex items-center gap-2 cursor-pointer select-none">
              <input id="rand" type="checkbox" className="accent-cyan-400" checked={randomized} onChange={(e) => setRandomized(e.target.checked)} />
              <span className="text-sm">Shuffle</span>
            </label>
          </div>
        </section>

        {/* Stats & view toggle (compact) */}
        <section className="flex items-center gap-2 text-sm">
          <div className="px-2 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur inline-flex items-center gap-2">
            <span>{filtered.length}</span><span className="text-slate-300">cards</span>
          </div>
          <label className="md:hidden ml-auto px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 backdrop-blur inline-flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" className="accent-cyan-400" checked={!singleView} onChange={(e) => setSingleView(!e.target.checked)} />
            <span>Grid</span>
          </label>
        </section>

        {/* SINGLE VIEW (default): one card with swipe + prev/next */}
        {singleView && (
          <div className="space-y-4">
            <div className="text-xs text-slate-300">Card {filtered.length ? index + 1 : 0} / {filtered.length}</div>
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
                <div className="text-center text-slate-300 p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur">No cards match your filters.</div>
              )}
            </div>

            <div className="flex items-center justify-center gap-3">
              <button className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 backdrop-blur hover:bg-white/15 active:scale-[0.99]" onClick={prevCard}>Prev</button>
              <button className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 backdrop-blur hover:bg-white/15 active:scale-[0.99]" onClick={() => setRevealAnswer((r) => !r)}>{revealAnswer ? 'Hide Answer' : 'Show Answer'}</button>
              <button className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 backdrop-blur hover:bg-white/15 active:scale-[0.99]" onClick={nextCard}>Next</button>
            </div>
            <p className="text-center text-xs text-slate-400">Swipe left/right on the card (mobile)</p>
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
      </div>

      {/* Mobile Filters Bottom Sheet */}
      {filtersOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setFiltersOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-slate-900/80 backdrop-blur border-t border-white/10 p-4 pb-[env(safe-area-inset-bottom)]">
            <div className="mx-auto max-w-6xl">
              <div className="flex items-center justify-between mb-3">
                <div className="h-1.5 w-12 rounded-full bg-white/20 mx-auto" />
                <button className="h-9 w-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center" onClick={() => setFiltersOpen(false)} aria-label="Close">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-xs text-slate-300">Company</label>
                  <select className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 backdrop-blur"
                          value={company} onChange={(e) => setCompany(e.target.value)}>
                    <option value="all">All companies</option>
                    {companies.map((c) => <option key={c} value={c}>{c || '(blank)'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-300">Type</label>
                  <select className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 backdrop-blur"
                          value={type} onChange={(e) => setType(e.target.value)}>
                    <option value="all">All</option>
                    <option value="technical">Technical</option>
                    <option value="behavioral">Behavioral</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-300">Sort by</label>
                  <select className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 backdrop-blur"
                          value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    <option value="none">None</option>
                    <option value="company">Company (A→Z)</option>
                    <option value="type">Type (A→Z)</option>
                    <option value="question">Question (A→Z)</option>
                  </select>
                </div>
                <label className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 backdrop-blur inline-flex items-center gap-2 cursor-pointer select-none">
                  <input id="rand2" type="checkbox" className="accent-cyan-400" checked={randomized} onChange={(e) => setRandomized(e.target.checked)} />
                  <span className="text-sm">Shuffle</span>
                </label>
                <button className="mt-1 w-full px-4 py-2 rounded-xl bg-cyan-500 text-slate-900 font-medium active:scale-[0.99]" onClick={() => setFiltersOpen(false)}>Apply</button>
              </div>
            </div>
          </div>
        </div>
      )}
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
      <div className="relative flip-inner transition-transform duration-500" style={{ transform: `rotateY(${isRevealed ? 180 : 0}deg)` }}>
        {/* Front (Question) */}
        <div
          className="rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-2xl ring-1 ring-white/10 p-5 sm:p-6 flex flex-col gap-3 flip-front absolute inset-0"
          style={{ minHeight }}
        >
          <div className="text-xs uppercase tracking-wide text-slate-300">
            {companyLabel || '(No company)'} • {qa.Type || 'Type'}
          </div>
          <div className="text-lg sm:text-xl font-semibold leading-snug whitespace-pre-wrap">
            {qa.Question}
          </div>
          <div className="text-xs text-slate-400 mt-auto">Tap to reveal answer</div>
        </div>

        {/* Back (Answer) */}
        <div
          className="rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-2xl ring-1 ring-white/10 p-5 sm:p-6 flex flex-col gap-3 flip-back"
          style={{ minHeight }}
        >
          <div className="text-xs uppercase tracking-wide text-slate-300">Answer</div>
          <div className="text-base leading-relaxed whitespace-pre-wrap">{qa.Answer || '(No answer provided)'}</div>
          <div className="text-xs text-slate-400 mt-2">Tap to flip back</div>
        </div>
      </div>
    </div>
  )
}
