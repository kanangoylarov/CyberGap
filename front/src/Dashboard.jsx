import { useEffect, useState } from 'react';
import { 
  Container, Title, Text, Paper, Button, Stack, Group, Badge, SimpleGrid, 
  Loader, Tabs, TextInput, Select, Autocomplete, Modal, Textarea, FileInput, Radio, Alert 
} from '@mantine/core';
import { IconSearch, IconUpload, IconAlertCircle, IconCheck, IconX, IconFileCheck } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  
  // Data States
  const [questions, setQuestions] = useState([]);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [standardFilter, setStandardFilter] = useState('');
  
  // Modal & Form States
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [modalOpened, setModalOpened] = useState(false);
  const [answer, setAnswer] = useState('yes'); // 'yes' | 'no'
  const [comment, setComment] = useState('');
  const [file, setFile] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Admin Question Creation States
  const [newQuestion, setNewQuestion] = useState({
    standard_name: '',
    category: '',
    clause_number: '',
    question_text: ''
  });
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminMsg, setAdminMsg] = useState({ type: '', text: '' });

  const userId = localStorage.getItem('userId');
  const isAdmin = localStorage.getItem('isAdmin') === 'true'; // Admin kontrolü

  useEffect(() => {
    if (!userId) {
      navigate('/login');
      return;
    }
    fetchData();
  }, [navigate, userId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Questions
      const questionsRes = await fetch('http://localhost:3000/api/questions');
      if (questionsRes.ok) {
        const qData = await questionsRes.json();
        setQuestions(qData);
      }

      // 2. Fetch User Responses 
      const responsesRes = await fetch(`http://localhost:3000/api/responses/user/${userId}`);
      if (responsesRes.ok) {
        const rData = await responsesRes.json();
        setResponses(Array.isArray(rData) ? rData : []);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('isAdmin');
    navigate('/login');
  };

  const openAnswerModal = (question) => {
    setSelectedQuestion(question);
    setAnswer('yes');
    setComment('');
    setFile(null);
    setSubmitError('');
    setModalOpened(true);
  };

  const handleSubmitResponse = async () => {
    if (!selectedQuestion) return;
    setSubmitLoading(true);
    setSubmitError('');

    try {
      // FormData for File Upload
      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('question_id', selectedQuestion.id);
      formData.append('answer', answer === 'yes'); // Convert to boolean
      formData.append('comment', comment);
      
      if (file) {
        formData.append('file', file);
      }

      const res = await fetch('http://localhost:3000/api/responses', {
        method: 'POST',
        body: formData, // Auto sets multipart/form-data
      });

      if (!res.ok) {
        throw new Error('Failed to submit response');
      }

      // Refresh Data after successful upload
      setModalOpened(false);
      await fetchData();
    } catch (err) {
      setSubmitError(err.message || 'An error occurred during submission.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Filter Logic
  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.question_text?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          q.category?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStandard = standardFilter ? q.standard_name === standardFilter : true;
    return matchesSearch && matchesStandard;
  });

  // Extract unique and predefined options for dropdowns
  const standardOptions = [...new Set([
    'ISO 27001', 'NIST CSF', 'SOC 2', 'GDPR', 'HIPAA', 'PCI-DSS', 
    ...questions.map(q => q.standard_name).filter(Boolean)
  ])];

  const categoryOptions = [...new Set([
    'Access Control', 'Network Security', 'HR Security', 'Asset Management', 
    'Cryptography', 'Physical Security', 'Incident Response', 'Business Continuity', 
    'Compliance', 'Risk Management',
    ...questions.map(q => q.category).filter(Boolean)
  ])];

  const clauseOptions = [...new Set([
    '4.1', '5.1', '6.1.1', '7.2', '8.1', '9.1', '10.1', '11.1', 'A.5', 'A.6', 'A.7', 'A.8', 'A.9', 
    ...questions.map(q => q.clause_number).filter(Boolean)
  ])].sort();

  const uniqueStandards = [...new Set(questions.map(q => q.standard_name).filter(Boolean))];

  // Admin: Create Question
  const handleCreateQuestion = async () => {
    if (!newQuestion.question_text || !newQuestion.standard_name) {
      setAdminMsg({ type: 'error', text: 'Standard Name and Question Text are required fields.' });
      return;
    }

    try {
      setAdminLoading(true);
      setAdminMsg({ type: '', text: '' });
      const res = await fetch('http://localhost:3000/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newQuestion)
      });
      
      let resData;
      try {
        resData = await res.json();
      } catch (e) {
        resData = null;
      }

      if (!res.ok) throw new Error(resData?.message || resData?.error || "Failed to create question. Check backend logs.");
      
      setAdminMsg({ type: 'success', text: 'Question added successfully!' });
      setNewQuestion({ standard_name: '', category: '', clause_number: '', question_text: '' });
      await fetchData(); // Refresh questions
    } catch (err) {
      setAdminMsg({ type: 'error', text: err.message });
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#020817', minHeight: '100vh', color: '#f8fafc', padding: '2rem 0' }}>
      <Container size="xl">
        {/* Header */}
        <Group justify="space-between" mb="xl">
          <div>
            <Title order={1} style={{ letterSpacing: '-1px' }}>GRC Audit Portal</Title>
            <Text c="dimmed">Cybersecurity Compliance Dashboard</Text>
          </div>
          <Button variant="outline" color="red" onClick={handleLogout}>Log Out</Button>
        </Group>

        {/* Dashboard Tabs */}
        <Tabs defaultValue="questions" variant="pills" radius="md" color="blue">
          <Tabs.List mb="lg">
            <Tabs.Tab value="questions" leftSection={<IconSearch size={16} />}>
              Audit Questions
            </Tabs.Tab>
            <Tabs.Tab value="responses" leftSection={<IconFileCheck size={16} />}>
              My Responses
            </Tabs.Tab>
            {isAdmin && (
              <Tabs.Tab value="admin" leftSection={<IconAlertCircle size={16} />}>
                Admin Panel
              </Tabs.Tab>
            )}
          </Tabs.List>

          {/* QUESTIONS TAB */}
          <Tabs.Panel value="questions">
            <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}>
              
              {/* Controls */}
              <Group mb="xl" grow>
                <TextInput
                  placeholder="Search questions or categories..."
                  leftSection={<IconSearch size={16} />}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.currentTarget.value)}
                  styles={{ input: { backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' } }}
                />
                <Select
                  placeholder="Filter by Standard"
                  data={['', ...uniqueStandards].map(s => ({ value: s, label: s || 'All Standards' }))}
                  value={standardFilter}
                  onChange={setStandardFilter}
                  styles={{ input: { backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' } }}
                />
              </Group>

              {/* Grid */}
              {loading ? (
                <Group justify="center" p="xl"><Loader color="blue" /></Group>
              ) : filteredQuestions.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">No questions found.</Text>
              ) : (
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                  {filteredQuestions.map((q) => {
                    const hasAnswered = responses.some(r => r.question_id === q.id);
                    return (
                      <Paper key={q.id} p="md" radius="sm" withBorder style={{ backgroundColor: '#1e293b', borderColor: '#334155', display: 'flex', flexDirection: 'column' }}>
                        <Group justify="space-between" mb="xs">
                          <Badge color="blue" variant="light">{q.standard_name}</Badge>
                          <Badge color="teal" variant="dot">{q.category}</Badge>
                        </Group>
                        <Text fw={600} size="sm" mb="xs" c="cyan.4">Clause: {q.clause_number}</Text>
                        <Text size="sm" style={{ flexGrow: 1 }} mb="md">{q.question_text}</Text>
                        
                        <Button 
                          variant={hasAnswered ? "outline" : "light"} 
                          color={hasAnswered ? "green" : "cyan"} 
                          fullWidth 
                          size="xs"
                          onClick={() => openAnswerModal(q)}
                        >
                          {hasAnswered ? "Update Evidence" : "Submit Evidence"}
                        </Button>
                      </Paper>
                    );
                  })}
                </SimpleGrid>
              )}
            </Paper>
          </Tabs.Panel>

          {/* RESPONSES TAB */}
          <Tabs.Panel value="responses">
            <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}>
              <Title order={3} mb="md">My Submitted Evidence</Title>
              {loading ? (
                <Group justify="center" p="xl"><Loader color="blue" /></Group>
              ) : responses.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">You haven't submitted any responses yet.</Text>
              ) : (
                <Stack>
                  {responses.map((r, idx) => (
                    <Paper key={idx} p="md" withBorder style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
                      <Group justify="space-between">
                        <div>
                          <Text size="sm" c="dimmed">Question ID: {r.question_id}</Text>
                          <Group gap="xs" mt={4}>
                            <Text fw={500}>Compliance:</Text>
                            {r.answer ? <Badge color="green" leftSection={<IconCheck size={12}/>}>Yes</Badge> : <Badge color="red" leftSection={<IconX size={12}/>}>No / Gap</Badge>}
                          </Group>
                          <Text mt="xs" size="sm"><b>Comment:</b> {r.comment || 'N/A'}</Text>
                          {r.file_path && (
                            <Text mt="xs" size="sm" c="blue.4" component="a" href={r.file_path} target="_blank">
                              📄 View Attached Evidence
                            </Text>
                          )}
                        </div>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Paper>
          </Tabs.Panel>

          {/* ADMIN TAB (Visible Only To Admins) */}
          {isAdmin && (
            <Tabs.Panel value="admin">
              <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}>
                  <Title order={3} mb="md">Add New Question</Title>
                  
                  {adminMsg.text && (
                    <Alert color={adminMsg.type === 'error' ? 'red' : 'green'} mb="md">
                      {adminMsg.text}
                    </Alert>
                  )}

                  <SimpleGrid cols={2} mb="md">
                    <Autocomplete 
                      label="Standard Name" 
                      placeholder="Select or type (e.g. ISO 27001)" 
                      data={standardOptions}
                      value={newQuestion.standard_name}
                      onChange={(val) => setNewQuestion({...newQuestion, standard_name: val})}
                      styles={{ input: { backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }, label: {color: '#f8fafc'} }}
                    />
                    <Autocomplete 
                      label="Category" 
                      placeholder="Select or type (e.g. Access Control)" 
                      data={categoryOptions}
                      value={newQuestion.category}
                      onChange={(val) => setNewQuestion({...newQuestion, category: val})}
                      styles={{ input: { backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }, label: {color: '#f8fafc'} }}
                    />
                    <Autocomplete 
                      label="Clause Number" 
                      placeholder="Select or type (e.g. 9.1.1)" 
                      data={clauseOptions}
                      value={newQuestion.clause_number}
                      onChange={(val) => setNewQuestion({...newQuestion, clause_number: val})}
                      styles={{ input: { backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }, label: {color: '#f8fafc'} }}
                    />
                    <TextInput 
                      label="Question Text" 
                      placeholder="State the audit requirement..." 
                      value={newQuestion.question_text}
                      onChange={(e) => setNewQuestion({...newQuestion, question_text: e.currentTarget.value})}
                      styles={{ input: { backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }, label: {color: '#f8fafc'} }}
                    />
                  </SimpleGrid>
                  <Button 
                    onClick={handleCreateQuestion} 
                    loading={adminLoading}
                    color="blue"
                  >
                    Create Question
                  </Button>
              </Paper>
            </Tabs.Panel>
          )}
        </Tabs>
      </Container>

      {/* SUBMISSION MODAL */}
      <Modal 
        opened={modalOpened} 
        onClose={() => setModalOpened(false)} 
        title={<Title order={4}>Submit Audit Evidence</Title>}
        styles={{ 
          header: { backgroundColor: '#0f172a', color: '#f8fafc' },
          content: { backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #1e293b' }
        }}
      >
        {selectedQuestion && (
          <Stack>
            {submitError && <Alert icon={<IconAlertCircle size={16} />} color="red">{submitError}</Alert>}
            
            <Paper p="xs" withBorder style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
               <Text size="sm" fw={600} c="cyan.4">Clause: {selectedQuestion.clause_number}</Text>
               <Text size="sm">{selectedQuestion.question_text}</Text>
            </Paper>

            <Radio.Group
              label="Are you compliant with this requirement?"
              value={answer}
              onChange={setAnswer}
              withAsterisk
              styles={{ label: { color: '#f8fafc', marginBottom: '8px' } }}
            >
              <Group mt="xs">
                <Radio value="yes" label="Yes, Implemented" color="green" />
                <Radio value="no" label="No, Gap Identified" color="red" />
              </Group>
            </Radio.Group>

            <Textarea
              label="Auditor Comment / Justification"
              placeholder="Explain the implementation or the gap..."
              value={comment}
              onChange={(e) => setComment(e.currentTarget.value)}
              minRows={3}
              styles={{
                input: { backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' },
                label: { color: '#f8fafc' }
              }}
            />

            <FileInput
              label="Evidence Document (PDF)"
              placeholder="Upload Policy/Evidence file"
              leftSection={<IconUpload size={14} />}
              value={file}
              onChange={setFile}
              accept="application/pdf"
              styles={{
                input: { backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' },
                label: { color: '#f8fafc' }
              }}
            />

            <Button 
              fullWidth 
              mt="md" 
              color="cyan" 
              onClick={handleSubmitResponse} 
              loading={submitLoading}
            >
              Submit Response
            </Button>
          </Stack>
        )}
      </Modal>
    </div>
  );
}
