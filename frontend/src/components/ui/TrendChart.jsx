// ── TrendChart ───────────────────────────────────────────────────────
/**
 * Zero-dependency SVG polyline chart.
 * Renders weight, body-fat %, and adherence % series from progress entries.
 *
 * Requires at least 2 data points with weight or body_fat data to render;
 * otherwise shows an empty-state prompt.
 */
export function TrendChart({ entries }) {
  const W   = 340;
  const H   = 110;
  const PAD = { t: 10, r: 10, b: 24, l: 34 };
  const IW  = W - PAD.l - PAD.r;
  const IH  = H - PAD.t - PAD.b;

  // Only include entries that carry at least one plottable value
  const pts = entries.filter(e => e.weight != null || e.body_fat_percentage != null);

  if (pts.length < 2) {
    return (
      <div className="chart-container">
        <div className="chart-title">Progress Trend</div>
        <div className="chart-empty">
          <span style={{ fontSize: "24px", opacity: 0.4 }}>📈</span>
          Log at least 2 progress entries to see the trend chart.
        </div>
      </div>
    );
  }

  /** Build a normalised polyline for a single data key. */
  function buildLine(key, data, color) {
    const vals = data.map(d => d[key]).filter(v => v != null);
    if (vals.length < 2) return null;

    const min   = Math.min(...vals);
    const max   = Math.max(...vals);
    const range = max - min || 1;
    const n     = data.length;

    const points = data
      .map((d, i) => {
        const v = d[key];
        if (v == null) return null;
        const x = PAD.l + (i / (n - 1)) * IW;
        const y = PAD.t + IH - ((v - min) / range) * IH;
        return { x, y, v };
      })
      .filter(Boolean);

    const poly = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    return { poly, points, min, max, color };
  }

  const weightLine = buildLine("weight",             pts, "#00e5ff");
  const bfLine     = buildLine("body_fat_percentage", pts, "#a3ff12");
  const adhereLine = buildLine("adherence_score",    pts, "#a855f7");

  // Evenly-spaced x-axis date labels (up to 5)
  const labelIdxs = pts.length <= 5
    ? pts.map((_, i) => i)
    : [
        0,
        Math.round(pts.length / 4),
        Math.round(pts.length / 2),
        Math.round((3 * pts.length) / 4),
        pts.length - 1,
      ];
  const xLabels = labelIdxs.map(i => ({
    i,
    x: PAD.l + (i / (pts.length - 1)) * IW,
    label: pts[i].date?.slice(5), // MM-DD
  }));

  const series = [weightLine, bfLine, adhereLine].filter(Boolean);

  return (
    <div className="chart-container">
      <div className="chart-title">Progress Trend</div>

      <div className="chart-legend">
        {weightLine && (
          <span className="chart-legend-item">
            <span className="legend-dot" style={{ background: "#00e5ff", boxShadow: "0 0 6px #00e5ff" }} />
            Weight (kg)
          </span>
        )}
        {bfLine && (
          <span className="chart-legend-item">
            <span className="legend-dot" style={{ background: "#a3ff12", boxShadow: "0 0 6px #a3ff12" }} />
            Body fat %
          </span>
        )}
        {adhereLine && (
          <span className="chart-legend-item">
            <span className="legend-dot" style={{ background: "#a855f7", boxShadow: "0 0 6px #a855f7" }} />
            Adherence %
          </span>
        )}
      </div>

      <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} aria-label="Progress trend chart">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(f => (
          <line
            key={f}
            x1={PAD.l} y1={PAD.t + f * IH}
            x2={W - PAD.r} y2={PAD.t + f * IH}
            stroke="rgba(130,219,255,0.08)"
            strokeWidth="1"
          />
        ))}

        {/* Data series */}
        {series.map((line, i) => (
          <g key={i}>
            <polyline
              points={line.poly}
              fill="none"
              stroke={line.color}
              strokeWidth="2"
              strokeLinejoin="round"
              style={{ filter: `drop-shadow(0 0 4px ${line.color})` }}
            />
            {line.points.map((p, j) => (
              <circle
                key={j}
                cx={p.x} cy={p.y} r="3"
                fill={line.color}
                style={{ filter: `drop-shadow(0 0 4px ${line.color})` }}
              >
                <title>{p.v}</title>
              </circle>
            ))}
          </g>
        ))}

        {/* X-axis date labels */}
        {xLabels.map(({ x, label }, i) => (
          <text
            key={i} x={x} y={H - 4}
            textAnchor="middle"
            fill="rgba(122,150,188,0.8)"
            fontSize="9" fontFamily="inherit"
          >
            {label}
          </text>
        ))}

        {/* Y-axis max value hint */}
        {weightLine && (
          <text
            x={PAD.l - 2} y={PAD.t}
            textAnchor="end"
            fill="rgba(0,229,255,0.6)"
            fontSize="9" fontFamily="inherit"
          >
            {weightLine.max}
          </text>
        )}
      </svg>
    </div>
  );
}
