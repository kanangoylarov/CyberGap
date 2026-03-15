import { useState } from 'react';
import { Paper, Title, Loader, Text, Stack, Group, Badge, Button, Collapse } from '@mantine/core';
import { IconCheck, IconX, IconWand, IconTrash } from '@tabler/icons-react';
import { deleteResponse } from '../api/responses';
import { triggerAiAnalysis, getAiAnalysis } from '../api/analysis';

export default function ResponsesTab({ responses, loading, userId, fetchData }) {
  const [aiData, setAiData] = useState({});
  const [aiLoading, setAiLoading] = useState({});

  const handleDelete = async (id) => {
    if(!window.confirm("Delete this evidence?")) return;
    try {
      await deleteResponse(id);
      fetchData();
    } catch(err) {
      console.error(err);
    }
  };

  const handleAiAnalysis = async (responseId) => {
    setAiLoading(prev => ({ ...prev, [responseId]: true }));
    try {
      // Trigger new analysis 
      await triggerAiAnalysis(responseId);
      // Fetch the updated analysis 
      const data = await getAiAnalysis(responseId);
      setAiData(prev => ({ ...prev, [responseId]: data }));
    } catch(err) {
      console.error(err);
      alert('Failed to analyze: ' + err.message);
    } finally {
      setAiLoading(prev => ({ ...prev, [responseId]: false }));
    }
  };

  return (
    <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}>
      <Title order={3} mb="md">My Submitted Evidence</Title>
      {loading ? (
        <Group justify="center" p="xl"><Loader color="blue" /></Group>
      ) : responses.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">You haven't submitted any responses yet.</Text>
      ) : (
        <Stack>
          {responses.map((r) => (
            <Paper key={r.id} p="md" withBorder style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
              <Group justify="space-between" align="flex-start">
                <div style={{ flex: 1 }}>
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
                  
                  {/* AI Analysis Section */}
                  <Collapse in={!!aiData[r.id]}>
                    {aiData[r.id] && (
                       <Paper mt="md" p="sm" withBorder style={{ backgroundColor: '#0f172a', borderColor: '#3b82f6' }}>
                         <Group mb="xs">
                           <IconWand size={16} color="#3b82f6"/>
                           <Text fw={600} size="sm" c="blue.4">AI Evaluation Score: {aiData[r.id].ai_score}/100</Text>
                         </Group>
                         <Text size="xs" mb="xs"><b>Gap Analysis:</b> {aiData[r.id].gap_analysis}</Text>
                         <Text size="xs"><b>Recommendation:</b> {aiData[r.id].recommendation}</Text>
                       </Paper>
                    )}
                  </Collapse>

                </div>
                
                <Group>
                  <Button 
                    variant="light" 
                    color="grape" 
                    size="xs" 
                    leftSection={<IconWand size={14} />}
                    loading={aiLoading[r.id]}
                    onClick={() => handleAiAnalysis(r.id)}
                  >
                    AI Analyze
                  </Button>
                  <Button 
                    variant="subtle" 
                    color="red" 
                    size="xs" 
                    onClick={() => handleDelete(r.id)}
                  >
                    Delete
                  </Button>
                </Group>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </Paper>
  );
}
