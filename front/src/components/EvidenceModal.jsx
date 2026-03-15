import { useState, useEffect } from 'react';
import { Modal, Title, Stack, Alert, Paper, Text, Radio, Group, Textarea, FileInput, Button } from '@mantine/core';
import { IconAlertCircle, IconUpload } from '@tabler/icons-react';
import { createResponse } from '../api/responses';

export default function EvidenceModal({ opened, onClose, selectedQuestion, userId, fetchData }) {
  const [answer, setAnswer] = useState('yes');
  const [comment, setComment] = useState('');
  const [file, setFile] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Reset states when opened
  useEffect(() => {
    if (opened) {
      setAnswer('yes');
      setComment('');
      setFile(null);
      setSubmitError('');
    }
  }, [opened]);

  const handleSubmitResponse = async () => {
    if (!selectedQuestion) return;
    setSubmitLoading(true);
    setSubmitError('');

    try {
      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('question_id', selectedQuestion.id);
      formData.append('answer', answer === 'yes');
      formData.append('comment', comment);
      if (file) formData.append('file', file);

      await createResponse(formData);
      
      onClose();
      await fetchData();
    } catch (err) {
      setSubmitError(err.message || 'An error occurred during submission.');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <Modal 
      opened={opened} 
      onClose={onClose} 
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
  );
}
