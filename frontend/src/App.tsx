import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './components/ui/Toaster';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Shows } from './pages/Shows';
import { ShowDetail } from './pages/ShowDetail';
import { EpisodeDetail } from './pages/EpisodeDetail';
import './App.css';

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <Router>
            <ProtectedRoute>
              <div className="min-h-screen bg-plex-gray-900 text-plex-gray-100">
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/shows" element={<Shows />} />
                    <Route path="/shows/:showId" element={<ShowDetail />} />
                    <Route path="/episodes/:episodeId" element={<EpisodeDetail />} />
                  </Routes>
                </Layout>
              </div>
            </ProtectedRoute>
          </Router>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;