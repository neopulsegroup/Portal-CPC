import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

// Pages
import Index from "./pages/Index";
import About from "./pages/About";
import HowItWorks from "./pages/HowItWorks";
import Contact from "./pages/Contact";
import Auth from "./pages/Auth";
import Triage from "./pages/Triage";
import MigrantDashboard from "./pages/dashboard/MigrantDashboard";
import CPCDashboard from "./pages/dashboard/CPCDashboard";
import CompanyDashboard from "./pages/dashboard/CompanyDashboard";
import NotFound from "./pages/NotFound";
import CreateTestUsersDev from "./pages/dev/CreateTestUsers";
import TrailsAdminPage from "./pages/dashboard/cpc/TrailsAdminPage";
import TrailEditorPage from "./pages/dashboard/cpc/TrailEditorPage";
import ConnectionTest from "./pages/ConnectionTest";

const queryClient = new QueryClient();

// Loading component
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <span className="ml-2">Carregando (App)...</span>
    </div>
  );
}

// Protected Route Component
function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { isAuthenticated, profile, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/entrar" replace />;
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Triage Guard
function TriageGuard({ children }: { children: React.ReactNode }) {
  const { profile, triage, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (profile?.role === 'migrant' && !triage?.completed) {
    return <Navigate to="/triagem" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Index />} />
      <Route path="/sobre" element={<About />} />
      <Route path="/como-funciona" element={<HowItWorks />} />
      <Route path="/contacto" element={<Contact />} />
      <Route path="/entrar" element={<Auth />} />
      <Route path="/registar" element={<Auth />} />
      <Route path="/ajuda" element={<NotFound />} />
      <Route path="/termos" element={<NotFound />} />
      <Route path="/privacidade" element={<NotFound />} />
      <Route path="/cookies" element={<NotFound />} />
      <Route path="/trails" element={<NotFound />} />
      <Route path="/precos" element={<NotFound />} />
      {import.meta.env.DEV && (
        <Route path="/dev/criar-usuarios" element={<CreateTestUsersDev />} />
      )}

      {/* Triage */}
      <Route
        path="/triagem"
        element={
          <ProtectedRoute allowedRoles={['migrant']}>
            <Triage />
          </ProtectedRoute>
        }
      />

      {/* Migrant Dashboard */}
      <Route
        path="/dashboard/migrante/*"
        element={
          <ProtectedRoute allowedRoles={['migrant']}>
            <TriageGuard>
              <MigrantDashboard />
            </TriageGuard>
          </ProtectedRoute>
        }
      />

      {/* CPC Dashboard */}
      <Route
        path="/dashboard/cpc/*"
        element={
          <ProtectedRoute allowedRoles={['mediator', 'lawyer', 'psychologist', 'manager', 'coordinator', 'admin']}>
            <CPCDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/cpc/trilhas"
        element={
          <ProtectedRoute allowedRoles={['mediator', 'lawyer', 'psychologist', 'manager', 'coordinator', 'admin']}>
            <TrailsAdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/cpc/trilhas/:trailId"
        element={
          <ProtectedRoute allowedRoles={['mediator', 'lawyer', 'psychologist', 'manager', 'coordinator', 'admin']}>
            <TrailEditorPage />
          </ProtectedRoute>
        }
      />

      {/* Company Dashboard */}
      <Route
        path="/dashboard/empresa/*"
        element={
          <ProtectedRoute allowedRoles={['company']}>
            <CompanyDashboard />
          </ProtectedRoute>
        }
      />

      {/* Diagnostics */}
      <Route path="/test-connection" element={<ConnectionTest />} />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
