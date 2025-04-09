import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from './services/supabaseClient';
import { ThemeProvider } from './contexts/ThemeContext';
import ThemeToggle from './components/ThemeToggle';

// Import pages
import Login from './pages/Login';
import Signup from './pages/Signup';
import SetPassword from './pages/SetPassword';
import Dashboard from './pages/Dashboard';
import CrewTracking from './pages/CrewTracking';
import OrganizationManagement from './pages/OrganizationManagement';
import LocationManagement from './pages/LocationManagement';
import MyAssignments from './pages/MyAssignments'; // Import the new component

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };

    checkUser();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    // Cleanup subscription
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Protected Route Component
  const ProtectedRoute = ({ children }) => {
    if (loading) {
      return <div>Loading...</div>;
    }
    
    return user ? children : <Navigate to="/login" replace />;
  };

  // Admin Protected Route
  const AdminRoute = ({ children }) => {
    if (loading) {
      return <div>Loading...</div>;
    }
    
    // Assuming admin has a specific role or claim
    return (user && user.user_metadata?.role === 'admin') 
      ? children 
      : <Navigate to="/dashboard" replace />;
  };

  return (
    <ThemeProvider>
      <Router>
        <div className="min-h-screen bg-primary-light dark:bg-primary-dark">
          <div className="fixed top-4 right-4 z-50">
            <ThemeToggle />
          </div>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/set-password" element={<SetPassword />} />
            
            {/* Protected Routes */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            
            {/* Admin Routes */}
            <Route 
              path="/crew-tracking" 
              element={
                <AdminRoute>
                  <CrewTracking />
                </AdminRoute>
              } 
            />
            <Route 
              path="/organization" 
              element={
                <AdminRoute>
                  <OrganizationManagement />
                </AdminRoute>
              } 
            />
            <Route 
              path="/locations" 
              element={
                <AdminRoute>
                  <LocationManagement />
                </AdminRoute>
              } 
            />
             {/* Route for Crew Member Assignments */}
             <Route 
              path="/my-assignments" 
              element={
                <ProtectedRoute> 
                  <MyAssignments />
                </ProtectedRoute>
              } 
            />

            {/* Default Redirect */}
            <Route 
              path="/" 
              element={
                <Navigate 
                  to={user ? "/dashboard" : "/login"} 
                  replace 
                />
              } 
            />
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
