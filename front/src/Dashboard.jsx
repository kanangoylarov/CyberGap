import { useEffect, useState } from 'react';
import { 
  Container, Title, Text, Button, Group, Tabs 
} from '@mantine/core';
import { IconSearch, IconAlertCircle, IconFileCheck, IconUsers } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { getUserResponses } from './api/responses';
import { getRole, signout } from './api/auth';

import QuestionsTab from './components/QuestionsTab';
import ResponsesTab from './components/ResponsesTab';
import AdminTab from './components/AdminTab';
import UsersTab from './components/UsersTab';
import EvidenceModal from './components/EvidenceModal';

export default function Dashboard() {
  const navigate = useNavigate();

  // Data States
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [modalOpened, setModalOpened] = useState(false);

  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  useEffect(() => {
    checkAuthAndFetch();
  }, []);

  const checkAuthAndFetch = async () => {
    try {
      const roleData = await getRole();
      localStorage.setItem('isAdmin', roleData.role === 'admin' ? 'true' : 'false');
      await fetchData();
    } catch {
      navigate('/login');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const rData = await getUserResponses();
      setResponses(rData.data || []);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try { await signout(); } catch { /* ignore */ }
    localStorage.removeItem('isAdmin');
    navigate('/login');
  };

  const openAnswerModal = (question) => {
    setSelectedQuestion(question);
    setModalOpened(true);
  };

  return (
    <div style={{ backgroundColor: '#020817', minHeight: '100vh', color: '#f8fafc', padding: '2rem 0' }}>
      <Container size="xl">
        {/* Header */}
        <Group justify="space-between" mb="xl">
          <div>
            <Title order={1} style={{ letterSpacing: '-1px' }}>Heimdall AI</Title>
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
              <>
                <Tabs.Tab value="admin" leftSection={<IconAlertCircle size={16} />}>
                  Admin Panel
                </Tabs.Tab>
                <Tabs.Tab value="users" leftSection={<IconUsers size={16} />}>
                  Users
                </Tabs.Tab>
              </>
            )}
          </Tabs.List>

          {/* QUESTIONS TAB */}
          <Tabs.Panel value="questions">
            <QuestionsTab
              responses={responses}
              openAnswerModal={openAnswerModal}
            />
          </Tabs.Panel>

          {/* RESPONSES TAB */}
          <Tabs.Panel value="responses">
            <ResponsesTab
              responses={responses}
              loading={loading}
              fetchData={fetchData}
            />
          </Tabs.Panel>

          {/* ADMIN TAB */}
          {isAdmin && (
            <>
              <Tabs.Panel value="admin">
                <AdminTab
                  fetchData={fetchData}
                />
              </Tabs.Panel>
              
              <Tabs.Panel value="users">
                <UsersTab />
              </Tabs.Panel>
            </>
          )}
        </Tabs>
      </Container>

      {/* SUBMISSION MODAL */}
      <EvidenceModal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        selectedQuestion={selectedQuestion}
        fetchData={fetchData}
      />
    </div>
  );
}
