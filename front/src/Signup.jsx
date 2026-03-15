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
  Title, 
  Image,
  SimpleGrid,
  Alert
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router-dom';
import myLogo from './assets/logo.png'; 
import { signup } from './api/auth';

export default function Signup() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signup({ firstName, lastName, email, company, password });

      // Kayıt başarılı ise login safyasına yönlendir (veya direkt login yap)
      navigate('/login');
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
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
      <Container size={500} w="100%">
        <Paper 
          withBorder
          p={40} 
          radius="md" 
          style={{ 
            backgroundColor: '#020817', 
            borderColor: '#1e293b' 
          }}
        >
          <Stack gap="xs" mb={28} align="center">
            <Image src={myLogo} alt="Logo" width={100} height={100} fit="contain" />
            <Title order={2} style={{ color: '#f8fafc', fontWeight: 600, letterSpacing: '-0.5px' }}>
              Create an Account
            </Title>
          </Stack>

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" mb="md" variant="filled">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSignup}>
            <Stack gap="md">
              <SimpleGrid cols={2}>
                <TextInput
                  label="First Name"
                  placeholder="John"
                  required
                  variant="filled"
                  value={firstName}
                  onChange={(e) => setFirstName(e.currentTarget.value)}
                  styles={inputStyles}
                />
                <TextInput
                  label="Last Name"
                  placeholder="Doe"
                  required
                  variant="filled"
                  value={lastName}
                  onChange={(e) => setLastName(e.currentTarget.value)}
                  styles={inputStyles}
                />
              </SimpleGrid>

              <TextInput
                label="Email Address"
                placeholder="john.doe@company.com"
                required
                variant="filled"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                styles={inputStyles}
              />

              <TextInput
                label="Company Name"
                placeholder="TechCorp Ltd."
                variant="filled"
                value={company}
                onChange={(e) => setCompany(e.currentTarget.value)}
                styles={inputStyles}
              />

              <PasswordInput
                label="Password"
                placeholder="Create a strong password"
                required
                variant="filled"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                styles={inputStyles}
              />

              <Button 
                type="submit"
                fullWidth 
                mt="xl" 
                radius="md" 
                size="md" 
                loading={loading}
                style={{ backgroundColor: '#f8fafc', color: '#020817', fontWeight: 600 }}
              >
                Create Account
              </Button>
            </Stack>
          </form>

          <Text size="sm" c="dimmed" ta="center" mt="xl">
            Already have an account?{' '}
            <Text 
              span 
              c="blue.4" 
              inherit 
              component={Link} 
              to="/login" 
              style={{ cursor: 'pointer', fontWeight: 500 }}
            >
              Sign In
            </Text>
          </Text>
        </Paper>
      </Container>
    </Box>
  );
}

// Reusable styles for Mantine Inputs to keep code clean
const inputStyles = {
  input: { backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' },
  label: { color: '#94a3b8', marginBottom: '6px', fontSize: '13px' }
};