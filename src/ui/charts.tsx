import { formatBRL } from '../domain/money'

export interface Bar { label: string; values: number[] }

/** Barras agrupadas feitas com divs: leves e funcionam sem internet. */
export function BarChart({ title, bars, colors, legend, height = 120 }: {
  title: string; bars: Bar[]; colors: string[]; legend?: string[]; height?: number
}) {
  const max = Math.max(1, ...bars.flatMap(b => b.values.map(Math.abs)))
  // Rótulos espaçados para não se sobreporem: no máximo uns 8.
  const step = Math.max(1, Math.ceil(bars.length / 8))
  return (
    <figure className="chart" style={{ margin: 0 }}>
      <div role="img" aria-label={title} className="chart-bars" style={{ height }}>
        {bars.map((b, i) => (
          <div key={i} className="chart-group" title={`${b.label}: ${b.values.map(v => formatBRL(v)).join(' / ')}`}>
            {b.values.map((v, j) => (
              <span key={j} style={{ height: `${v > 0 ? Math.max(2, (v / max) * 100) : 0}%`, background: colors[j] }} />
            ))}
          </div>
        ))}
      </div>
      <div className="chart-labels">
        {bars.map((b, i) => <span key={i}>{i % step === 0 ? b.label : ''}</span>)}
      </div>
      {legend && (
        <figcaption className="chart-legend">
          {legend.map((l, i) => <span key={l}><i style={{ background: colors[i] }} />{l}</span>)}
        </figcaption>
      )}
    </figure>
  )
}
