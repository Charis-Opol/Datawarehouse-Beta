import React, { useState, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend
} from "recharts";

// This file can be used as the main component in a React application.
// To use it, you'll need to have a React project set up.
// 1. `npx create-vite my-react-app --template react`
// 2. `cd my-react-app`
// 3. `npm install recharts`
// 4. Replace the contents of `src/App.jsx` with this code.
// 5. Make sure your FastAPI backend is running on http://localhost:8000
// 6. `npm run dev`

const QUERIES = [
  { id: 'top10_africa_gdp', title: 'Top 10 Africa GDP', sub: 'Latest year · 2023' },
  { id: 'east_africa_gdp_trend', title: 'East Africa Trend', sub: 'GDP 2000–2022' },
  { id: 'eac_gdp_per_capita', title: 'EAC GDP Per Capita', sub: '2022 · 6 countries' },
  { id: 'africa_world_gdp_share', title: 'Africa World Share', sub: 'By era' },
  { id: 'fastest_growing_africa', title: 'Fastest Growing', sub: 'CAGR 2010→2022' },
  { id: 'uganda_profile', title: 'Uganda Profile', sub: '2000–2022' },
];

const COLORS = {
  Uganda: "#7c6af7",
  Kenya: "#00d4a8",
  Tanzania: "#f5a623",
  Rwanda: "#ff5c5c",
  Ethiopia: "#3dd6f5",
  Burundi: "#8b9467",
  bar: "#7c6af7",
  barHi: "#00d4a8",
};

const tickStyle = { fontSize: 11, fill: "var(--text-dim)" };
const customTooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border-bright)",
  color: "var(--text)",
  fontFamily: "var(--mono)",
  fontSize: 12,
};

// Reusable Chart Components
const ChartCard = ({ title, children }) => (
  <div className="chart-card">
    <div className="chart-card-title">{title}</div>
    <ResponsiveContainer width="100%" height={300}>
      {children}
    </ResponsiveContainer>
  </div>
);

const Top10Chart = ({ data }) => (
  <ChartCard title="GDP · Billion USD · 2023">
    <BarChart data={data} layout="vertical" margin={{ left: 30, right: 30 }}>
      <XAxis type="number" dataKey="gdp_billion_usd" tick={tickStyle} tickFormatter={v => `$${v}B`} axisLine={false} tickLine={false} />
      <YAxis type="category" dataKey="country_name" width={100} tick={tickStyle} axisLine={false} tickLine={false} />
      <Tooltip contentStyle={customTooltipStyle} formatter={(v) => [`$${v}B`, "GDP"]} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
      <Bar dataKey="gdp_billion_usd" radius={[0, 4, 4, 0]}>
        {data.map((d, i) => (
          <Cell key={i} fill={d.sub_region === "Eastern Africa" ? COLORS.barHi : COLORS.bar} />
        ))}
      </Bar>
    </BarChart>
  </ChartCard>
);

