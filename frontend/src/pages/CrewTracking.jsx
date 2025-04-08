import React, { useState, useEffect } from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import { supabase } from '../services/supabaseClient';
import { useNavigate } from 'react-router-dom';

const mapContainerStyle = {
  width: '100%',
  height: '600px'
};

const defaultCenter = {
  lat: 39.7392, // Denver coordinates as default
  lng: -104.9903
};

function CrewTracking() {
  const [organization, setOrganization] = useState(null);
  const [crewMembers, setCrewMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [error, setError] = useState('');
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

        // Set up real-time subscription for crew locations
        const channel = supabase
          .channel('crew_locations')
          .on(
            'postgres_changes',
            { 
              event: '*', 
              schema: 'public', 
              table: 'crew_locations' 
            },
            (payload) => {
              // Update crew member location in real-time
              setCrewMembers(currentMembers => 
                currentMembers.map(member => 
                  member.id === payload.new.crew_member_id 
                    ? {...member, location: payload.new} 
                    : member
                )
              );
            }
          )
          .subscribe();

        // Fetch crew members with their latest locations
        const { data: crewData, error: crewError } = await supabase
          .from('crew_members')
          .select(`
            *,
            crew_locations(
              latitude,
              longitude,
              timestamp
            )
          `)
          .eq('organization_id', orgData.id);

        if (crewError) throw crewError;

        // Transform crew data to include latest location
        const enrichedCrewData = crewData.map(member => ({
          ...member,
          location: member.crew_locations.length > 0 
            ? member.crew_locations[0] 
            : null
        }));

        setCrewMembers(enrichedCrewData);

        // Cleanup subscription on unmount
        return () => {
          supabase.removeChannel(channel);
        };
      } catch (error) {
        setError(error.message);
        console.error('Error fetching crew data:', error);
      }
    };

    fetchOrgData();
  }, [navigate]);

  const handleMemberSelect = (member) => {
    setSelectedMember(member);
  };

  if (!organization) {
    return <div className="text-center mt-10">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">
          {organization.name} - Crew Tracking
        </h1>
        <button 
          onClick={() => navigate('/dashboard')}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition"
        >
          Back to Dashboard
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white shadow rounded-lg p-6">
          <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={
                selectedMember?.location 
                  ? { 
                      lat: selectedMember.location.latitude, 
                      lng: selectedMember.location.longitude 
                    }
                  : defaultCenter
              }
              zoom={selectedMember?.location ? 15 : 10}
            >
              {crewMembers.map((member) => (
                member.location && (
                  <Marker
                    key={member.id}
                    position={{
                      lat: member.location.latitude,
                      lng: member.location.longitude
                    }}
                    title={member.name}
                    onClick={() => handleMemberSelect(member)}
                    icon={{
                      url: selectedMember?.id === member.id 
                        ? '/selected-marker.png' 
                        : '/default-marker.png'
                    }}
                  />
                )
              ))}
            </GoogleMap>
          </LoadScript>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Crew Members</h2>
          {crewMembers.length === 0 ? (
            <p className="text-gray-500">No crew members with active locations.</p>
          ) : (
            <ul className="space-y-2">
              {crewMembers.map((member) => (
                <li 
                  key={member.id}
                  className={`p-3 rounded cursor-pointer ${
                    selectedMember?.id === member.id 
                      ? 'bg-blue-100' 
                      : 'hover:bg-gray-100'
                  }`}
                  onClick={() => handleMemberSelect(member)}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{member.name}</span>
                    <span className="text-sm text-gray-500">
                      {member.role}
                    </span>
                  </div>
                  {member.location && (
                    <div className="text-sm text-gray-600 mt-1">
                      Last seen: {new Date(member.location.timestamp).toLocaleString()}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {selectedMember && (
        <div className="mt-6 bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">
            {selectedMember.name} - Details
          </h3>
          {selectedMember.location ? (
            <div>
              <p><strong>Latitude:</strong> {selectedMember.location.latitude}</p>
              <p><strong>Longitude:</strong> {selectedMember.location.longitude}</p>
              <p>
                <strong>Last Updated:</strong> {' '}
                {new Date(selectedMember.location.timestamp).toLocaleString()}
              </p>
            </div>
          ) : (
            <p className="text-gray-500">No location data available</p>
          )}
        </div>
      )}
    </div>
  );
}

export default CrewTracking;
