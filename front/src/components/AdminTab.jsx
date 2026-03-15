import { useState, useEffect } from 'react';
import { Paper, Title, Alert, SimpleGrid, Autocomplete, TextInput, Button, Table, ActionIcon, Group } from '@mantine/core';
import { IconTrash, IconEdit } from '@tabler/icons-react';
import { createQuestion, deleteQuestion, updateQuestion, getQuestions } from '../api/questions';

export default function AdminTab({ fetchData }) {
  const [questions, setQuestions] = useState([]);
  const [newQuestion, setNewQuestion] = useState({ standardName: '', category: '', clauseNumber: '', questionText: '' });
  const [editingId, setEditingId] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminMsg, setAdminMsg] = useState({ type: '', text: '' });

  const loadQuestions = async () => {
    try {
      const data = await getQuestions({ limit: 100 });
      setQuestions(data.data || []);
    } catch(err) {
      console.error(err);
    }
  };

  useEffect(() => { loadQuestions(); }, []);

  const standardOptions = [...new Set(['ISO 27001', 'NIST CSF', ...questions.map(q => q.standardName).filter(Boolean)])];
  const categoryOptions = [...new Set(['Access Control', 'Network Security', ...questions.map(q => q.category).filter(Boolean)])];
  const clauseOptions = [...new Set(['4.1', '5.1', ...questions.map(q => q.clauseNumber).filter(Boolean)])].sort();

  const handleSaveQuestion = async () => {
    if (!newQuestion.questionText || !newQuestion.standardName) {
      setAdminMsg({ type: 'error', text: 'Standard Name and Question Text are required fields.' });
      return;
    }
    try {
      setAdminLoading(true);
      setAdminMsg({ type: '', text: '' });
      if (editingId) {
        await updateQuestion(editingId, newQuestion);
        setAdminMsg({ type: 'success', text: 'Question updated successfully!' });
      } else {
        await createQuestion(newQuestion);
        setAdminMsg({ type: 'success', text: 'Question added successfully!' });
      }
      setEditingId(null);
      setNewQuestion({ standardName: '', category: '', clauseNumber: '', questionText: '' });
      await loadQuestions();
      await fetchData();
    } catch (err) {
      setAdminMsg({ type: 'error', text: err.message });
    } finally {
      setAdminLoading(false);
    }
  };

  const handleEdit = (q) => {
    setEditingId(q.id);
    setNewQuestion({ standardName: q.standardName, category: q.category, clauseNumber: q.clauseNumber, questionText: q.questionText });
  };

  const handleDelete = async (id) => {
    try {
      await deleteQuestion(id);
      await loadQuestions();
      await fetchData();
    } catch(err) {
      setAdminMsg({ type: 'error', text: err.message });
    }
  };

  return (
    <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}>
      <Title order={3} mb="md">{editingId ? 'Edit Question' : 'Add New Question'}</Title>
      
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
          value={newQuestion.standardName}
          onChange={(val) => setNewQuestion({...newQuestion, standardName: val})}
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
        <TextInput 
          label="Clause Number" 
          placeholder="Select or type (e.g. 9.1.1)" 
          value={newQuestion.clauseNumber}
          onChange={(e) => setNewQuestion({...newQuestion, clauseNumber: e.currentTarget.value})}
          styles={{ input: { backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }, label: {color: '#f8fafc'} }}
        />
        <TextInput 
          label="Question Text" 
          placeholder="State the audit requirement..." 
          value={newQuestion.questionText}
          onChange={(e) => setNewQuestion({...newQuestion, questionText: e.currentTarget.value})}
          styles={{ input: { backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }, label: {color: '#f8fafc'} }}
        />
      </SimpleGrid>
      <Group mb="xl">
        <Button onClick={handleSaveQuestion} loading={adminLoading} color="blue">
          {editingId ? 'Update Question' : 'Create Question'}
        </Button>
        {editingId && <Button variant="subtle" color="gray" onClick={() => { setEditingId(null); setNewQuestion({ standardName: '', category: '', clauseNumber: '', questionText: '' }) }}>Cancel</Button>}
      </Group>

      <Title order={4} mb="sm">Manage Questions</Title>
      <Table variant="vertical" highlightOnHover style={{ color: '#f8fafc' }}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Standard</Table.Th>
            <Table.Th>Category</Table.Th>
            <Table.Th>Text</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {questions.map((q) => (
            <Table.Tr key={q.id}>
              <Table.Td>{q.standardName}</Table.Td>
              <Table.Td>{q.category}</Table.Td>
              <Table.Td>{q.questionText}</Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <ActionIcon color="blue" onClick={() => handleEdit(q)}><IconEdit size={16} /></ActionIcon>
                  <ActionIcon color="red" onClick={() => handleDelete(q.id)}><IconTrash size={16} /></ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
