import { useEffect, useState } from 'react';
import {
  Container, Title, Text, Paper, Button, Group, Stack, Badge, SimpleGrid,
  Loader, Table, RingProgress, Alert, Divider, Tabs, TypographyStylesProvider
} from '@mantine/core';
import { IconArrowLeft, IconShieldCheck, IconAlertTriangle, IconCheck, IconX, IconBrain, IconTarget, IconFileText, IconChartBar } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { getMyReport, getEvaluation } from './api/report';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const RISK_COLORS = { Low: '#22c55e', Medium: '#f59e0b', High: '#ef4444', Critical: '#dc2626' };
const BAR_COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#22c55e', '#ef4444', '#14b8a6', '#f97316', '#6366f1'];
const SEVERITY_COLORS = { Critical: 'red', High: 'orange', Medium: 'yellow', Low: 'green' };

export default function Report() {
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [aiEval, setAiEval] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { loadReport(); }, []);

  const loadReport = async () => {
    try {
      const [reportData, evalData] = await Promise.allSettled([
        getMyReport(),
        getEvaluation()
      ]);
      if (reportData.status === 'fulfilled') setReport(reportData.value);
      if (evalData.status === 'fulfilled') setAiEval(evalData.value);
    } catch (err) {
      setError(err.message || 'Failed to load report.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ backgroundColor: '#020817', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader color="cyan" size="xl" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div style={{ backgroundColor: '#020817', minHeight: '100vh', color: '#f8fafc', padding: '2rem 0' }}>
        <Container size="md">
          <Alert color="red" mb="md">{error || 'No report data available.'}</Alert>
          <Button variant="light" onClick={() => navigate('/assessment')}>Start Assessment</Button>
        </Container>
      </div>
    );
  }

  const chartData = report.categories.map(c => ({
    category: c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name,
    fullName: c.name,
    score: c.score,
  }));

  return (
    <div style={{ backgroundColor: '#020817', minHeight: '100vh', color: '#f8fafc', padding: '2rem 0' }}>
      <Container size="xl">
        {/* Header */}
        <Group justify="space-between" mb="xl">
          <div>
            <Title order={1} style={{ letterSpacing: '-1px' }}>Security Assessment Report</Title>
            <Text c="dimmed">{report.company} | Assessed by {report.assessedBy} | {new Date(report.date).toLocaleDateString()}</Text>
          </div>
          <Group>
            <Button variant="subtle" color="gray" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/dashboard')}>Dashboard</Button>
            <Button variant="light" color="cyan" onClick={() => navigate('/assessment')}>Retake Assessment</Button>
          </Group>
        </Group>

        {/* AI Executive Summary */}
        {aiEval && (
          <Paper p="lg" radius="md" mb="xl" style={{ backgroundColor: '#0f172a', border: '1px solid #3b82f6' }}>
            <Group mb="md">
              <IconBrain size={24} color="#3b82f6" />
              <Title order={3}>AI Security Analysis</Title>
              <Badge color={SEVERITY_COLORS[aiEval.riskLevel] || 'gray'} size="lg">{aiEval.riskLevel} Risk</Badge>
              <Badge color="blue" variant="light">AI Score: {aiEval.overallScore}/100</Badge>
            </Group>
            <Text size="sm" mb="md" style={{ lineHeight: 1.7 }}>{aiEval.executiveSummary}</Text>

            {/* ISO Compliance Scores */}
            {aiEval.isoCompliance && (
              <>
                <Divider my="md" color="#334155" />
                <Title order={5} mb="sm">ISO/NIST Compliance Scores</Title>
                <SimpleGrid cols={{ base: 2, md: 4 }} mb="md">
                  {aiEval.isoCompliance.iso27001Score != null && (
                    <Paper p="sm" style={{ backgroundColor: '#1e293b', textAlign: 'center' }}>
                      <Text fw={700} size="xl" c={aiEval.isoCompliance.iso27001Score >= 70 ? 'green' : 'red'}>{aiEval.isoCompliance.iso27001Score}%</Text>
                      <Text size="xs" c="dimmed">ISO 27001</Text>
                    </Paper>
                  )}
                  {aiEval.isoCompliance.nistScore != null && (
                    <Paper p="sm" style={{ backgroundColor: '#1e293b', textAlign: 'center' }}>
                      <Text fw={700} size="xl" c={aiEval.isoCompliance.nistScore >= 70 ? 'green' : 'red'}>{aiEval.isoCompliance.nistScore}%</Text>
                      <Text size="xs" c="dimmed">NIST CSF</Text>
                    </Paper>
                  )}
                </SimpleGrid>
                {aiEval.isoCompliance.majorNonConformities?.length > 0 && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <Text size="sm" fw={600} c="red" mb="xs">Major Non-Conformities:</Text>
                    {aiEval.isoCompliance.majorNonConformities.map((nc, i) => (
                      <Text key={i} size="xs" mb={2}>- {nc}</Text>
                    ))}
                  </div>
                )}
                {aiEval.isoCompliance.minorNonConformities?.length > 0 && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <Text size="sm" fw={600} c="yellow" mb="xs">Minor Non-Conformities:</Text>
                    {aiEval.isoCompliance.minorNonConformities.map((nc, i) => (
                      <Text key={i} size="xs" mb={2}>- {nc}</Text>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Evidence Assessment */}
            {aiEval.evidenceAssessment && (
              <>
                <Divider my="md" color="#334155" />
                <Title order={5} mb="sm">Evidence Assessment</Title>
                <Group mb="sm">
                  <Badge color="blue" variant="light">
                    {aiEval.evidenceAssessment.totalEvidenceProvided}/{aiEval.evidenceAssessment.totalEvidenceRequired} files provided
                  </Badge>
                  <Badge color={
                    aiEval.evidenceAssessment.evidenceQuality === 'Comprehensive' ? 'green' :
                    aiEval.evidenceAssessment.evidenceQuality === 'Adequate' ? 'teal' :
                    aiEval.evidenceAssessment.evidenceQuality === 'Partial' ? 'yellow' : 'red'
                  } variant="light">
                    Quality: {aiEval.evidenceAssessment.evidenceQuality}
                  </Badge>
                </Group>
                {aiEval.evidenceAssessment.evidenceGaps?.length > 0 && (
                  <Stack gap="xs">
                    {aiEval.evidenceAssessment.evidenceGaps.map((eg, i) => (
                      <Paper key={i} p="xs" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
                        <Text size="xs" fw={600} c="red">{eg.control}</Text>
                        <Text size="xs">{eg.issue}</Text>
                        <Text size="xs" c="cyan">Required: {eg.requiredEvidence}</Text>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </>
            )}
          </Paper>
        )}

        {/* Summary Cards */}
        <SimpleGrid cols={{ base: 2, md: 4 }} mb="xl">
          <Paper p="lg" radius="md" style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', textAlign: 'center' }}>
            <RingProgress
              size={100}
              thickness={10}
              roundCaps
              sections={[{ value: report.overallScore, color: RISK_COLORS[report.riskLevel] || '#f59e0b' }]}
              label={<Text ta="center" fw={700} size="lg">{report.overallScore}%</Text>}
              mx="auto" mb="xs"
            />
            <Text fw={600}>Overall Score</Text>
          </Paper>
          <Paper p="lg" radius="md" style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', textAlign: 'center' }}>
            <Badge color={RISK_COLORS[report.riskLevel] || 'yellow'} size="xl" variant="light" mb="md" style={{ display: 'inline-flex' }}>
              {report.riskLevel} Risk
            </Badge>
            <Text fw={600}>Risk Level</Text>
          </Paper>
          <Paper p="lg" radius="md" style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', textAlign: 'center' }}>
            <Text fw={700} size="2rem" c="green" mb="xs">{report.totalCompliant}</Text>
            <Text fw={600}>Controls Met</Text>
            <Text size="xs" c="dimmed">of {report.totalQuestions} total</Text>
          </Paper>
          <Paper p="lg" radius="md" style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', textAlign: 'center' }}>
            <Text fw={700} size="2rem" c="red" mb="xs">{report.totalGaps}</Text>
            <Text fw={600}>Gaps Found</Text>
            <Text size="xs" c="dimmed">{report.totalAnswered} assessed</Text>
          </Paper>
        </SimpleGrid>

        {/* Charts */}
        <SimpleGrid cols={{ base: 1, md: 2 }} mb="xl">
          <Paper p="lg" radius="md" style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
            <Title order={4} mb="md">Category Compliance Radar</Title>
            <ResponsiveContainer width="100%" height={350}>
              <RadarChart data={chartData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8' }} />
                <Radar name="Score" dataKey="score" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </Paper>
          <Paper p="lg" radius="md" style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
            <Title order={4} mb="md">Score by Category</Title>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94a3b8' }} />
                <YAxis dataKey="category" type="category" width={120} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f8fafc' }}
                  formatter={(value, name, props) => [`${value}%`, props.payload.fullName]} />
                <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </SimpleGrid>

        {/* AI Top Risks */}
        {aiEval?.topRisks?.length > 0 && (
          <Paper p="lg" radius="md" mb="xl" style={{ backgroundColor: '#0f172a', border: '1px solid #ef444430' }}>
            <Group mb="md">
              <IconTarget size={20} color="#ef4444" />
              <Title order={4}>Top Security Risks (AI Analysis)</Title>
            </Group>
            <Stack gap="sm">
              {aiEval.topRisks.map((r, i) => (
                <Paper key={i} p="md" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
                  <Group justify="space-between" mb="xs">
                    <Group gap="xs">
                      <Text fw={600}>{r.risk}</Text>
                      {r.isoClause && <Badge color="blue" variant="dot" size="xs">{r.isoClause}</Badge>}
                    </Group>
                    <Badge color={SEVERITY_COLORS[r.severity] || 'gray'}>{r.severity}</Badge>
                  </Group>
                  <Text size="sm" mb="xs">{r.description}</Text>
                  {r.attackVector && <Text size="xs" c="orange" mb="xs"><b>Attack Vector:</b> {r.attackVector}</Text>}
                  <Text size="xs" c="dimmed"><b>Impact:</b> {r.impact}</Text>
                  <Text size="xs" c="cyan"><b>Mitigation:</b> {r.mitigation}</Text>
                </Paper>
              ))}
            </Stack>
          </Paper>
        )}

        {/* AI Category Analysis */}
        {aiEval?.categoryAnalysis?.length > 0 && (
          <Paper p="lg" radius="md" mb="xl" style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
            <Group mb="md">
              <IconBrain size={20} color="#3b82f6" />
              <Title order={4}>AI Category Analysis</Title>
            </Group>
            <Table style={{ color: '#f8fafc' }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Category</Table.Th>
                  <Table.Th>AI Score</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>ISO/NIST Ref</Table.Th>
                  <Table.Th>Evidence</Table.Th>
                  <Table.Th>Findings</Table.Th>
                  <Table.Th>Recommendation</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {aiEval.categoryAnalysis.map((c, i) => (
                  <Table.Tr key={i}>
                    <Table.Td fw={500}>{c.category}</Table.Td>
                    <Table.Td><Badge color={c.score >= 70 ? 'green' : c.score >= 40 ? 'yellow' : 'red'} variant="light">{c.score}</Badge></Table.Td>
                    <Table.Td><Badge color={SEVERITY_COLORS[c.status] || 'blue'} variant="dot">{c.status}</Badge></Table.Td>
                    <Table.Td><Text size="xs" c="dimmed">{c.isoReference}</Text></Table.Td>
                    <Table.Td><Badge size="xs" color={c.evidenceStatus === 'Adequate' ? 'green' : c.evidenceStatus === 'Insufficient' ? 'yellow' : 'red'}>{c.evidenceStatus || 'N/A'}</Badge></Table.Td>
                    <Table.Td><Text size="xs">{c.findings}</Text></Table.Td>
                    <Table.Td><Text size="xs" c="cyan">{c.recommendation}</Text></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        )}

        {/* AI Recommendations */}
        {aiEval?.recommendations?.length > 0 && (
          <Paper p="lg" radius="md" mb="xl" style={{ backgroundColor: '#0f172a', border: '1px solid #22c55e30' }}>
            <Title order={4} mb="md">AI Recommendations</Title>
            <SimpleGrid cols={{ base: 1, md: 3 }}>
              {['Immediate', 'Short-term', 'Long-term'].map(priority => {
                const items = aiEval.recommendations.filter(r => r.priority === priority);
                if (items.length === 0) return null;
                return (
                  <Paper key={priority} p="md" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
                    <Badge color={priority === 'Immediate' ? 'red' : priority === 'Short-term' ? 'yellow' : 'blue'} mb="sm">{priority}</Badge>
                    <Stack gap="xs">
                      {items.map((r, i) => (
                        <div key={i}>
                          <Text size="sm" fw={500}>{r.action}</Text>
                          <Text size="xs" c="dimmed">{r.rationale}</Text>
                        </div>
                      ))}
                    </Stack>
                  </Paper>
                );
              })}
            </SimpleGrid>
          </Paper>
        )}

        {/* Category Breakdown Table */}
        <Paper p="lg" radius="md" mb="xl" style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
          <Title order={4} mb="md">Category Breakdown</Title>
          <Table style={{ color: '#f8fafc' }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Category</Table.Th>
                <Table.Th>Standard</Table.Th>
                <Table.Th>Score</Table.Th>
                <Table.Th>Compliant</Table.Th>
                <Table.Th>Gaps</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {report.categories.map(c => (
                <Table.Tr key={c.name}>
                  <Table.Td fw={500}>{c.name}</Table.Td>
                  <Table.Td><Badge color="blue" variant="light" size="sm">{c.standard}</Badge></Table.Td>
                  <Table.Td><Badge color={c.score >= 80 ? 'green' : c.score >= 50 ? 'yellow' : 'red'} variant="light">{c.score}%</Badge></Table.Td>
                  <Table.Td><Text c="green">{c.compliant}</Text></Table.Td>
                  <Table.Td><Text c="red">{c.gaps}</Text></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>

        {/* Gaps */}
        {report.gaps.length > 0 && (
          <Paper p="lg" radius="md" mb="xl" style={{ backgroundColor: '#0f172a', border: '1px solid #ef444430' }}>
            <Group mb="md">
              <IconAlertTriangle size={20} color="#ef4444" />
              <Title order={4}>Identified Gaps ({report.gaps.length})</Title>
            </Group>
            <Stack gap="sm">
              {report.gaps.map(g => (
                <Paper key={g.questionId} p="sm" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
                  <Group justify="space-between" align="flex-start">
                    <div style={{ flex: 1 }}>
                      <Group gap="xs" mb={4}>
                        <Badge color="red" variant="light" size="xs">{g.category}</Badge>
                        <Badge color="blue" variant="dot" size="xs">{g.standardName} - {g.clauseNumber}</Badge>
                        {!g.answered && <Badge color="yellow" variant="light" size="xs">Not Answered</Badge>}
                      </Group>
                      <Text size="sm">{g.questionText}</Text>
                      {g.comment && <Text size="xs" c="dimmed" mt={4}>Comment: {g.comment}</Text>}
                    </div>
                    <IconX size={16} color="#ef4444" style={{ flexShrink: 0 }} />
                  </Group>
                </Paper>
              ))}
            </Stack>
          </Paper>
        )}

        {/* Strengths */}
        {report.strengths.length > 0 && (
          <Paper p="lg" radius="md" mb="xl" style={{ backgroundColor: '#0f172a', border: '1px solid #22c55e30' }}>
            <Group mb="md">
              <IconShieldCheck size={20} color="#22c55e" />
              <Title order={4}>Controls Met ({report.strengths.length})</Title>
            </Group>
            <Stack gap="sm">
              {report.strengths.map(s => (
                <Paper key={s.questionId} p="sm" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
                  <Group justify="space-between" align="flex-start">
                    <div style={{ flex: 1 }}>
                      <Group gap="xs" mb={4}>
                        <Badge color="green" variant="light" size="xs">{s.category}</Badge>
                        <Badge color="blue" variant="dot" size="xs">{s.standardName} - {s.clauseNumber}</Badge>
                      </Group>
                      <Text size="sm">{s.questionText}</Text>
                    </div>
                    <IconCheck size={16} color="#22c55e" style={{ flexShrink: 0 }} />
                  </Group>
                </Paper>
              ))}
            </Stack>
          </Paper>
        )}

        {/* Full Text Report */}
        {aiEval?.fullReport && (
          <Paper p="lg" radius="md" mb="xl" style={{ backgroundColor: '#0f172a', border: '1px solid #3b82f6' }}>
            <Group justify="space-between" mb="md">
              <Group>
                <IconFileText size={20} color="#3b82f6" />
                <Title order={4}>Full Audit Report (AI Generated)</Title>
              </Group>
              <Button
                variant="light"
                color="blue"
                size="xs"
                onClick={() => {
                  const blob = new Blob([aiEval.fullReport], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `security-audit-report-${new Date().toISOString().split('T')[0]}.md`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download Report
              </Button>
            </Group>
            <Paper p="md" style={{ backgroundColor: '#1e293b', border: '1px solid #334155', maxHeight: '600px', overflowY: 'auto' }}>
              <TypographyStylesProvider>
                <div
                  style={{ color: '#f8fafc', fontSize: '14px', lineHeight: 1.8 }}
                  dangerouslySetInnerHTML={{
                    __html: aiEval.fullReport
                      .replace(/^### (.*$)/gm, '<h3 style="color:#06b6d4;margin-top:1.5rem">$1</h3>')
                      .replace(/^## (.*$)/gm, '<h2 style="color:#3b82f6;margin-top:2rem;border-bottom:1px solid #334155;padding-bottom:0.5rem">$1</h2>')
                      .replace(/^# (.*$)/gm, '<h1 style="color:#f8fafc;margin-top:2rem">$1</h1>')
                      .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#e2e8f0">$1</strong>')
                      .replace(/^- (.*$)/gm, '<li style="margin-left:1rem">$1</li>')
                      .replace(/^(\d+)\. (.*$)/gm, '<li style="margin-left:1rem"><strong>$1.</strong> $2</li>')
                      .replace(/\n\n/g, '<br/><br/>')
                      .replace(/\n/g, '<br/>')
                  }}
                />
              </TypographyStylesProvider>
            </Paper>
          </Paper>
        )}
      </Container>
    </div>
  );
}
