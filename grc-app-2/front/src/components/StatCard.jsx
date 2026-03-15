import React from 'react';

export default function StatCard({ label, value, sub, valueColor }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}
