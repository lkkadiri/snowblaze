import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useNavigate } from 'react-router-dom';

function OrganizationManagement() {
  const [organization, setOrganization] = useState(null);
  const [crewMembers, setCrewMembers] = useState([]);
  const [newMember, setNewMember] = useState({
    name: '',
    email: '',
    role: 'crew'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOrgData = async () => {
      try {
        // Get current user session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          navigate('/login');
          return;
        }

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

    fetchOrgData();
  }, [navigate]);

  const handleAddCrewMember = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setError(''); // Clear previous errors

    try {
      // Get the current session token for authorization
      const sessionData = await supabase.auth.getSession();
      const token = sessionData?.data?.session?.access_token;

      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }

      // Call the backend endpoint to add the crew member
      const response = await fetch('/api/crew-members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newMember.name,
          email: newMember.email,
          role: newMember.role
        })
      });

      // Check response status
      if (!response.ok) {
        let errorPayload;
        try {
          errorPayload = await response.json();
        } catch (e) {
          errorPayload = { error: `HTTP error ${response.status}: ${response.statusText}` };
        }
        throw new Error(errorPayload.error || `Failed to add crew member (Status: ${response.status})`);
      }

      // Parse the success response (contains the newly created crew member record)
      const addedCrewMember = await response.json();
      console.log('Crew member added successfully via backend:', addedCrewMember);

      // Update local state with the data returned from the backend
      setCrewMembers(currentMembers => [...currentMembers, addedCrewMember]);

      // Reset form
      setNewMember({
        name: '',
        email: '',
        role: 'crew'
      });
      setLoading(false);
    } catch (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  const handleRemoveCrewMember = async (memberId) => {
    // Optional: Add a confirmation dialog here
    // if (!confirm(`Are you sure you want to remove this crew member?`)) {
    //   return;
    // }

    setLoading(true);
    setError(''); // Clear previous errors

    try {
      // Get the current session token for authorization
      const sessionData = await supabase.auth.getSession();
      const token = sessionData?.data?.session?.access_token;

      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }

      // Call the new backend endpoint
      const response = await fetch(`/api/crew-members/${memberId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
          // No Content-Type needed for DELETE with no body
        }
      });

      // Check response status
      if (!response.ok) {
        let errorPayload;
        try {
          errorPayload = await response.json();
        } catch (e) {
          // If response is not JSON
          errorPayload = { error: `HTTP error ${response.status}: ${response.statusText}` };
        }
        throw new Error(errorPayload.error || `Failed to remove crew member (Status: ${response.status})`);
      }

      // Parse the success response (might contain warnings)
      const data = await response.json();
      console.log(data.message); // Log success message
      if (data.warning) {
        console.warn('Backend Warning:', data.warning);
        // Optionally display the warning to the user, e.g., using setError
        setError(`Warning: ${data.warning}`); 
      }

      // Update local state on successful removal from backend
      setCrewMembers(currentMembers => currentMembers.filter(m => m.id !== memberId));

    } catch (error) {
      console.error('Error removing crew member:', error);
      setError(error.message); // Display the error to the user
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mb-4 mx-auto"></div>
          <p className="text-gray-700 dark:text-gray-300">Loading organization data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center bg-red-100 dark:bg-red-900 p-6 rounded-lg">
          <h2 className="text-2xl text-red-600 dark:text-red-200 mb-4">Error Loading Organization</h2>
          <p className="text-red-500 dark:text-red-300">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 text-gray-900 dark:text-gray-200">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold dark:text-white">
          {organization.name} - Organization Management
        </h1>
        <button 
          onClick={() => navigate('/dashboard')}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700 transition"
        >
          Back to Dashboard
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 dark:text-white">Add Crew Member</h2>
          <form onSubmit={handleAddCrewMember} className="space-y-4">
            <div>
              <label htmlFor="name" className="block mb-2 dark:text-gray-300">Name</label>
              <input
                type="text"
                id="name"
                value={newMember.name}
                onChange={(e) => setNewMember({...newMember, name: e.target.value})}
                required
                className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400"
                placeholder="Full Name"
              />
            </div>
            <div>
              <label htmlFor="email" className="block mb-2 dark:text-gray-300">Email</label>
              <input
                type="email"
                id="email"
                value={newMember.email}
                onChange={(e) => setNewMember({...newMember, email: e.target.value})}
                required
                className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400"
                placeholder="Email Address"
              />
            </div>
            <div>
              <label htmlFor="role" className="block mb-2 dark:text-gray-300">Role</label>
              <select
                id="role"
                value={newMember.role}
                onChange={(e) => setNewMember({...newMember, role: e.target.value})}
                className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
              >
                <option value="crew">Crew Member</option>
                <option value="driver">Driver</option>
                <option value="supervisor">Supervisor</option>
              </select>
            </div>

            {error && (
              <div className="text-red-500 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 transition"
            >
              {loading ? 'Adding Member...' : 'Add Crew Member'}
            </button>
          </form>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 dark:text-white">Current Crew Members</h2>
          {crewMembers.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No crew members added yet.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700 text-left dark:text-gray-200">
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {crewMembers.map((member) => (
                  <tr key={member.id} className="border-b dark:border-gray-700">
                    <td className="p-3">{member.name}</td>
                    <td className="p-3">{member.email}</td>
                    <td className="p-3">{member.role}</td>
                    <td className="p-3">
                      <button 
                        onClick={() => handleRemoveCrewMember(member.id)}
                        className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default OrganizationManagement;