const EastAfricaTrendChart = ({ data }) => {
  // Recharts needs data pivoted for multi-line charts
  const pivotedData = Array.from(
    data.reduce((map, { year, country_name, gdp_billion_usd }) => {
      const entry = map.get(year) || { year };
      entry[country_name] = gdp_billion_usd;
      map.set(year, entry);
      return map;
    }, new Map()).values()
  );

  return (
    <ChartCard title="GDP · Billion USD · 2000–2022">
      <LineChart data={pivotedData} margin={{ left: 0, right: 10 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="year" tick={tickStyle} axisLine={false} tickLine={false} />
        <YAxis tick={tickStyle} tickFormatter={v => `$${v}B`} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={customTooltipStyle} formatter={(v, name) => [`$${v.toFixed(1)}B`, name]} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 15 }} />
        {Object.keys(COLORS).map(country => (
          <Line key={country} type="monotone" dataKey={country} stroke={COLORS[country]} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ChartCard>
  );
};

const PerCapitaChart = ({ data }) => (
    <ChartCard title="GDP Per Capita · USD · 2022">
        <BarChart data={data} layout="vertical" margin={{ left: 20, right: 30 }}>
            <XAxis type="number" dataKey="gdp_per_capita_usd" tick={tickStyle} tickFormatter={v => `$${v}`} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="country_name" width={80} tick={tickStyle} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={customTooltipStyle} formatter={(v) => [`$${v.toLocaleString()}`, "GDP per Capita"]} />
            <Bar dataKey="gdp_per_capita_usd" fill={COLORS.bar} radius={[0, 4, 4, 0]} />
        </BarChart>
    </ChartCard>
);

const DataTable = ({ data }) => (
  <div className="chart-card wide">
    <div className="chart-card-title">Raw Data</div>
    <table className="data-table">
      <thead>
        <tr>
          {data.length > 0 && Object.keys(data[0]).map(key => <th key={key}>{key.replace(/_/g, ' ')}</th>)}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i}>
            {Object.values(row).map((val, j) => (
              <td key={j} className={typeof val === 'number' ? 'num' : ''}>
                {val === null ? '—' : typeof val === 'number' ? val.toLocaleString() : val}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);


// Main Dashboard Component
export default function EcoWarehouseDashboard() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [queryData, setQueryData] = useState({ loading: true, error: null, data: [], meta: {} });

  const selectedQuery = QUERIES[selectedIndex];

  useEffect(() => {
    const fetchData = async () => {
      const startTime = Date.now();
      setQueryData({ loading: true, error: null, data: [], meta: {} });
      try {
        const response = await fetch(`/api/data/${selectedQuery.id}`);
        if (!response.ok) {
          throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        const data = await response.json();
        const duration = Date.now() - startTime;
        setQueryData({ loading: false, error: null, data, meta: { rows: data.length, duration } });
      } catch (error) {
        setQueryData({ loading: false, error: error.message, data: [], meta: {} });
      }
    };

    fetchData();
  }, [selectedIndex]);

  const renderContent = () => {
    if (queryData.loading) return <div>Loading data...</div>;
    if (queryData.error) return <div style={{ color: 'var(--red)' }}>Error: {queryData.error}</div>;

    const { data } = queryData;
    if (!data || data.length === 0) return <div>No data returned for this query.</div>;

    let chartComponent;
    switch (selectedQuery.id) {
        case 'top10_africa_gdp':
            chartComponent = <Top10Chart data={data} />;
            break;
        case 'east_africa_gdp_trend':
            chartComponent = <EastAfricaTrendChart data={data} />;
            break;
        case 'eac_gdp_per_capita':
            chartComponent = <PerCapitaChart data={data} />;
            break;
        // Add cases for other charts here
        default:
            chartComponent = null;
    }

    return (
        <div className="chart-grid">
            {chartComponent}
            <DataTable data={data} />
        </div>
    );
  };

  return (
    <div className="shell">
      {/* TOPBAR */}
      <div className="topbar">
        <div className="logo"><div className="logo-icon"></div>ECOWAREHOUSE</div>
        <div className="topbar-sep"></div>
        <span className="topbar-tag">Africa Economic Intelligence · React Edition</span>
      </div>

      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="sidebar-section">
          <div className="sidebar-label">Queries</div>
          {QUERIES.map((q, i) => (
            <button
              key={q.id}
              className={`query-btn ${i === selectedIndex ? 'active' : ''}`}
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
                <div className="col">country_key, time_key, indicator_key, value</div>
                <div className="table" style={{marginTop: '6px'}}>dim_country</div>
                <div className="col">country_name, iso3, region</div>
            </div>
        </div>
      </div>

      {/* MAIN PANEL */}
      <div className="main">
        <div className="query-editor">
          <div className="editor-topbar"><span className="editor-label">SQL EDITOR (Read-only)</span></div>
          <div className="query-code" id="queryCode">
            {/* In a real app, you might fetch the SQL text too */}
            <pre><code>-- SQL for {selectedQuery.title} would be displayed here.</code></pre>
          </div>
        </div>

        <div className="results" id="resultsPanel">
            <div className="result-header">
                <div className="result-title">{selectedQuery.title}</div>
                {!queryData.loading && !queryData.error && (
                    <div className="result-meta">
                        {queryData.meta.rows} rows · {queryData.meta.duration}ms
                    </div>
                )}
            </div>
            {renderContent()}
        </div>
      </div>
    </div>
  );
}
