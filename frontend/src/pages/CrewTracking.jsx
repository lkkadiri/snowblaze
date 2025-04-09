// This component is now intended ONLY for Admin/Supervisor roles
import React, { useState, useEffect, useRef, useCallback } from 'react';
// Import useJsApiLoader instead of LoadScript
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { supabase } from '../services/supabaseClient';
import { useNavigate } from 'react-router-dom';

// Simple hash function to generate a color from a string (e.g., user ID)
function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF;
    // Ensure brightness/saturation by avoiding very dark/light colors if needed
    // For simplicity, just generate the hex code directly here
    color += ('00' + value.toString(16)).substr(-2);
  }
  // Basic check to avoid pure white/black if hash is 0 or similar
  if (color === '#000000') return '#808080'; // Default to gray
  if (color === '#ffffff') return '#808080';
  return color;
}


const mapContainerStyle = {
  width: '100%',
  height: '600px'
};

const defaultCenter = {
  lat: 39.7392, // Denver coordinates as default
  lng: -104.9903
};

// Time threshold for considering a user "active" (in milliseconds)
const ACTIVE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

function CrewTracking() {
  const [organization, setOrganization] = useState(null);
  const [crewMembers, setCrewMembers] = useState([]); // Holds all crew members for display
  const [currentUser, setCurrentUser] = useState(null); // To verify role
  const [selectedMember, setSelectedMember] = useState(null); // Only selecting members now
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const mapRef = useRef(null);

  // Use the hook to load the Google Maps script
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "", // Ensure API key is provided
    // libraries: ['places'], // Add other libraries if needed
  });

  const fetchAdminData = useCallback(async () => {
    // Keep setLoading for fetching Supabase data, map loading is handled by isLoaded
    setLoading(true);
    setError('');
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        navigate('/login');
        return;
      }

      // Fetch current user's role to ensure they are admin/supervisor
      const { data: userRoleData, error: userRoleError } = await supabase
        .from('crew_members')
        .select('id, role, organization_id')
        .eq('user_id', session.user.id)
        .single();

      if (userRoleError) {
        console.error("Error fetching current user role:", userRoleError);
        throw userRoleError;
      }

      // Redirect if not admin/supervisor
      if (userRoleData.role !== 'admin' && userRoleData.role !== 'supervisor') {
        console.warn("Access denied: User is not an admin or supervisor.");
        navigate('/dashboard'); // Or to a dedicated 'access denied' page
        return;
      }
      setCurrentUser(userRoleData); // Store minimal user data needed

      // Fetch organization details
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', userRoleData.organization_id) // Use org ID from user data
        .single();

      if (orgError) throw orgError;
      setOrganization(orgData);

      // Fetch all crew members with latest locations and activity for the organization
      const { data: crewData, error: crewError } = await supabase
        .from('crew_members')
          .select(`
            id, name, role, last_active_at,
            crew_locations (
              latitude,
              longitude,
              timestamp
            )
          `)
          .eq('organization_id', orgData.id)
          .order('timestamp', { foreignTable: 'crew_locations', ascending: false })
          .limit(1, { foreignTable: 'crew_locations' }); // Get only the latest location per member

        if (crewError) throw crewError;

        // Calculate enrichedCrewData only once
        const enrichedCrewData = crewData.map(member => ({
          ...member,
          location: member.crew_locations.length > 0 ? member.crew_locations[0] : null
      }));
      console.log("Fetched Crew Members for Admin View:", enrichedCrewData); // Log fetched data
      setCrewMembers(enrichedCrewData);

    } catch (err) {
      setError(`Failed to load crew tracking data: ${err.message}`);
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [navigate]); // Removed dependencies related to crew view

  // Setup Realtime Subscriptions (only for admin view now)
  useEffect(() => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'supervisor')) {
      return; // Don't subscribe if not admin/supervisor or currentUser isn't loaded
    }

    console.log("Setting up admin realtime subscriptions...");

    const channels = [];

    // Subscribe to crew_locations changes
    const locationChannel = supabase
      .channel('crew_locations_admin_realtime') // Use a distinct channel name if needed
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crew_locations' }, // Consider filtering by org if needed and possible
        (payload) => {
          console.log("Realtime crew_locations update received:", payload);
          setCrewMembers(currentMembers =>
            currentMembers.map(member =>
              member.id === payload.new.crew_member_id
                ? { ...member, location: payload.new } // Update location
                : member
            )
          );
        }
      )
      .subscribe();
    channels.push(locationChannel);

    // Subscribe to crew_members changes (for last_active_at, relevant for Admin)
    const memberChannel = supabase
      .channel('crew_members_admin_realtime') // Use a distinct channel name
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crew_members', filter: `organization_id=eq.${currentUser.organization_id}` },
        (payload) => {
          console.log("Realtime crew_members update received:", payload);
          setCrewMembers(currentMembers =>
            currentMembers.map(member =>
              member.id === payload.new.id
                ? { ...member, ...payload.new } // Update member data, including last_active_at
                : member
            )
          );
        }
      )
      .subscribe();
    channels.push(memberChannel);

    // Cleanup subscriptions
    return () => {
      console.log("Cleaning up admin realtime subscriptions...");
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [currentUser]); // Rerun only when currentUser (and thus role/orgId) is confirmed

  // Initial data fetch
  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  const handleMemberSelect = (member) => { // Renamed handler
    setSelectedMember(member);
    if (member?.location?.latitude && member?.location?.longitude && mapRef.current) {
      mapRef.current.panTo({ lat: member.location.latitude, lng: member.location.longitude });
      mapRef.current.setZoom(15);
    }
  };

  const onMapLoad = useCallback((map) => { // Keep onMapLoad
    mapRef.current = map;
  }, []);

  const isCrewActive = (member) => {
    if (!member.last_active_at) return false;
    const lastActiveTime = new Date(member.last_active_at).getTime();
    const now = Date.now();
    return (now - lastActiveTime) < ACTIVE_THRESHOLD;
  };

  // --- Render Logic ---
  if (loading) {
    return <div className="text-center mt-10 dark:text-gray-200">Loading Crew Data...</div>;
  }

  if (error) {
    return <div className="container mx-auto px-4 py-8 text-red-600 dark:text-red-400">{error}</div>;
  }

  if (!currentUser || !organization) {
     return <div className="text-center mt-10 dark:text-gray-200">Initializing...</div>; // Should be brief
  }

  // Log the state from the loader hook before rendering
  console.log("CrewTracking Render - isLoaded:", isLoaded, "loadError:", loadError);

  // No longer need isAdminView check here, this page IS the admin view
  return (
    <div className="container mx-auto px-4 py-8 text-gray-900 dark:text-gray-200">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold dark:text-white">
          {organization.name} - Crew Tracking {/* Simplified title */}
        </h1>
        <button
          onClick={() => navigate('/dashboard')} // Keep navigation
          className="btn" // Use consistent button class
        >
          Back to Dashboard
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Map Area */}
        <div className="md:col-span-2 card p-6"> {/* Use card class */}
          {/* Conditional rendering based on the hook's state */}
          {loadError && <div className="text-red-500 dark:text-red-400">Error loading Google Maps: {loadError.message}</div>}
          {!isLoaded && !loadError && <div className="text-center dark:text-gray-200">Loading Map...</div>}
          {isLoaded && (
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={ // Center on selected member or default
                selectedMember?.location
                  ? { lat: selectedMember.location.latitude, lng: selectedMember.location.longitude }
                  : defaultCenter
              }
              zoom={selectedMember?.location ? 15 : 10} // Zoom in if member selected
              onLoad={onMapLoad}
            >
              {/* Always show crew members now */}
              {crewMembers.map((member) => (
                member.location && (
                  <Marker
                    key={member.id} // Use member ID as key
                    position={{ // Use member's location
                      lat: member.location.latitude,
                      lng: member.location.longitude
                    }}
                    title={`${member.name} (${member.role}) - Last Seen: ${new Date(member.location.timestamp).toLocaleString()}`} // Show member info in title
                    onClick={() => handleMemberSelect(member)} // Use correct handler
                    // Re-enable custom icon logic now that isLoaded works
                    icon={
                      isCrewActive(member) // isLoaded is checked before rendering GoogleMap
                        ? { // Use generated color for active members
                            path: window.google.maps.SymbolPath.CIRCLE,
                            scale: 8,
                            fillColor: stringToColor(member.id), // Generate color from ID
                            fillOpacity: 1,
                            strokeWeight: 1,
                            strokeColor: '#000000' // Keep black outline for contrast
                          }
                        : undefined // Use default marker if inactive or selected
                    }
                     // Re-enable options for blinking effect (optional)
                     options={{
                       label: {
                         text: ' ',
                         className: isCrewActive(member) ? 'blinking-dot' : '',
                       }
                     }}
                  />
                )
              ))}

              </GoogleMap>
          )}
        </div>

        {/* Sidebar List - Always show Crew Members now */}
        <div className="card p-6 max-h-[600px] overflow-y-auto">
          <h2 className="text-xl font-semibold mb-4 dark:text-white">
            Crew Members
          </h2>
          {crewMembers.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No crew members found.</p>
          ) : (
            <ul className="space-y-2">
              {crewMembers.map((member) => (
                <li
                  key={member.id}
                  className={`p-3 rounded cursor-pointer ${
                    selectedMember?.id === member.id // Check selectedMember
                      ? 'bg-blue-100 dark:bg-blue-800'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  } ${isCrewActive(member) ? 'border-l-4 border-green-500' : ''}`} // Visual cue for active
                  onClick={() => handleMemberSelect(member)} // Use correct handler
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{member.name}</span>
                    <span className={`text-sm px-2 py-0.5 rounded ${isCrewActive(member) ? 'bg-green-200 text-green-800 dark:bg-green-700 dark:text-green-100' : 'text-gray-500 dark:text-gray-400'}`}>
                      {isCrewActive(member) ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{member.role}</div>
                  {member.location && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Last seen: {new Date(member.location.timestamp).toLocaleString()}
                    </div>
                  )}
                  {!member.location && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">No location data</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Details Panel - Show selected member details */}
      {selectedMember && (
        <div className="mt-6 card p-6">
          <h3 className="text-lg font-semibold mb-4 dark:text-white">
            {selectedMember.name} - Details
          </h3>
          {selectedMember.location ? (
            <div>
              <p><strong>Role:</strong> {selectedMember.role}</p>
              <p><strong>Latitude:</strong> {selectedMember.location.latitude}</p>
              <p><strong>Longitude:</strong> {selectedMember.location.longitude}</p>
              <p><strong>Last Location Update:</strong> {new Date(selectedMember.location.timestamp).toLocaleString()}</p>
              <p><strong>Last Active:</strong> {selectedMember.last_active_at ? new Date(selectedMember.last_active_at).toLocaleString() : 'Never'}</p>
              <p><strong>Status:</strong> <span className={isCrewActive(selectedMember) ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}>{isCrewActive(selectedMember) ? 'Active' : 'Inactive'}</span></p>
            </div>
          ) : (
             <p className="text-gray-500 dark:text-gray-400">No location data available for {selectedMember.name}.</p>
           )}
        </div>
      )}
    </div>
  );
}

export default CrewTracking; // Ensure export is present
