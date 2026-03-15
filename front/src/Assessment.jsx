import { useEffect, useState } from 'react';
import {
  Container, Title, Text, Paper, Button, Group, Stack, Progress, Badge,
  Loader, SegmentedControl, Alert, Textarea, FileInput, Collapse
} from '@mantine/core';
import { IconArrowLeft, IconArrowRight, IconCheck, IconSend, IconUpload, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { getAllQuestionsGrouped, bulkSubmitAnswers, uploadFileForQuestion, triggerAnalysis } from './api/report';

export default function Assessment() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState({});
  const [categoryNames, setCategoryNames] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [comments, setComments] = useState({});
  const [files, setFiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitPhase, setSubmitPhase] = useState('');
  const [error, setError] = useState('');
  const [expandedQuestion, setExpandedQuestion] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const data = await getAllQuestionsGrouped();
      setCategories(data.categories || {});
      setCategoryNames(Object.keys(data.categories || {}));
      if (data.existingAnswers) {
        const existing = {};
        for (const [qId, ans] of Object.entries(data.existingAnswers)) {
          existing[parseInt(qId)] = ans;
        }
        setAnswers(existing);
      }
    } catch {
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const currentCategory = categoryNames[currentStep];
  const currentQuestions = categories[currentCategory] || [];
  const totalQuestions = Object.values(categories).flat().length;
  const answeredCount = Object.keys(answers).length;
  const progress = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const isCategoryComplete = (catName) => {
    const qs = categories[catName] || [];
    return qs.every(q => answers[q.id] !== undefined);
  };

  const handleAnswer = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleComment = (questionId, text) => {
    setComments(prev => ({ ...prev, [questionId]: text }));
  };

  const handleFile = (questionId, file) => {
    setFiles(prev => ({ ...prev, [questionId]: file }));
  };

  const toggleExpand = (questionId) => {
    setExpandedQuestion(prev => prev === questionId ? null : questionId);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');

    try {
      // Phase 1: Submit answers + comments
      setSubmitPhase('Saving responses...');
      const answerList = Object.entries(answers).map(([qId, ans]) => ({
        questionId: parseInt(qId),
        answer: ans,
        comment: comments[parseInt(qId)] || null,
      }));
      await bulkSubmitAnswers(answerList);

      // Phase 2: Upload files
      const fileEntries = Object.entries(files).filter(([, f]) => f);
      if (fileEntries.length > 0) {
        setSubmitPhase(`Uploading ${fileEntries.length} evidence files...`);
        for (const [qId, file] of fileEntries) {
          await uploadFileForQuestion(parseInt(qId), file);
        }
      }

      // Phase 3: Trigger Gemini analysis
      setSubmitPhase('Running AI security analysis...');
      try {
        await triggerAnalysis();
      } catch {
        // Analysis is optional - continue even if it fails
        console.warn('AI analysis failed, continuing to report');
      }

      navigate('/report');
    } catch (err) {
      setError(err.message || 'Failed to submit assessment.');
      setSubmitting(false);
      setSubmitPhase('');
    }
  };

  if (loading) {
    return (
      <div style={{ backgroundColor: '#020817', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader color="cyan" size="xl" />
      </div>
    );
  }

  // Submitting overlay
  if (submitting) {
    return (
      <div style={{ backgroundColor: '#020817', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
        <Loader color="cyan" size="xl" />
        <Title order={3} style={{ color: '#f8fafc' }}>{submitPhase}</Title>
        <Text c="dimmed">Please wait, this may take a moment...</Text>
      </div>
    );
  }

  if (categoryNames.length === 0) {
    return (
      <div style={{ backgroundColor: '#020817', minHeight: '100vh', color: '#f8fafc', padding: '2rem 0' }}>
        <Container size="md">
          <Alert color="yellow">No questions found. Please add questions from the Admin Panel first.</Alert>
          <Button mt="md" variant="light" onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </Container>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#020817', minHeight: '100vh', color: '#f8fafc', padding: '2rem 0' }}>
      <Container size="lg">
        {/* Header */}
        <Group justify="space-between" mb="lg">
          <div>
            <Title order={2} style={{ letterSpacing: '-0.5px' }}>Cybersecurity Assessment</Title>
            <Text c="dimmed" size="sm">Answer questions, add comments and upload evidence files</Text>
          </div>
          <Button variant="subtle" color="gray" onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </Group>

        {/* Progress */}
        <Paper p="md" radius="md" mb="lg" style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500}>Overall Progress</Text>
            <Text size="sm" c="dimmed">{answeredCount} of {totalQuestions} questions ({progress}%)</Text>
          </Group>
          <Progress value={progress} color="cyan" size="lg" radius="md" />
        </Paper>

        {/* Category Tabs */}
        <Group mb="lg" gap="xs" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
          {categoryNames.map((cat, idx) => (
            <Button
              key={cat}
              variant={idx === currentStep ? 'filled' : 'subtle'}
              color={isCategoryComplete(cat) ? 'green' : idx === currentStep ? 'cyan' : 'gray'}
              size="xs"
              leftSection={isCategoryComplete(cat) ? <IconCheck size={14} /> : null}
              onClick={() => setCurrentStep(idx)}
              style={{ flexShrink: 0 }}
            >
              {cat}
            </Button>
          ))}
        </Group>

        {/* Category Header */}
        <Paper p="md" radius="md" mb="md" style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed">Category {currentStep + 1} of {categoryNames.length}</Text>
              <Title order={3}>{currentCategory}</Title>
            </div>
            <Badge color="blue" size="lg">
              {currentQuestions.filter(q => answers[q.id] !== undefined).length} / {currentQuestions.length} answered
            </Badge>
          </Group>
        </Paper>

        {/* Questions */}
        <Stack gap="md" mb="xl">
          {currentQuestions.map((q) => {
            const answered = answers[q.id];
            const isExpanded = expandedQuestion === q.id;
            return (
              <Paper
                key={q.id}
                p="md"
                radius="md"
                style={{
                  backgroundColor: '#0f172a',
                  border: `1px solid ${answered === true ? '#22c55e40' : answered === false ? '#ef444440' : '#1e293b'}`,
                }}
              >
                {/* Question + Answer */}
                <Group justify="space-between" align="flex-start">
                  <div style={{ flex: 1 }}>
                    <Group gap="xs" mb="xs">
                      <Badge color="blue" variant="light" size="sm">{q.standardName}</Badge>
                      <Badge color="teal" variant="dot" size="sm">Clause {q.clauseNumber}</Badge>
                    </Group>
                    <Text size="sm" fw={500}>{q.questionText}</Text>
                  </div>
                  <SegmentedControl
                    value={answered === true ? 'yes' : answered === false ? 'no' : ''}
                    onChange={(val) => handleAnswer(q.id, val === 'yes')}
                    data={[
                      { label: 'Yes', value: 'yes' },
                      { label: 'No', value: 'no' },
                    ]}
                    color={answered === true ? 'green' : answered === false ? 'red' : 'gray'}
                    size="sm"
                    style={{ flexShrink: 0 }}
                  />
                </Group>

                {/* Expand toggle for comment + file */}
                <Button
                  variant="subtle"
                  color="gray"
                  size="xs"
                  mt="sm"
                  rightSection={isExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                  onClick={() => toggleExpand(q.id)}
                >
                  {comments[q.id] || files[q.id] ? 'Edit details' : 'Add comment / evidence'}
                </Button>

                <Collapse in={isExpanded}>
                  <Stack gap="sm" mt="sm" style={{ paddingLeft: '0.5rem', borderLeft: '2px solid #334155' }}>
                    <Textarea
                      placeholder="Explain your compliance status, justification, or notes..."
                      value={comments[q.id] || ''}
                      onChange={(e) => handleComment(q.id, e.currentTarget.value)}
                      minRows={2}
                      maxRows={5}
                      styles={{
                        input: { backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' },
                        label: { color: '#94a3b8' }
                      }}
                      label="Comment / Justification"
                    />
                    <FileInput
                      label="Evidence Document"
                      placeholder="Upload PDF, Word, or Excel file"
                      leftSection={<IconUpload size={14} />}
                      value={files[q.id] || null}
                      onChange={(file) => handleFile(q.id, file)}
                      accept="application/pdf,.doc,.docx,.xls,.xlsx"
                      clearable
                      styles={{
                        input: { backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' },
                        label: { color: '#94a3b8' }
                      }}
                    />
                  </Stack>
                </Collapse>
              </Paper>
            );
          })}
        </Stack>

        {/* Navigation */}
        {error && <Alert color="red" mb="md">{error}</Alert>}

        <Group justify="space-between">
          <Button
            variant="light"
            color="gray"
            leftSection={<IconArrowLeft size={16} />}
            disabled={currentStep === 0}
            onClick={() => setCurrentStep(s => s - 1)}
          >
            Previous
          </Button>

          <Group>
            {currentStep < categoryNames.length - 1 ? (
              <Button
                variant="light"
                color="cyan"
                rightSection={<IconArrowRight size={16} />}
                onClick={() => setCurrentStep(s => s + 1)}
              >
                Next Category
              </Button>
            ) : (
              <Button
                color="cyan"
                leftSection={<IconSend size={16} />}
                onClick={handleSubmit}
                disabled={answeredCount === 0}
              >
                Submit & Analyze ({answeredCount}/{totalQuestions})
              </Button>
            )}
          </Group>
        </Group>
      </Container>
    </div>
  );
}
