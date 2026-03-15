import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post } from '../api/client';
import { CATEGORY_COLORS } from '../utils/constants';
import LoadingSpinner from '../components/LoadingSpinner';

const LOADING_STEPS = [
  'Saving your responses to database...',
  'Running deep security analysis...',
  'Analyzing vulnerabilities and attack vectors...',
  'Generating remediation recommendations...',
  'Building compliance gap report...',
  'Finalizing your security report...',
];

export default function Assessment() {
  const [categories, setCategories] = useState([]);
  const [currentCategory, setCurrentCategory] = useState(0);
  const [answers, setAnswers] = useState({});
  const [phase, setPhase] = useState('loading');
  const [submitting, setSubmitting] = useState(false);
  const [activeSteps, setActiveSteps] = useState([]);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    async function loadQuestions() {
      try {
        const res = await get('/api/questions');
        const grouped = res.data;
        const cats = [];
        for (const std in grouped) {
          for (const cat in grouped[std]) {
            cats.push({
              standard: std,
              category: cat,
              questions: grouped[std][cat],
            });
          }
        }
        if (mounted) {
          setCategories(cats);
          setPhase('intro');
        }
      } catch (e) {
        if (mounted) {
          setError(e.message);
          setPhase('error');
        }
      }
    }
    loadQuestions();
    return () => { mounted = false; };
  }, []);

  const totalQ = categories.reduce((a, c) => a + c.questions.length, 0);
  const answeredCount = Object.keys(answers).length;
  const pct = totalQ > 0 ? Math.round((answeredCount / totalQ) * 100) : 0;

  const setAnswer = (qId, val) => {
    setAnswers((prev) => ({ ...prev, [qId]: val }));
  };

  const startAssessment = () => {
    setCurrentCategory(0);
    setAnswers({});
    setPhase('quiz');
  };

  const jumpCategory = (i) => {
    setCurrentCategory(i);
  };

  const prevCategory = () => {
    if (currentCategory > 0) setCurrentCategory(currentCategory - 1);
  };

  const nextCategory = () => {
    if (currentCategory < categories.length - 1) setCurrentCategory(currentCategory + 1);
  };

  const submitAssessment = async () => {
    if (submitting) return;
    setSubmitting(true);
    setPhase('submitting');
    setActiveSteps([]);

    LOADING_STEPS.forEach((_, i) => {
      setTimeout(() => {
        setActiveSteps((prev) => [...prev, i]);
      }, i * 2000 + 500);
    });

    const responses = Object.entries(answers).map(([qId, answer]) => ({
      questionId: parseInt(qId),
      answer,
      comment: null,
    }));

    try {
      const res = await post('/api/audit/submit', { responses });
      if (res.success) {
        await pollAnalysisStatus();
        setSubmitting(false);
        navigate('/report');
      } else {
        setSubmitting(false);
        setError(res.error);
        setPhase('error');
      }
    } catch (e) {
      setSubmitting(false);
      setError(e.message);
      setPhase('error');
    }
  };

  const pollAnalysisStatus = async () => {
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const status = await get('/api/audit/analysis-status');
        if (status.data && status.data.isComplete) return;
      } catch (e) {
        // continue polling
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  };

  if (phase === 'loading') {
    return <LoadingSpinner message="Loading questions..." />;
  }

  if (phase === 'error') {
    return (
      <div className="empty-state">
        <h3>Error</h3>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={() => { setPhase('intro'); setError(null); }}>
          Back
        </button>
      </div>
    );
  }

  if (phase === 'submitting') {
    return (
      <div className="loading-overlay">
        <div className="spinner"></div>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '4px' }}>
            Analyzing your security posture
          </div>
          <div className="text-muted">
            Processing {Object.keys(answers).length} responses across {categories.length} categories...
          </div>
          <div className="text-muted" style={{ marginTop: '4px' }}>
            This may take 1-2 minutes. Please wait.
          </div>
        </div>
        <div className="loading-steps">
          {LOADING_STEPS.map((step, i) => (
            <div
              key={i}
              className="loading-step"
              style={{
                animationDelay: `${i * 0.3}s`,
                color: activeSteps.includes(i) ? '#276749' : undefined,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ADB5BD" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {' '}{step}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <>
        <div className="page-header">
          <h1>New Assessment</h1>
          <p>
            Complete the GRC diagnostic across {categories.length} categories to receive your deep analysis
          </p>
        </div>

        <div className="card" style={{ maxWidth: '720px', marginBottom: '20px', background: '#EBF4FF', borderColor: '#BEE3F8' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2B6CB0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#2B6CB0', marginBottom: '4px' }}>
                What you get from this assessment
              </div>
              <div style={{ fontSize: '13px', color: '#2C5282', lineHeight: 1.75 }}>
                {totalQ} questions across ISO 27001 &amp; NIST standards. The system will analyze every
                gap and produce: <strong>detailed attack scenarios</strong>,{' '}
                <strong>vulnerability analysis</strong>, <strong>real-world breach examples</strong>,{' '}
                <strong>step-by-step remediation guides</strong>, and{' '}
                <strong>compliance gap reports</strong>.
              </div>
            </div>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '10px',
          maxWidth: '720px',
          marginBottom: '24px',
        }}>
          {categories.map((c, i) => {
            const color = CATEGORY_COLORS[c.category] || '#4A5568';
            return (
              <div key={i} className="card card-sm" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '9px',
                  background: `${color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: color,
                  }}></div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 500 }}>{c.category}</div>
                  <div className="text-muted">{c.questions.length} questions &middot; {c.standard}</div>
                </div>
              </div>
            );
          })}
        </div>

        <button className="btn btn-primary btn-lg" onClick={startAssessment}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {' '}Begin Assessment ({totalQ} questions)
        </button>
      </>
    );
  }

  // phase === 'quiz'
  const cat = categories[currentCategory];
  const color = CATEGORY_COLORS[cat.category] || '#4A5568';
  const done = cat.questions.filter((q) => answers[q.id] !== undefined).length;

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <h1>{cat.standard} &mdash; {cat.category}</h1>
          <p>{answeredCount} of {totalQ} questions answered ({pct}%)</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => setPhase('intro')}>
          Exit
        </button>
      </div>

      <div className="assessment-progress">
        <div className="cat-tabs">
          {categories.map((c, i) => {
            const allDone = c.questions.every((q) => answers[q.id] !== undefined);
            let cls = 'cat-tab';
            if (i === currentCategory) cls += ' active';
            else if (allDone) cls += ' done';
            return (
              <button key={i} className={cls} onClick={() => jumpCategory(i)}>
                {allDone && <span>&#10003; </span>}
                {c.category}
              </button>
            );
          })}
        </div>
        <div className="progress-bar-wrap">
          <div className="progress-bar-fill" style={{ width: `${pct}%` }}></div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', maxWidth: '820px' }}>
        <div className="cat-header" style={{ background: `${color}10` }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: `${color}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              background: color,
            }}></div>
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 600, color }}>{cat.category}</div>
            <div style={{ fontSize: '12px', color, opacity: 0.7 }}>
              {cat.questions.length} questions &middot; {cat.standard}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: '18px', fontWeight: 600, color }}>{done}/{cat.questions.length}</div>
            <div style={{ fontSize: '10px', color, opacity: 0.7 }}>answered</div>
          </div>
        </div>

        <div style={{ padding: '0 20px' }}>
          {cat.questions.map((q) => (
            <div key={q.id} className="question-row">
              <div className="q-left">
                <span className="q-id">{q.clauseNumber}</span>
                <span className="q-text">{q.text}</span>
              </div>
              <div className="q-btns">
                <button
                  className={`yn-btn yes${answers[q.id] === true ? ' on' : ''}`}
                  onClick={() => setAnswer(q.id, true)}
                >
                  Yes
                </button>
                <button
                  className={`yn-btn no${answers[q.id] === false ? ' on' : ''}`}
                  onClick={() => setAnswer(q.id, false)}
                >
                  No
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-between mt-20" style={{ maxWidth: '820px' }}>
        <button
          className="btn btn-outline"
          style={{ visibility: currentCategory === 0 ? 'hidden' : 'visible' }}
          onClick={prevCategory}
        >
          &#8592; Back
        </button>
        <div className="flex-center">
          <span className="text-muted">{currentCategory + 1} of {categories.length}</span>
          {currentCategory < categories.length - 1 ? (
            <button className="btn btn-primary" onClick={nextCategory}>
              Next &#8594;
            </button>
          ) : (
            <button
              className="btn btn-primary btn-lg"
              onClick={submitAssessment}
              disabled={submitting}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              {' '}Submit &amp; Generate Report
            </button>
          )}
        </div>
      </div>
    </>
  );
}
