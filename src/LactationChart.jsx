import { useMemo } from 'react'
import * as d3 from 'd3'

const MARGIN = { top: 20, right: 20, bottom: 50, left: 55 }
const MAX_DIM = 400
const BIN = 15 // days per bin for the summary line

export const METRICS = {
  production: { label: 'Milk production', axis: 'Milk production (kg/day)', summary: d3.mean },
  protein_pct: { label: 'Protein', axis: 'Protein (%)', summary: d3.mean },
  fat_pct: { label: 'Fat', axis: 'Fat (%)', summary: d3.mean },
  // cell counts are very skewed: log scale and median per bin
  cells: { label: 'Somatic cell count', axis: 'SCC (x1000/ml, log scale)', summary: d3.median, log: true },
}

const GROUPS = [
  { key: '1', label: 'Lactation 1', color: '#1b9e77' },
  { key: '2', label: 'Lactation 2', color: '#d95f02' },
  { key: '3+', label: 'Lactation 3+', color: '#7570b3' },
]
const groupOf = (lactation) => (lactation >= 3 ? '3+' : String(lactation))
const colorOf = (lactation) => GROUPS.find((g) => g.key === groupOf(lactation)).color

export default function LactationChart({ data, metric = 'production', selectedId = null, onSelect = () => {}, width = 900, height = 500 }) {
  const innerW = width - MARGIN.left - MARGIN.right
  const innerH = height - MARGIN.top - MARGIN.bottom
  const m = METRICS[metric]

  const rows = useMemo(
    () =>
      data
        // 0 is not a real value for fat, protein and cell count
        .filter((d) => d[metric] != null && d[metric] > 0 && d.dim >= 0 && d.dim <= MAX_DIM)
        .map((d) => ({ id: d.pedigree_id, date: d.date_time, lactation: d.lactation, dim: d.dim, value: d[metric], group: groupOf(d.lactation) })),
    [data, metric],
  )

  const x = useMemo(() => d3.scaleLinear().domain([0, MAX_DIM]).range([0, innerW]), [innerW])
  const y = useMemo(() => {
    const max = d3.max(rows, (d) => d.value)
    return m.log
      ? d3.scaleLog().domain([Math.max(1, d3.min(rows, (d) => d.value)), max]).nice().range([innerH, 0])
      : d3.scaleLinear().domain([0, max]).nice().range([innerH, 0])
  }, [rows, innerH, m])
  const yTicks = m.log ? y.ticks().filter((t) => String(t)[0] === '1') : y.ticks(6)

  const lines = useMemo(() => {
    const line = d3
      .line()
      .x((d) => x(d.dim))
      .y((d) => y(d.value))
      .curve(d3.curveMonotoneX)
    return GROUPS.map((g) => {
      const points = d3
        .rollups(
          rows.filter((r) => r.group === g.key),
          (v) => ({ value: m.summary(v, (r) => r.value), n: v.length }),
          (r) => Math.floor(r.dim / BIN),
        )
        .filter(([, s]) => s.n >= 5) // skip bins with too few cows
        .sort((a, b) => a[0] - b[0])
        .map(([bin, s]) => ({ dim: bin * BIN + BIN / 2, value: s.value }))
      return { ...g, path: line(points) }
    })
  }, [rows, x, y, m])

  // the selected cow: her test days, one line per lactation
  const cow = useMemo(() => {
    if (selectedId == null) return null
    const pts = rows.filter((r) => r.id === selectedId).sort((a, b) => a.dim - b.dim)
    const line = d3.line().x((d) => x(d.dim)).y((d) => y(d.value))
    const byLact = d3.group(pts, (p) => p.lactation)
    const paths = [...byLact.entries()].map(([lactation, v]) => {
      const last = v[v.length - 1]
      return { lactation, d: line(v), color: colorOf(lactation), lx: x(last.dim), ly: y(last.value) }
    })
    return { pts, paths }
  }, [rows, selectedId, x, y])

  return (
    <svg width={width} height={height} role="img" aria-label={`${m.label} versus days in milk`}>
      <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
        {yTicks.map((t) => (
          <g key={t} transform={`translate(0,${y(t)})`}>
            <line x2={innerW} stroke="currentColor" strokeOpacity={0.12} />
            <text x={-8} dy="0.32em" textAnchor="end" fontSize={12} fill="currentColor">
              {t}
            </text>
          </g>
        ))}
        {x.ticks(8).map((t) => (
          <g key={t} transform={`translate(${x(t)},${innerH})`}>
            <line y2={6} stroke="currentColor" strokeOpacity={0.5} />
            <text y={20} textAnchor="middle" fontSize={12} fill="currentColor">
              {t}
            </text>
          </g>
        ))}
        <line x2={innerW} y1={innerH} y2={innerH} stroke="currentColor" strokeOpacity={0.5} />

        <text x={innerW / 2} y={innerH + 42} textAnchor="middle" fontSize={13} fill="currentColor">
          Days in milk (DIM)
        </text>
        <text
          transform={`translate(-40,${innerH / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize={13}
          fill="currentColor"
        >
          {m.axis}
        </text>

        {rows.map((r, i) => (
          <circle
            key={i}
            cx={x(r.dim)}
            cy={y(r.value)}
            r={2}
            fill={GROUPS.find((g) => g.key === r.group).color}
            fillOpacity={cow ? 0.07 : 0.15}
            stroke="transparent"
            strokeWidth={8}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelect(r.id === selectedId ? null : r.id)}
          />
        ))}

        {lines.map((l) => (
          <path key={l.key} d={l.path} fill="none" stroke={l.color} strokeWidth={3} />
        ))}

        {cow && (
          <g style={{ pointerEvents: 'none' }}>
            {cow.paths.map((p) => (
              <g key={p.lactation}>
                <path d={p.d} fill="none" stroke={p.color} strokeWidth={2} />
                <text x={p.lx + 8} y={p.ly} dy="0.32em" fontSize={12} fontWeight={600} fill={p.color}>
                  L{p.lactation}
                </text>
              </g>
            ))}
            {cow.pts.map((r, i) => (
              <circle key={i} cx={x(r.dim)} cy={y(r.value)} r={4} fill={colorOf(r.lactation)} stroke="#fff" strokeWidth={1} />
            ))}
          </g>
        )}

        {GROUPS.map((g, i) => (
          <g key={g.key} transform={`translate(${innerW - 130},${10 + i * 20})`}>
            <line x2={20} stroke={g.color} strokeWidth={3} />
            <text x={26} dy="0.32em" fontSize={12} fill="currentColor">
              {g.label}
            </text>
          </g>
        ))}
      </g>
    </svg>
  )
}
