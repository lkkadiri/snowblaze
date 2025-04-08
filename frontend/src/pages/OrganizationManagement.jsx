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

    try {
      // Create the user in Supabase Auth with regular signup
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: newMember.email,
        password: `Snowblaze2025!${Math.random().toString(36).slice(2)}`, // Temporary secure password
        options: {
          data: {
            role: newMember.role,
            organization_id: organization.id,
            name: newMember.name
          },
          emailRedirectTo: `${window.location.origin}/set-password`
        }
      });
      
      if (signupError) throw signupError;

      // Then, add to crew_members table
      const { data: crewData, error: crewError } = await supabase
        .from('crew_members')
        .insert({
          name: newMember.name,
          email: newMember.email,
          role: newMember.role,
          organization_id: organization.id,
          user_id: signupData.user.id
        })
        .select()
        .single();

      if (crewError) throw crewError;

      // Update local state
      setCrewMembers([...crewMembers, crewData]);

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
    setLoading(true);
    try {
      // Remove from crew_members table
      const { error: crewError } = await supabase
        .from('crew_members')
        .delete()
        .eq('id', memberId);

      if (crewError) throw crewError;

      // Note: We can't directly disable users from the client side
      // This would typically be handled by a backend function or admin API
      // For now, we'll just remove the crew_member record

      // Update local state
      setCrewMembers(crewMembers.filter(m => m.id !== memberId));
      setLoading(false);
    } catch (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mb-4 mx-auto"></div>
          <p className="text-gray-700">Loading organization data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center bg-red-100 p-6 rounded-lg">
          <h2 className="text-2xl text-red-600 mb-4">Error Loading Organization</h2>
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
          {organization.name} - Organization Management
        </h1>
        <button 
          onClick={() => navigate('/dashboard')}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition"
        >
          Back to Dashboard
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Add Crew Member</h2>
          <form onSubmit={handleAddCrewMember} className="space-y-4">
            <div>
              <label htmlFor="name" className="block mb-2">Name</label>
              <input
                type="text"
                id="name"
                value={newMember.name}
                onChange={(e) => setNewMember({...newMember, name: e.target.value})}
                required
                className="w-full px-3 py-2 border rounded"
                placeholder="Full Name"
              />
            </div>
            <div>
              <label htmlFor="email" className="block mb-2">Email</label>
              <input
                type="email"
                id="email"
                value={newMember.email}
                onChange={(e) => setNewMember({...newMember, email: e.target.value})}
                required
                className="w-full px-3 py-2 border rounded"
                placeholder="Email Address"
              />
            </div>
            <div>
              <label htmlFor="role" className="block mb-2">Role</label>
              <select
                id="role"
                value={newMember.role}
                onChange={(e) => setNewMember({...newMember, role: e.target.value})}
                className="w-full px-3 py-2 border rounded"
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
              className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 transition"
            >
              {loading ? 'Adding Member...' : 'Add Crew Member'}
            </button>
          </form>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Current Crew Members</h2>
          {crewMembers.length === 0 ? (
            <p className="text-gray-500">No crew members added yet.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {crewMembers.map((member) => (
                  <tr key={member.id} className="border-b">
                    <td className="p-3">{member.name}</td>
                    <td className="p-3">{member.email}</td>
                    <td className="p-3">{member.role}</td>
                    <td className="p-3">
                      <button 
                        onClick={() => handleRemoveCrewMember(member.id)}
                        className="text-red-500 hover:text-red-700"
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
