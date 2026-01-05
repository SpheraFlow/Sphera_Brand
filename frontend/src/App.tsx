import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ClientsHome from './pages/ClientsHome';
import ClientLayout from './layouts/ClientLayout';
import Dashboard from './pages/Dashboard';
import CalendarPage from './pages/CalendarPage';
import GeneralCalendarPage from './pages/GeneralCalendarPage';
import KnowledgeBase from './pages/KnowledgeBase';
import BrandProfile from './pages/BrandProfile';
import ReferencesPage from './pages/ReferencesPage';
import CampaignPlanning from './pages/CampaignPlanning';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ClientsHome />} />
        <Route path="/calendar" element={<GeneralCalendarPage />} />
        <Route path="/client/:clientId" element={<ClientLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="branding" element={<BrandProfile />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="campaign" element={<CampaignPlanning />} />
          <Route path="references" element={<ReferencesPage />} />
          <Route path="knowledge" element={<KnowledgeBase />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

