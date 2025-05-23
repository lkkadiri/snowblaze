import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useNavigate } from 'react-router-dom';

function Dashboard() {
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [crewMembers, setCrewMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Get current user session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          navigate('/login');
          return;
        }

        setUser(session.user);

        // Fetch organization details
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', session.user.user_metadata.organization_id)
          .single();

        if (orgError) throw orgError;

        setOrganization(orgData);

        // Fetch crew members
        const { data: crewData, error: crewError } = await supabase
          .from('crew_members')
          .select('*')
          .eq('organization_id', orgData.id);

        if (crewError) throw crewError;

        setCrewMembers(crewData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mb-4 mx-auto"></div>
          <p className="text-gray-700">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center bg-red-100 p-6 rounded-lg">
          <h2 className="text-2xl text-red-600 mb-4">Error Loading Dashboard</h2>
          <p className="text-red-500">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">
          Welcome to {organization.name}
        </h1>
        <button 
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
        >
          Logout
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4">Your Profile</h2>
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Role:</strong> {user.user_metadata?.role || 'Member'}</p>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4">Organization Details</h2>
          <p><strong>Name:</strong> {organization.name}</p>
          <p><strong>Crew Members:</strong> {crewMembers.length}</p>
        </div>
      </div>

      <div className="mt-8 card p-6">
        <h2 className="text-xl font-semibold mb-4">Crew Members</h2>
        {crewMembers.length === 0 ? (
          <p className="text-gray-500">No crew members added yet.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100 text-left dark:bg-gray-700 dark:text-gray-200">
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
              </tr>
            </thead>
            <tbody>
              {crewMembers.map((member) => (
                <tr key={member.id} className="border-b">
                  <td className="p-3">{member.name}</td>
                  <td className="p-3">{member.email}</td>
                  <td className="p-3">{member.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Conditional Navigation Buttons */}
      <div className="mt-6 flex space-x-4">
        {user.user_metadata?.role === 'admin' ? (
          <> {/* Fragment for admin buttons */}
            <button 
              onClick={() => navigate('/organization')}
              className="btn hidden md:inline-block"
            >
              Manage Organization
            </button>
            <button 
              onClick={() => navigate('/crew-tracking')}
              className="btn hidden md:inline-block"
            >
              Crew Tracking
            </button>
            <button 
              onClick={() => navigate('/locations')}
              className="btn hidden md:inline-block"
            >
              Manage Locations
            </button>
            <button
              onClick={() => navigate('/manage-assignments')} // Add button for managing assignments
              className="btn hidden md:inline-block"
            >
              Manage Assignments
            </button>
          </>
        ) : (
          <> {/* Fragment for non-admin buttons */}
            <button 
              onClick={() => navigate('/my-assignments')}
              className="btn"
            >
              My Assignments
            </button>
            {/* Add other relevant buttons for crew members if needed */}
          </>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
