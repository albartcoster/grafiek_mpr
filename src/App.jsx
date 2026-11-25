import { useMemo, useState } from 'react'
import * as d3 from 'd3'
import { data } from '../data/data.js'
import LactationChart, { METRICS } from './LactationChart.jsx'
import './App.css'

// ISO dates (YYYY-MM-DD) compare correctly as strings
const [MIN_DATE, MAX_DATE] = d3.extent(data, (d) => d.date_time)

const monthsBefore = (iso, months) => {
  const d = new Date(iso)
  d.setMonth(d.getMonth() - months)
  return d.toISOString().slice(0, 10)
}

const PRESETS = [
  { label: 'All', from: MIN_DATE },
  { label: 'Last 12 months', from: monthsBefore(MAX_DATE, 12) },
  { label: 'Last 6 months', from: monthsBefore(MAX_DATE, 6) },
  { label: 'Last 3 months', from: monthsBefore(MAX_DATE, 3) },
]

const buttonStyle = (active) => ({
  padding: '6px 14px',
  cursor: 'pointer',
  border: '1px solid #888',
  borderRadius: 6,
  background: active ? '#333' : 'transparent',
  color: active ? '#fff' : 'inherit',
})

function App() {
  const [metric, setMetric] = useState('production')
  const [from, setFrom] = useState(MIN_DATE)
  const [to, setTo] = useState(MAX_DATE)
  const [cowId, setCowId] = useState(null)

  const filtered = useMemo(
    () => data.filter((d) => d.date_time >= from && d.date_time <= to),
    [from, to],
  )

  const cowTests = useMemo(() => filtered.filter((d) => d.pedigree_id === cowId), [filtered, cowId])

  return (
    <main style={{ padding: '1rem' }}>
      <h1>{METRICS[metric].label} by days in milk</h1>

      <div role="group" aria-label="Select measurement" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {Object.entries(METRICS).map(([key, { label }]) => (
          <button key={key} type="button" aria-pressed={metric === key} onClick={() => setMetric(key)} style={buttonStyle(metric === key)}>
            {label}
          </button>
        ))}
      </div>

      <div role="group" aria-label="Select date range" style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setFrom(p.from)
              setTo(MAX_DATE)
            }}
            style={buttonStyle(from === p.from && to === MAX_DATE)}
          >
            {p.label}
          </button>
        ))}
        <label>
          From{' '}
          <input type="date" value={from} min={MIN_DATE} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        </label>
        <label>
          to{' '}
          <input type="date" value={to} min={from} max={MAX_DATE} onChange={(e) => e.target.value && setTo(e.target.value)} />
        </label>
      </div>

      <p>
        {filtered.length} test-day records
        {cowId == null ? ' · click a dot to select a cow' : ''}
      </p>
      {cowId != null && (
        <p>
          <strong>Cow {cowId}</strong>: {cowTests.length} test days in this range
          <button type="button" onClick={() => setCowId(null)} style={{ ...buttonStyle(false), marginLeft: 12 }}>
            Clear selection
          </button>
        </p>
      )}
      <LactationChart data={filtered} metric={metric} selectedId={cowId} onSelect={setCowId} />
    </main>
  )
}

export default App
