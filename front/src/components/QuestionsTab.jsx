import { useState, useEffect } from 'react';
import { Paper, Group, TextInput, Select, Loader, Text, SimpleGrid, Badge, Button, Pagination } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { getQuestions } from '../api/questions';

export default function QuestionsTab({ responses, openAnswerModal }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [standardFilter, setStandardFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchTabQuestions = async () => {
    setLoading(true);
    try {
      const qData = await getQuestions({ 
        search: searchQuery, 
        standard: standardFilter, 
        page, 
        limit: 10 
      });
      setQuestions(qData.data || []);
      setTotalPages(qData.meta?.total ? Math.ceil(qData.meta.total / 10) : 1);
    } catch (err) {
      console.error("Failed to fetch questions", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTabQuestions();
  }, [searchQuery, standardFilter, page]);

  return (
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
          data={[
            { value: '', label: 'All Standards' },
            { value: 'ISO 27001', label: 'ISO 27001' },
            { value: 'NIST CSF', label: 'NIST CSF' }
          ]}
          value={standardFilter}
          onChange={setStandardFilter}
          styles={{ input: { backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' } }}
        />
      </Group>

      {/* Grid */}
      {loading ? (
        <Group justify="center" p="xl"><Loader color="blue" /></Group>
      ) : questions.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">No questions found.</Text>
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
            {questions.map((q) => {
              const hasAnswered = responses.some(r => r.questionId === q.id);
              return (
                <Paper key={q.id} p="md" radius="sm" withBorder style={{ backgroundColor: '#1e293b', borderColor: '#334155', display: 'flex', flexDirection: 'column' }}>
                  <Group justify="space-between" mb="xs">
                    <Badge color="blue" variant="light">{q.standardName}</Badge>
                    <Badge color="teal" variant="dot">{q.category}</Badge>
                  </Group>
                  <Text fw={600} size="sm" mb="xs" c="cyan.4">Clause: {q.clauseNumber}</Text>
                  <Text size="sm" style={{ flexGrow: 1 }} mb="md">{q.questionText}</Text>
                  
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
          {totalPages > 1 && (
            <Group justify="center" mt="xl">
              <Pagination total={totalPages} value={page} onChange={setPage} color="blue" />
            </Group>
          )}
        </>
      )}
    </Paper>
  );
}
