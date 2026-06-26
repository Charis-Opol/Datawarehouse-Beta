import React, { useState, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Legend,
} from "recharts";

// ── Query manifest (must match the keys in ecowarehouse/analytics/queries.py) ──
const QUERIES = [
  { id: "top10_africa_gdp",      title: "Top 10 Africa GDP",    sub: "Latest year · 2023" },
  { id: "east_africa_gdp_trend", title: "East Africa Trend",    sub: "GDP 2000–2022" },
  { id: "eac_gdp_per_capita",    title: "EAC GDP Per Capita",   sub: "2022 · 6 countries" },
  { id: "africa_world_gdp_share",title: "Africa World Share",   sub: "By era" },
  { id: "fastest_growing_africa",title: "Fastest Growing",      sub: "CAGR 2010→2022" },
  { id: "uganda_profile",        title: "Uganda Profile",       sub: "2000–2022" },
];

// ── Colour palette ─────────────────────────────────────────────────────────────
const COUNTRY_COLORS = {
  Uganda:   "#7c6af7",
  Kenya:    "#00d4a8",
  Tanzania: "#f5a623",
  Rwanda:   "#ff5c5c",
  Ethiopia: "#3dd6f5",
  Burundi:  "#8b9467",
};
const ERA_COLORS = ["#3a3f5c", "#4a5882", "#7c6af7", "#00d4a8"];
const BAR_COLOR    = "#7c6af7";
const BAR_HI_COLOR = "#00d4a8";

// ── Shared Recharts style ─────────────────────────────────────────────────────
const TICK  = { fontSize: 11, fill: "var(--text-dim)" };
const TT_STYLE = {
  background:  "var(--surface)",
  border:      "1px solid var(--border-bright)",
  color:       "var(--text)",
  fontFamily:  "var(--mono)",
  fontSize:    12,
};

// ── Reusable wrappers ─────────────────────────────────────────────────────────
const ChartCard = ({ title, wide, children }) => (
  <div className={`chart-card${wide ? " wide" : ""}`}>
    <div className="chart-card-title">{title}</div>
    <ResponsiveContainer width="100%" height={280}>
      {children}
    </ResponsiveContainer>
  </div>
);

