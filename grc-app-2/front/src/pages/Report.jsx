import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { get } from '../api/client';
import { RISK_COLORS, CATEGORY_COLORS } from '../utils/constants';
import { formatDate, scoreColor } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Report() {
  const [data, setData] = useState(null);
  const [execData, setExecData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const radarRef = useRef(null);
  const radarInstance = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    async function fetchReport() {
      try {
        const reportRes = await get('/api/reports/my-report');
        if (!mounted) return;

        if (!reportRes.data) {
          setData(null);
          setLoading(false);
          return;
        }

        setData(reportRes.data);

        try {
          const execRes = await get('/api/reports/executive-summary');
          if (mounted && execRes.success) {
            setExecData(execRes.data);
          }
        } catch (e) {
          // continue without exec summary
        }

        if (mounted) setLoading(false);
      } catch (e) {
        if (mounted) {
          setError(e.message);
          setLoading(false);
        }
      }
    }
    fetchReport();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!data || !data.categoryScores || data.categoryScores.length === 0) return;

    const timer = setTimeout(() => {
      const ctx = radarRef.current;
      if (!ctx || typeof window.Chart === 'undefined') return;

      if (radarInstance.current) {
        radarInstance.current.destroy();
      }

      radarInstance.current = new window.Chart(ctx, {
        type: 'radar',
        data: {
          labels: data.categoryScores.map((c) => c.category),
          datasets: [{
            data: data.categoryScores.map((c) => c.score),
            backgroundColor: 'rgba(13,31,53,0.07)',
            borderColor: '#0D1F35',
            borderWidth: 2,
            pointBackgroundColor: data.categoryScores.map((c) => CATEGORY_COLORS[c.category] || '#718096'),
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (c) {
                  return ' ' + c.raw + '%';
                },
              },
            },
          },
          scales: {
            r: {
              min: 0,
              max: 100,
              ticks: { stepSize: 25, font: { size: 10 }, color: '#ADB5BD', backdropColor: 'transparent' },
              grid: { color: '#EDF2F7' },
              angleLines: { color: '#EDF2F7' },
              pointLabels: { font: { size: 10, weight: '500' }, color: '#4A5568' },
            },
          },
        },
      });
    }, 200);

    return () => {
      clearTimeout(timer);
      if (radarInstance.current) {
        radarInstance.current.destroy();
        radarInstance.current = null;
      }
    };
  }, [data]);

  if (loading) {
    return <LoadingSpinner message="Loading report..." />;
  }

  if (error) {
    return (
      <div className="empty-state">
        <h3>Error loading report</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="empty-state">
        <h3>No Assessment Data</h3>
        <p>Complete a GRC assessment first to see your report.</p>
        <button className="btn btn-primary" onClick={() => navigate('/assessment')}>
          Start Assessment
        </button>
      </div>
    );
  }

  const riskC = RISK_COLORS[data.riskLevel] || '#333';

  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <h1>Security Assessment Report</h1>
        <p>
          {data.company} &middot; Assessed by {data.assessedBy} &middot; {formatDate(data.date)}
        </p>
      </div>

      {/* Executive Summary Banner */}
      <div className="exec-summary">
        <div className="es-label">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {' '}Executive Summary &mdash; {data.company}
        </div>

        {execData && execData.boardStatement && (
          <p style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'rgba(255,255,255,.95)',
            lineHeight: 1.75,
            marginBottom: '14px',
            padding: '12px 14px',
            background: 'rgba(255,255,255,.08)',
            borderRadius: '8px',
            borderLeft: '3px solid rgba(255,255,255,.3)',
          }}>
            {execData.boardStatement}
          </p>
        )}

        <p className="es-text">
          {execData && execData.executiveSummary
            ? execData.executiveSummary
            : `Assessment complete. ${data.totalGaps} gaps identified across ${data.totalQuestions} controls.`}
        </p>

        <div className="es-stats">
          <div>
            <div className="es-stat-val">{data.overallScore}%</div>
            <div className="es-stat-lbl">Overall Score</div>
          </div>
          <div>
            <div className="es-stat-val" style={{ color: riskC }}>{data.riskLevel}</div>
            <div className="es-stat-lbl">Risk Level</div>
          </div>
          <div>
            <div className="es-stat-val">{data.maturityLevel}</div>
            <div className="es-stat-lbl">Maturity Level</div>
          </div>
        </div>
      </div>

      {/* Stats Badges */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <div style={{
          padding: '10px 16px',
          borderRadius: '10px',
          background: '#FDEDED',
          border: '1px solid #FEB2B2',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#9B2335' }}></div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#9B2335' }}>{data.totalGaps}</div>
            <div style={{ fontSize: '10px', color: '#9B2335', fontWeight: 600 }}>GAPS FOUND</div>
          </div>
        </div>
        <div style={{
          padding: '10px 16px',
          borderRadius: '10px',
          background: '#F0FFF4',
          border: '1px solid #9AE6B4',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#276749' }}></div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#276749' }}>{data.totalStrengths}</div>
            <div style={{ fontSize: '10px', color: '#276749', fontWeight: 600 }}>CONTROLS MET</div>
          </div>
        </div>
        <div style={{
          padding: '10px 16px',
          borderRadius: '10px',
          background: '#EBF4FF',
          border: '1px solid #90CDF4',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2B6CB0' }}></div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#2B6CB0' }}>{data.totalQuestions}</div>
            <div style={{ fontSize: '10px', color: '#2B6CB0', fontWeight: 600 }}>TOTAL ASSESSED</div>
          </div>
        </div>
      </div>

      {/* Category Scores + Radar Chart */}
      <div className="grid-2 mb-20">
        <div className="card">
          <div className="card-title">Category Scores</div>
          {data.categoryScores && data.categoryScores.map((cat, i) => {
            const catColor = CATEGORY_COLORS[cat.category] || '#4A5568';
            return (
              <div key={i} style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 500, color: '#1A202C' }}>
                    {cat.category} <span className="text-muted">({cat.standard})</span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: scoreColor(cat.score) }}>
                    {cat.score}%
                  </div>
                </div>
                <div className="score-bar">
                  <div className="score-bar-fill" style={{ width: `${cat.score}%`, background: catColor }}></div>
                </div>
                <div className="text-muted" style={{ marginTop: '2px' }}>
                  {cat.gaps} gaps / {cat.strengths} met
                </div>
              </div>
            );
          })}
        </div>
        <div className="card">
          <div className="card-title">Compliance Radar</div>
          <div className="chart-wrap">
            <canvas ref={radarRef}></canvas>
          </div>
        </div>
      </div>

      {/* Attack Scenarios */}
      {execData && execData.attackScenarios && execData.attackScenarios.length > 0 && (
        <div className="report-section">
          <div className="section-header">
            <div className="section-icon" style={{ background: '#FDEDED' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9B2335" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3>Attack Scenarios &mdash; How Attackers Can Bypass Your Systems</h3>
          </div>
          {execData.attackScenarios.map((scenario, i) => {
            const likelihoodColors = { High: '#FC8181', Medium: '#F6AD55', Low: '#68D391' };
            const lc = likelihoodColors[scenario.likelihood] || '#CBD5E0';
            return (
              <div key={i} className="attack-card">
                <div className="attack-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FC8181" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {' '}{scenario.scenario}
                </div>
                <div className="attack-body">{scenario.description}</div>
                <div className="attack-meta">
                  <span style={{ background: `${lc}30`, color: lc }}>{scenario.likelihood} Likelihood</span>
                  <span style={{ background: '#FC818130', color: '#FC8181' }}>{scenario.impact}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Top Risks */}
      {execData && execData.topRisks && execData.topRisks.length > 0 && (
        <div className="report-section card">
          <div className="section-header">
            <div className="section-icon" style={{ background: '#FFFAF0' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C05621" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3>Top Risks</h3>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Risk</th>
                  <th>Severity</th>
                  <th>Description</th>
                  <th>Business Impact</th>
                  <th>Immediate Action</th>
                </tr>
              </thead>
              <tbody>
                {execData.topRisks.map((risk, i) => {
                  const sevColors = { Critical: '#9B2335', High: '#C05621', Medium: '#2B6CB0' };
                  const sevBgColors = { Critical: '#FDEDED', High: '#FFFAF0', Medium: '#EBF4FF' };
                  const sevC = sevColors[risk.severity] || '#718096';
                  const sevBg = sevBgColors[risk.severity] || '#F7FAFC';
                  return (
                    <tr key={i}>
                      <td><strong>{risk.risk}</strong></td>
                      <td>
                        <span className="badge" style={{ background: sevBg, color: sevC }}>
                          {risk.severity}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px' }}>{risk.description}</td>
                      <td style={{ fontSize: '12px', color: '#9B2335' }}>{risk.businessImpact}</td>
                      <td style={{ fontSize: '12px', color: '#276749' }}>{risk.immediateAction}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Vulnerability Analysis */}
      {data.criticalGaps && data.criticalGaps.length > 0 && (
        <div className="report-section">
          <div className="section-header" style={{ marginBottom: '20px' }}>
            <div className="section-icon" style={{ background: '#FDEDED' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9B2335" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3>Vulnerability Analysis &mdash; {data.criticalGaps.length} Gaps</h3>
              <p style={{ fontSize: '12px', color: '#718096', marginTop: '2px' }}>
                Each gap analyzed with attack vectors, impact assessment, and remediation steps
              </p>
            </div>
          </div>

          {data.criticalGaps.map((gap, i) => {
            const sc = scoreColor(gap.aiScore || 0);
            const severity = (gap.aiScore || 0) <= 25 ? 'Critical' : (gap.aiScore || 0) <= 50 ? 'High' : 'Medium';
            const sevColors = { Critical: '#9B2335', High: '#C05621', Medium: '#2B6CB0' };
            const sevBgColors = { Critical: '#FDEDED', High: '#FFFAF0', Medium: '#EBF4FF' };
            const sevC = sevColors[severity];
            const sevBg = sevBgColors[severity];

            return (
              <div key={i} className="gap-card">
                <div className="gap-card-header">
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    background: sevBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: sevC,
                    flexShrink: 0,
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span className="badge" style={{ background: sevBg, color: sevC }}>{severity}</span>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '99px',
                        background: '#EBF4FF',
                        color: '#2B6CB0',
                        fontSize: '11px',
                        fontWeight: 500,
                      }}>
                        {gap.category}
                      </span>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#718096' }}>
                        {gap.clause}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: sc }}>
                        Score: {gap.aiScore || 0}/100
                      </span>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A202C' }}>
                      {gap.question}
                    </div>
                  </div>
                </div>

                <div className="gap-card-body">
                  <div style={{
                    marginBottom: '16px',
                    padding: '14px',
                    background: '#FFF5F5',
                    borderRadius: '8px',
                    borderLeft: '3px solid #FC8181',
                  }}>
                    <div style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '.07em',
                      color: '#C53030',
                      marginBottom: '6px',
                    }}>
                      Vulnerability Analysis &amp; Attack Vectors
                    </div>
                    <p style={{
                      fontSize: '13px',
                      color: '#742A2A',
                      lineHeight: 1.7,
                      margin: 0,
                      whiteSpace: 'pre-line',
                    }}>
                      {gap.gapAnalysis || 'Analysis pending...'}
                    </p>
                  </div>

                  <div className="rec-box">
                    <div className="rec-title">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#276749" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      {' '}Remediation Plan
                    </div>
                    <p style={{ whiteSpace: 'pre-line' }}>
                      {gap.recommendation || 'Recommendations pending...'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Compliance Gap Matrix */}
      {execData && execData.complianceRisks && execData.complianceRisks.length > 0 && (
        <div className="report-section card">
          <div className="section-header">
            <div className="section-icon" style={{ background: '#F0FFF4' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#276749" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3>Compliance Gap Matrix</h3>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Regulation</th>
                  <th>Status</th>
                  <th>Gaps</th>
                  <th>Penalty</th>
                  <th>Deadline</th>
                </tr>
              </thead>
              <tbody>
                {execData.complianceRisks.map((c, i) => {
                  const statusColors = { 'Compliant': '#276749', 'Partially Compliant': '#C05621', 'Non-Compliant': '#9B2335' };
                  const statusBgColors = { 'Compliant': '#F0FFF4', 'Partially Compliant': '#FFFAF0', 'Non-Compliant': '#FDEDED' };
                  const stC = statusColors[c.status] || '#718096';
                  const stBg = statusBgColors[c.status] || '#F7FAFC';
                  const gapsText = Array.isArray(c.gaps) ? c.gaps.join(', ') : (c.gaps || '');
                  return (
                    <tr key={i}>
                      <td><strong>{c.regulation}</strong></td>
                      <td>
                        <span className="badge" style={{ background: stBg, color: stC }}>
                          {c.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px' }}>{gapsText}</td>
                      <td style={{ fontSize: '12px', color: '#9B2335' }}>{c.penalty}</td>
                      <td style={{ fontSize: '12px' }}>{c.deadline}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Implementation Roadmap */}
      {execData && execData.roadmap && (
        <div className="report-section">
          <div className="section-header">
            <div className="section-icon" style={{ background: '#F0FFF4' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#276749" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <h3>Implementation Roadmap</h3>
          </div>
          <div className="grid-3">
            {[
              { key: 'immediate', title: 'Immediate (This Week)', color: '#9B2335', bg: '#FDEDED' },
              { key: 'shortTerm', title: 'Short-term (1-3 Months)', color: '#C05621', bg: '#FFFAF0' },
              { key: 'longTerm', title: 'Long-term (3-12 Months)', color: '#276749', bg: '#F0FFF4' },
            ].map((phase) => {
              const items = execData.roadmap[phase.key];
              if (!items) return null;
              return (
                <div key={phase.key} className="card">
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: phase.color,
                    textTransform: 'uppercase',
                    letterSpacing: '.06em',
                    marginBottom: '10px',
                  }}>
                    <span style={{ padding: '2px 8px', background: phase.bg, borderRadius: '99px' }}>
                      {phase.title}
                    </span>
                  </div>
                  {(Array.isArray(items) ? items : []).map((item, j) => (
                    <div key={j} style={{ display: 'flex', gap: '7px', marginBottom: '8px' }}>
                      <div style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        background: phase.color,
                        marginTop: '6px',
                        flexShrink: 0,
                      }}></div>
                      <div style={{ fontSize: '12px', color: '#4A5568', lineHeight: 1.5 }}>{item}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Investment Estimate */}
      {execData && execData.investmentEstimate && (
        <div className="card report-section" style={{ background: '#EBF4FF', borderColor: '#90CDF4' }}>
          <div className="section-header">
            <div className="section-icon" style={{ background: '#fff' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2B6CB0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3>Investment Estimate</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
            <div style={{
              padding: '14px',
              background: 'rgba(255,255,255,.7)',
              borderRadius: '10px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#2B6CB0' }}>
                {execData.investmentEstimate.minimum}
              </div>
              <div className="text-muted">Minimum Budget</div>
            </div>
            <div style={{
              padding: '14px',
              background: 'rgba(255,255,255,.7)',
              borderRadius: '10px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#2B6CB0' }}>
                {execData.investmentEstimate.maximum}
              </div>
              <div className="text-muted">Maximum Budget</div>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: '#2C5282', lineHeight: 1.7 }}>
            {execData.investmentEstimate.roi}
          </p>
        </div>
      )}

      {/* Controls Met */}
      {data.strengths && data.strengths.length > 0 && (
        <div className="report-section card">
          <div className="section-header">
            <div className="section-icon" style={{ background: '#F0FFF4' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#276749" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3>Controls Met ({data.strengths.length})</h3>
          </div>
          {data.strengths.map((s, i) => (
            <div key={i} style={{
              display: 'flex',
              gap: '10px',
              marginBottom: '10px',
              paddingBottom: '10px',
              borderBottom: '1px solid #F7FAFC',
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: '#F0FFF4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '1px',
              }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#276749" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 500, color: '#1A202C' }}>{s.question}</div>
                <div style={{ fontSize: '11px', color: '#718096' }}>
                  {s.standard} {s.clause} &middot; {s.category}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Disclaimer Footer */}
      <div style={{ padding: '16px 0', borderTop: '1px solid #E2E8F0', marginTop: '8px' }}>
        <p style={{ fontSize: '11px', color: '#A0AEC0', lineHeight: 1.7 }}>
          This report is based on self-reported responses and is intended for internal assessment purposes.
          It does not constitute a formal audit, legal opinion, or compliance certification.
          Engage qualified GRC professionals for independent validation.
        </p>
      </div>
    </>
  );
}
