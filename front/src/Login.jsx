import { useState } from 'react';
import { 
  TextInput, 
  PasswordInput, 
  Button, 
  Paper, 
  Text, 
  Container, 
  Box, 
  Stack,
  Divider,
  Title,
  Image,
  Alert
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

import { signin } from './api/auth';
import myLogo from './assets/logo.png'; 
import { Link, useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await signin(email, password);

      // Backend'in donduyu user id-ni ve admin yetkisini saxlayin
      localStorage.setItem('token', data.token); // Add this for token storage
      localStorage.setItem('userId', data.user.id);
      localStorage.setItem('isAdmin', data.user.is_admin || data.user.isAdmin ? 'true' : 'false');
      navigate('/dashboard'); 
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box 
      style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#020817' 
      }}
    >
      <Container size={480} w="100%">
        <Paper 
          withBorder 
          p={45}
          radius="md" 
          style={{ 
            backgroundColor: '#020817', 
            borderColor: '#1e293b' 
          }}
        >
          <Stack gap="sm" mb={32} align="center">
            <Image 
              src={myLogo} 
              alt="Cyber Audit Logo" 
              width={100}
              height={100}
              fit="contain" 
            />
             <Title order={2} style={{ color: '#f8fafc', fontWeight: 600, letterSpacing: '-0.5px' }}>
              Login
            </Title>
          </Stack>

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" mb="md" variant="filled">
              {error}
            </Alert>
          )}

          <form onSubmit={handleLogin}>
            <Stack gap="lg">
              <TextInput
                label="Email Address"
                placeholder="name@company.com"
                required
                variant="filled"
                size="md"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                styles={{
                  input: { backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' },
                  label: { color: '#94a3b8', marginBottom: '8px', fontSize: '14px' }
                }}
              />

              <PasswordInput
                label="Password"
                placeholder="••••••••"
                required
                variant="filled"
                size="md"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                styles={{
                  input: { backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' },
                  label: { color: '#94a3b8', marginBottom: '8px', fontSize: '14px' }
                }}
              />

              <Button 
                type="submit"
                fullWidth 
                mt="xl" 
                radius="md" 
                size="lg"
                loading={loading}
                style={{ 
                  backgroundColor: '#f8fafc', 
                  color: '#020817', 
                  fontWeight: 600 
                }}
              >
                Sign In
              </Button>
            </Stack>
          </form>

          <Divider my={30} label="OR" labelPosition="center" color="#1e293b" />

          <Text size="sm" c="dimmed" ta="center">
            Don't have an account? <Text span c="blue.4" component={Link} to="/signup" inherit style={{ cursor: 'pointer', fontWeight: 500 }}>Request access</Text>
          </Text>
        </Paper>
      </Container>
    </Box>
  );
}