const DataTable = ({ data }) => {
  if (!data || data.length === 0) return null;
  const keys = Object.keys(data[0]);
  return (
    <div className="chart-card wide">
      <div className="chart-card-title">Raw data</div>
      <table className="data-table">
        <thead>
          <tr>{keys.map(k => <th key={k}>{k.replace(/_/g, " ")}</th>)}</tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {keys.map(k => (
                <td key={k} className={typeof row[k] === "number" ? "num" : ""}>
                  {row[k] == null ? "—" : typeof row[k] === "number"
                    ? row[k].toLocaleString()
                    : row[k]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── Chart components, one per query ──────────────────────────────────────────

/** Q1 — Top 10 African GDP */
const Top10Chart = ({ data }) => (
  <ChartCard title="GDP · Billion USD · 2023" wide>
    <BarChart data={data} layout="vertical" margin={{ left: 30, right: 50, top: 8, bottom: 8 }}>
      <XAxis type="number" dataKey="gdp_billion_usd" tick={TICK}
        tickFormatter={v => `$${v}B`} axisLine={false} tickLine={false} />
      <YAxis type="category" dataKey="country_name" width={110} tick={TICK}
        axisLine={false} tickLine={false} />
      <Tooltip contentStyle={TT_STYLE} formatter={v => [`$${v}B`, "GDP"]}
        cursor={{ fill: "rgba(255,255,255,0.03)" }} />
      <Bar dataKey="gdp_billion_usd" radius={[0, 4, 4, 0]}>
        {data.map((d, i) => (
          <Cell key={i}
            fill={d.sub_region === "Eastern Africa" ? BAR_HI_COLOR : BAR_COLOR} />
        ))}
      </Bar>
    </BarChart>
  </ChartCard>
);

/** Q2 — East Africa GDP trend (multi-line) */
const EastAfricaTrendChart = ({ data }) => {
  // Pivot from [{country_name, year, gdp_billion_usd}, …]
  //         to [{year, Uganda: x, Kenya: y, …}, …]
  const pivoted = Array.from(
    data.reduce((map, { year, country_name, gdp_billion_usd }) => {
      const entry = map.get(year) ?? { year };
      entry[country_name] = gdp_billion_usd;
      return map.set(year, entry);
    }, new Map()).values()
  );
  const countries = [...new Set(data.map(d => d.country_name))];

  return (
    <ChartCard title="GDP · Billion USD · 2000–2022" wide>
      <LineChart data={pivoted} margin={{ left: 0, right: 20 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="year" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis tick={TICK} tickFormatter={v => `$${v}B`} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={TT_STYLE} formatter={(v, name) => [`$${Number(v).toFixed(1)}B`, name]} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 15 }} />
        {countries.map(c => (
          <Line key={c} type="monotone" dataKey={c}
            stroke={COUNTRY_COLORS[c] ?? "#888"}
            strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ChartCard>
  );
};

/** Q3 — EAC GDP per capita */
const PerCapitaChart = ({ data }) => (
  <ChartCard title="GDP Per Capita · USD · 2022" wide>
    <BarChart data={data} layout="vertical" margin={{ left: 20, right: 60, top: 8, bottom: 8 }}>
      <XAxis type="number" dataKey="gdp_per_capita_usd" tick={TICK}
        tickFormatter={v => `$${v.toLocaleString()}`} axisLine={false} tickLine={false} />
      <YAxis type="category" dataKey="country_name" width={90} tick={TICK}
        axisLine={false} tickLine={false} />
      <Tooltip contentStyle={TT_STYLE}
        formatter={v => [`$${Number(v).toLocaleString()}`, "GDP per capita"]} />
      <Bar dataKey="gdp_per_capita_usd" radius={[0, 4, 4, 0]}>
        {data.map((d, i) => (
          <Cell key={i} fill={COUNTRY_COLORS[d.country_name] ?? BAR_COLOR} />
        ))}
      </Bar>
    </BarChart>
  </ChartCard>
);

/** Q4 — Africa world GDP share by era */
const WorldShareChart = ({ data }) => {
  const ordered = ["Pre-2000", "2000s", "2010s", "2020s"]
    .map(era => data.find(d => d.era === era))
    .filter(Boolean);

  return (
    <div className="chart-grid">
      <ChartCard title="Africa % of World GDP">
        <BarChart data={ordered} layout="vertical"
          margin={{ left: 60, right: 50, top: 8, bottom: 8 }}>
          <XAxis type="number" dataKey="africa_share_pct" tick={TICK}
            tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} domain={[0, 5]} />
          <YAxis type="category" dataKey="era" width={60} tick={TICK}
            axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TT_STYLE} formatter={v => [`${v}%`, "Africa share"]} />
          <Bar dataKey="africa_share_pct" radius={[0, 4, 4, 0]}>
            {ordered.map((d, i) => <Cell key={i} fill={ERA_COLORS[i]} />)}
          </Bar>
        </BarChart>
      </ChartCard>

      <ChartCard title="World GDP · Trillion USD (cumulative)">
        <BarChart data={ordered} margin={{ left: 10, right: 20, top: 8, bottom: 8 }}>
          <XAxis dataKey="era" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis tick={TICK} tickFormatter={v => `$${v}T`} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TT_STYLE}
            formatter={v => [`$${v}T`, "World GDP"]} />
          <Bar dataKey="world_gdp_trillion_usd" radius={[4, 4, 0, 0]}>
            {ordered.map((d, i) => <Cell key={i} fill={ERA_COLORS[i]} />)}
          </Bar>
        </BarChart>
      </ChartCard>
    </div>
  );
};

/** Q5 — Fastest growing African economies (CAGR) */
const FastestGrowingChart = ({ data }) => (
  <ChartCard title="CAGR 2010→2022 (%)" wide>
    <BarChart data={data} layout="vertical"
      margin={{ left: 40, right: 60, top: 8, bottom: 8 }}>
      <XAxis type="number" dataKey="cagr_pct" tick={TICK}
        tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
      <YAxis type="category" dataKey="country_name" width={130} tick={TICK}
        axisLine={false} tickLine={false} />
      <Tooltip contentStyle={TT_STYLE} formatter={v => [`${v}%`, "CAGR"]}
        cursor={{ fill: "rgba(255,255,255,0.03)" }} />
      <Bar dataKey="cagr_pct" radius={[0, 4, 4, 0]} fill={BAR_HI_COLOR} />
    </BarChart>
  </ChartCard>
);

/** Q6 — Uganda economic profile */
const UgandaProfileChart = ({ data }) => (
  <div className="chart-grid">
    <ChartCard title="GDP · Billion USD" wide>
      <AreaChart data={data} margin={{ left: 0, right: 20, top: 8, bottom: 8 }}>
        <defs>
          <linearGradient id="gdpGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#00d4a8" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#00d4a8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="year" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis tick={TICK} tickFormatter={v => `$${v}B`} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={TT_STYLE} formatter={v => [`$${v}B`, "GDP"]} />
        <Area type="monotone" dataKey="gdp_billion_usd"
          stroke="#00d4a8" fill="url(#gdpGrad)" strokeWidth={2} dot={false} />
      </AreaChart>
    </ChartCard>

    <ChartCard title="GDP Per Capita · USD">
      <LineChart data={data} margin={{ left: 10, right: 20, top: 8, bottom: 8 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="year" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis tick={TICK} tickFormatter={v => `$${v}`} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={TT_STYLE} formatter={v => [`$${v}`, "GDP/capita"]} />
        <Line type="monotone" dataKey="gdp_per_capita_usd"
          stroke="#f5a623" strokeWidth={2} dot={false} />
      </LineChart>
    </ChartCard>

    <ChartCard title="Population · Millions">
      <AreaChart data={data} margin={{ left: 10, right: 20, top: 8, bottom: 8 }}>
        <defs>
          <linearGradient id="popGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#7c6af7" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#7c6af7" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="year" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis tick={TICK} tickFormatter={v => `${v}M`} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={TT_STYLE} formatter={v => [`${v}M`, "Population"]} />
        <Area type="monotone" dataKey="population_millions"
          stroke="#7c6af7" fill="url(#popGrad)" strokeWidth={2} dot={false} />
      </AreaChart>
    </ChartCard>
  </div>
);

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [selectedIndex, setSelectedIndex]   = useState(0);
  const [queryState,    setQueryState]      = useState({ loading: true, error: null, data: [], meta: {} });
  const [sqlText,       setSqlText]         = useState("-- Loading SQL...");

  const selected = QUERIES[selectedIndex];

  // Fetch data from /api/data/{query_id}
  useEffect(() => {
    let cancelled = false;
    const t0 = Date.now();
    setQueryState({ loading: true, error: null, data: [], meta: {} });

    fetch(`/api/data/${selected.id}`)
      .then(res => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then(data => {
        if (cancelled) return;
        setQueryState({
          loading: false,
          error:   null,
          data,
          meta:    { rows: data.length, duration: Date.now() - t0 },
        });
      })
      .catch(err => {
        if (cancelled) return;
        setQueryState({ loading: false, error: err.message, data: [], meta: {} });
      });

    return () => { cancelled = true; };
  }, [selectedIndex]);

  // Fetch SQL text from /api/sql/{query_id} to display in the editor
  useEffect(() => {
    setSqlText("-- Loading SQL...");
    fetch(`/api/sql/${selected.id}`)
      .then(res => res.ok ? res.json() : Promise.reject(res.statusText))
      .then(json => setSqlText(json.sql))
      .catch(() => setSqlText(`-- Could not load SQL for ${selected.id}`));
  }, [selectedIndex]);

  // ── Render the right chart for the active query ───────────────────────────
  const renderChart = () => {
    if (queryState.loading) return <p className="loading-msg">Loading data…</p>;
    if (queryState.error)   return <p className="error-msg">Error: {queryState.error}</p>;
    const { data } = queryState;
    if (!data.length) return <p className="loading-msg">No data returned.</p>;

    // Q4 and Q6 manage their own grid wrappers
    if (selected.id === "africa_world_gdp_share") return <WorldShareChart data={data} />;
    if (selected.id === "uganda_profile")         return <UgandaProfileChart data={data} />;

    // All other queries: chart + raw table
    const charts = {
      top10_africa_gdp:       <Top10Chart data={data} />,
      east_africa_gdp_trend:  <EastAfricaTrendChart data={data} />,
      eac_gdp_per_capita:     <PerCapitaChart data={data} />,
      fastest_growing_africa: <FastestGrowingChart data={data} />,
    };

    return (
      <div className="chart-grid">
        {charts[selected.id] ?? null}
        <DataTable data={data} />
      </div>
    );
  };

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className="shell">

      {/* TOPBAR */}
      <div className="topbar">
        <div className="logo">
          <div className="logo-icon" />
          ECOWAREHOUSE
        </div>
        <div className="topbar-sep" />
        <span className="topbar-tag">Africa Economic Intelligence · React Edition</span>
      </div>

      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="sidebar-section">
          <div className="sidebar-label">Queries</div>
          {QUERIES.map((q, i) => (
            <button
              key={q.id}
              className={`query-btn${i === selectedIndex ? " active" : ""}`}
              onClick={() => setSelectedIndex(i)}
            >
              <span className="q-num">Q{i + 1}</span>
              <div>
                <div className="q-label">{q.title}</div>
                <div className="q-sub">{q.sub}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">Schema</div>
          <div className="schema-tree">
            <div className="table">fact_economic</div>
            <div className="col">country_key, time_key</div>
            <div className="col">indicator_key, value</div>
            <div className="table" style={{ marginTop: 6 }}>dim_country</div>
            <div className="col">country_name, iso3</div>
            <div className="col">region</div>
            <div className="table" style={{ marginTop: 6 }}>dim_time</div>
            <div className="col">year, era</div>
            <div className="table" style={{ marginTop: 6 }}>dim_indicator</div>
            <div className="col">GDP · Population</div>
            <div className="col">GDP_Per_Capita</div>
          </div>
        </div>
      </div>

      {/* MAIN PANEL */}
      <div className="main">

        {/* SQL EDITOR */}
        <div className="query-editor">
          <div className="editor-topbar">
            <span className="editor-label">SQL EDITOR (read-only)</span>
          </div>
          <div className="query-code">
            <pre><code>{sqlText}</code></pre>
          </div>
        </div>

        {/* RESULTS */}
        <div className="results">
          <div className="result-header">
            <div className="result-title">{selected.title}</div>
            {!queryState.loading && !queryState.error && (
              <div className="result-meta">
                {queryState.meta.rows} rows · {queryState.meta.duration}ms
              </div>
            )}
          </div>
          {renderChart()}
        </div>

      </div>
    </div>
  );
}
