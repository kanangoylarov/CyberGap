import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import OverviewPage from './pages/OverviewPage';
import AttacksPage from './pages/AttacksPage';
import FingerprintsPage from './pages/FingerprintsPage';
import LogsPage from './pages/LogsPage';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/attacks" element={<AttacksPage />} />
          <Route path="/fingerprints" element={<FingerprintsPage />} />
          <Route path="/logs" element={<LogsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
