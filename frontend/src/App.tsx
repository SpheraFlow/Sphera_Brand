import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ClientsHome from './pages/ClientsHome';
import ClientLayout from './layouts/ClientLayout';
import Dashboard from './pages/Dashboard';
import CalendarPage from './pages/CalendarPage';
import KnowledgeBase from './pages/KnowledgeBase';
import BrandProfile from './pages/BrandProfile';
import ReferencesPage from './pages/ReferencesPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ClientsHome />} />
        <Route path="/client/:clientId" element={<ClientLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="branding" element={<BrandProfile />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="references" element={<ReferencesPage />} />
          <Route path="knowledge" element={<KnowledgeBase />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

