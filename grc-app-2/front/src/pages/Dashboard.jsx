import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { get } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { RISK_COLORS } from '../utils/constants';
import { scoreColor } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import StatCard from '../components/StatCard';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    async function fetchStats() {
      try {
        const res = await get('/api/reports/stats');
        if (mounted) {
          setStats(res.data);
          setLoading(false);
        }
      } catch (e) {
        if (mounted) {
          setError(e.message);
          setLoading(false);
        }
      }
    }
    fetchStats();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!stats || !stats.totalResponses || stats.totalResponses <= 0) return;

    const timer = setTimeout(() => {
      const ctx = chartRef.current;
      if (!ctx || typeof window.Chart === 'undefined') return;

      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      chartInstance.current = new window.Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Controls Met', 'Gaps Found'],
          datasets: [{
            data: [stats.totalStrengths || 0, stats.totalGaps || 0],
            backgroundColor: ['#276749', '#9B2335'],
            borderWidth: 0,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label: function (c) {
                  return ' ' + c.label + ': ' + c.raw;
                },
              },
            },
          },
        },
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [stats]);

  if (loading) {
    return <LoadingSpinner message="Loading..." />;
  }

  if (error) {
    return (
      <div className="empty-state">
        <h3>Could not load dashboard</h3>
        <p>{error}</p>
      </div>
    );
  }

  const d = stats || {};

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back, {user?.firstName}. Here is your GRC overview.</p>
        </div>
        <button className="btn btn-primary btn-lg" onClick={() => navigate('/assessment')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4v16m8-8H4" />
          </svg>
          {' '}New Assessment
        </button>
      </div>

      <div className="stats-grid">
        <StatCard
          label="Controls Assessed"
          value={d.totalResponses || 0}
          sub="total questions answered"
        />
        <StatCard
          label="Overall Score"
          value={`${d.overallScore || 0}%`}
          valueColor={scoreColor(d.overallScore || 0)}
          sub="compliance rate"
        />
        <StatCard
          label="Gaps Found"
          value={d.totalGaps || 0}
          valueColor="#9B2335"
          sub="vulnerabilities identified"
        />
        <StatCard
          label="Risk Level"
          value={d.riskLevel || 'N/A'}
          valueColor={RISK_COLORS[d.riskLevel] || '#333'}
          sub="current posture"
        />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Compliance Overview</div>
          {d.totalResponses > 0 ? (
            <div className="chart-wrap-sm">
              <canvas ref={chartRef}></canvas>
            </div>
          ) : (
            <div className="empty-state">
              <h3>No data yet</h3>
              <p>Run your first assessment to see compliance metrics.</p>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">Quick Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px 0' }}>
            <button className="btn btn-primary" onClick={() => navigate('/assessment')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 4v16m8-8H4" />
              </svg>
              {' '}Start New Assessment
            </button>
            {d.totalResponses > 0 && (
              <button className="btn btn-accent" onClick={() => navigate('/report')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {' '}View Full Report
              </button>
            )}
          </div>
          <div style={{
            marginTop: '16px',
            padding: '14px',
            background: '#EBF4FF',
            borderRadius: '10px',
            border: '1px solid #BEE3F8',
          }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#2B6CB0', marginBottom: '4px' }}>
              How it works
            </div>
            <div style={{ fontSize: '12px', color: '#2C5282', lineHeight: 1.7 }}>
              1. Answer GRC assessment questions (ISO 27001 &amp; NIST)<br />
              2. System analyzes each gap with attack scenarios<br />
              3. Get detailed vulnerability report with remediation plans
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
