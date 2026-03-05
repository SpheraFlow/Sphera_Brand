import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { PrivateRoute, PermissionRoute } from './components/PrivateRoute';
import LoginPage from './pages/LoginPage';
import TeamManagement from './pages/TeamManagement';
import ClientsHome from './pages/ClientsHome';
import ClientLayout from './layouts/ClientLayout';
import Dashboard from './pages/Dashboard';
import CalendarPage from './pages/CalendarPage';
import GeneralCalendarPage from './pages/GeneralCalendarPage';
import KnowledgeBase from './pages/KnowledgeBase';
import BrandProfile from './pages/BrandProfile';
import ReferencesPage from './pages/ReferencesPage';

// New Pages
import AgencyHome from './pages/AgencyHome';
import PromptTemplatePage from './pages/PromptTemplatePage';
import PromptOnboardingPage from './pages/PromptOnboardingPage';
import PromptTemplateEditorPage from './pages/PromptTemplateEditorPage';
import BrandingOnboardingPage from './pages/BrandingOnboardingPage';
import ClientHub from './pages/ClientHub';
import CampaignsList from './pages/CampaignsList';
import CampaignWizard from './pages/CampaignWizard';
import CampaignReview from './pages/CampaignReview';
import JobsPage from './pages/JobsPage';
import DeliveriesPage from './pages/DeliveriesPage';
import ProdutosPage from './pages/ProdutosPage';
import RootLayout from './layouts/RootLayout';
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<PrivateRoute />}>
            <Route element={<RootLayout />}>
              {/* 1) Global Routes */}
              <Route path="/" element={<AgencyHome />} />
              <Route path="/clients" element={<ClientsHome />} />
              <Route path="/calendar" element={<GeneralCalendarPage />} />

              {/* Admin Only Routes */}
              <Route element={<PermissionRoute requiredPermission="team_manage" />}>
                <Route path="/team" element={<TeamManagement />} />
              </Route>

              {/* 2) Client Context */}
              <Route path="/client/:clientId" element={<ClientLayout />}>
                {/* Default to Hub */}
                <Route index element={<ClientHub />} />

                {/* Existing Routes (Preserved) */}
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="branding" element={<BrandProfile />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="references" element={<ReferencesPage />} />
                <Route path="knowledge" element={<KnowledgeBase />} />

                {/* New Routes */}
                <Route path="produtos" element={<ProdutosPage />} />
                <Route path="campaigns" element={<CampaignsList />} />
                <Route path="campaigns/new" element={<CampaignWizard />} />
                <Route path="campaigns/:campaignId/review" element={<CampaignReview />} />
                <Route path="jobs" element={<JobsPage />} />
                <Route path="deliveries" element={<DeliveriesPage />} />
                <Route path="prompt-template" element={<PromptTemplatePage />} />
                <Route path="prompt-template/editor/:agentId" element={<PromptTemplateEditorPage />} />
                <Route path="prompt-onboarding" element={<PromptOnboardingPage />} />
                <Route path="onboarding" element={<BrandingOnboardingPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
