import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { useNavigate } from 'react-router-dom';

function AssignmentManagement() {
  const [crewMembers, setCrewMembers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedCrewMember, setSelectedCrewMember] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assignmentError, setAssignmentError] = useState(''); // Specific error for assignment actions
  const navigate = useNavigate();

  // Fetch initial data (crew, locations, assignments)
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }

      // Verify admin role (redundant if using AdminRoute, but good practice)
      const { data: userRoleData, error: roleError } = await supabase
        .from('crew_members')
        .select('role, organization_id')
        .eq('user_id', session.user.id)
        .single();

      if (roleError) throw roleError;
      if (userRoleData.role !== 'admin' && userRoleData.role !== 'supervisor') {
        navigate('/dashboard'); // Redirect non-admins
        return;
      }
      const orgId = userRoleData.organization_id;

      // Fetch Crew Members
      const { data: crewData, error: crewError } = await supabase
        .from('crew_members')
        .select('id, name, role')
        .eq('organization_id', orgId);
      if (crewError) throw crewError;
      setCrewMembers(crewData);

      // Fetch Locations
      const { data: locData, error: locError } = await supabase
        .from('locations')
        .select('id, name, address')
        .eq('organization_id', orgId);
      if (locError) throw locError;
      setLocations(locData);

      // Fetch Assignments
      const { data: assignData, error: assignError } = await supabase
        .from('crew_assignments')
        .select(`
          id,
          status,
          notes,
          crew_member_id,
          location_id,
          crew_members ( name ),
          locations ( name, address )
        `)
        .eq('organization_id', orgId); // Filter assignments by org
      if (assignError) throw assignError;
      setAssignments(assignData);

    } catch (err) {
      console.error("Error fetching assignment management data:", err);
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle adding a new assignment
  const handleAddAssignment = async (e) => {
    e.preventDefault();
    setAssignmentError('');
    if (!selectedCrewMember || !selectedLocation) {
      setAssignmentError('Please select both a crew member and a location.');
      return;
    }

    // Check if this exact assignment already exists (optional, depends on desired logic)
    const exists = assignments.some(a => a.crew_member_id === selectedCrewMember && a.location_id === selectedLocation && a.status === 'pending');
    if (exists) {
        setAssignmentError('This exact pending assignment already exists.');
        return;
    }


    try {
      setLoading(true); // Indicate loading state for the action
      const { data, error } = await supabase
        .from('crew_assignments')
        .insert({
          crew_member_id: selectedCrewMember,
          location_id: selectedLocation,
          // organization_id will be set by the trigger
          status: 'pending', // Default status
          notes: '', // Default notes
        })
        .select() // Select the newly inserted row
        .single(); // Expect a single row back

      if (error) throw error;

      // Re-fetch data to update the list (simple approach)
      // Alternatively, update state directly: setAssignments([...assignments, data]);
      fetchData();
      setSelectedCrewMember('');
      setSelectedLocation('');

    } catch (err) {
      console.error("Error adding assignment:", err);
      setAssignmentError(`Failed to add assignment: ${err.message}`);
    } finally {
       setLoading(false); // Reset loading state
    }
  };

  // Handle removing an assignment
  const handleRemoveAssignment = async (assignmentId) => {
     if (!window.confirm('Are you sure you want to remove this assignment?')) {
       return;
     }
     setAssignmentError('');
     try {
       setLoading(true);
       const { error } = await supabase
         .from('crew_assignments')
         .delete()
         .eq('id', assignmentId);

       if (error) throw error;

       // Re-fetch data or update state directly
       setAssignments(assignments.filter(a => a.id !== assignmentId));

     } catch (err) {
       console.error("Error removing assignment:", err);
       setAssignmentError(`Failed to remove assignment: ${err.message}`);
     } finally {
        setLoading(false);
     }
  };

  // --- Render Logic ---
  if (loading && assignments.length === 0) { // Show initial loading indicator
    return <div className="text-center mt-10 dark:text-gray-200">Loading Assignment Data...</div>;
  }

  if (error) {
    return <div className="container mx-auto px-4 py-8 text-red-600 dark:text-red-400">{error}</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold dark:text-white">Manage Crew Assignments</h1>
        <button onClick={() => navigate('/dashboard')} className="btn">
          Back to Dashboard
        </button>
      </div>

      {/* Add New Assignment Form */}
      <div className="card p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Assign Location to Crew</h2>
        <form onSubmit={handleAddAssignment} className="grid md:grid-cols-3 gap-4 items-end">
          <div>
            <label htmlFor="crewMember" className="block mb-1 text-sm font-medium">Crew Member</label>
            <select
              id="crewMember"
              value={selectedCrewMember}
              onChange={(e) => setSelectedCrewMember(e.target.value)}
              required
              className="input"
            >
              <option value="">Select Crew...</option>
              {crewMembers
                .filter(m => m.role !== 'admin') // Optionally filter out admins
                .map(member => (
                  <option key={member.id} value={member.id}>{member.name} ({member.role})</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="location" className="block mb-1 text-sm font-medium">Location</label>
            <select
              id="location"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              required
              className="input"
            >
              <option value="">Select Location...</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name} - {loc.address}</option>
              ))}
            </select>
          </div>
          <div className="pt-5"> {/* Align button vertically */}
            <button type="submit" className="btn w-full" disabled={loading}>
              {loading ? 'Assigning...' : 'Add Assignment'}
            </button>
          </div>
        </form>
        {assignmentError && <p className="text-red-500 text-sm mt-2">{assignmentError}</p>}
      </div>

      {/* Current Assignments List */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-4">Current Assignments</h2>
        {assignments.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No assignments found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="bg-gray-100 text-left dark:bg-gray-700">
                  <th className="p-3">Crew Member</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Notes</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assign) => (
                  <tr key={assign.id} className="border-b dark:border-gray-700">
                    <td className="p-3">{assign.crew_members?.name ?? 'N/A'}</td>
                    <td className="p-3">{assign.locations?.name ?? 'N/A'}</td>
                    <td className="p-3">{assign.status}</td>
                    <td className="p-3">{assign.notes || '-'}</td>
                    <td className="p-3">
                      <button
                        onClick={() => handleRemoveAssignment(assign.id)}
                        className="text-red-500 hover:text-red-700 disabled:opacity-50"
                        disabled={loading}
                        aria-label={`Remove assignment for ${assign.crew_members?.name} at ${assign.locations?.name}`}
                      >
                        Remove
                      </button>
                      {/* Add Edit button/functionality here if needed */}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default AssignmentManagement;
