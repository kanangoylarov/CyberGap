import { useState, useEffect } from 'react';
import { Paper, Title, Table, Group, TextInput, Loader, Text, Pagination, Badge } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { getUsers } from '../api/users';

export default function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await getUsers({ search, page, limit: 10 });
      setUsers(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [search, page]);

  return (
    <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}>
      <Title order={3} mb="md">User Management</Title>
      
      <Group mb="xl">
        <TextInput
          placeholder="Search users..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          styles={{ input: { backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' } }}
        />
      </Group>

      {loading ? (
        <Group justify="center" p="xl"><Loader color="blue" /></Group>
      ) : users.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">No users found.</Text>
      ) : (
        <>
          <Table variant="vertical" highlightOnHover style={{ color: '#f8fafc' }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Company</Table.Th>
                <Table.Th>Role</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users.map((u) => (
                <Table.Tr key={u.id}>
                  <Table.Td>{u.firstName} {u.lastName}</Table.Td>
                  <Table.Td>{u.email}</Table.Td>
                  <Table.Td>{u.company || '-'}</Table.Td>
                  <Table.Td>
                    <Badge color={u.isAdmin ? 'red' : 'blue'}>{u.isAdmin ? 'Admin' : 'User'}</Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          
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