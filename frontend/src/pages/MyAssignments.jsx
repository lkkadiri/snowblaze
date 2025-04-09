import React, { useState, useEffect, useRef, useCallback } from 'react';
// Import useJsApiLoader, DirectionsService, DirectionsRenderer
import { GoogleMap, useJsApiLoader, Marker, DirectionsService, DirectionsRenderer } from '@react-google-maps/api';
import { supabase } from '../services/supabaseClient';
import { useNavigate } from 'react-router-dom';

// Haversine formula for distance calculation
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

const mapContainerStyle = {
  width: '100%',
  height: '600px'
};

const defaultCenter = {
  lat: 39.7392, // Denver coordinates as default
  lng: -104.9903
};

function MyAssignments() {
  const [assignedLocations, setAssignedLocations] = useState([]);
  const [currentUser, setCurrentUser] = useState(null); // Only need ID for fetching/updates
  const [currentUserLocation, setCurrentUserLocation] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null); // For selecting a location
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [geolocationStatus, setGeolocationStatus] = useState('idle'); // 'idle', 'pending', 'success', 'error'
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const locationWatchId = useRef(null);
  const [directionsResponse, setDirectionsResponse] = useState(null); // State for directions
  const [routeCalculated, setRouteCalculated] = useState(false); // Flag to prevent recalculation

  // Use the hook to load the Google Maps script
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    // No need to specify 'directions' library here; components handle it.
  });

  // Fetches assigned locations and starts geolocation watch
  const fetchAssignmentData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        navigate('/login');
        return;
      }

      // Fetch current user's crew member ID
      const { data: userData, error: userError } = await supabase
        .from('crew_members')
        .select('id, role') // Get role to ensure they are not admin/supervisor
        .eq('user_id', session.user.id)
        .single();

      if (userError) {
        console.error("Error fetching user data:", userError);
        throw userError;
      }

      // Redirect if admin/supervisor tries to access this page
      if (userData.role === 'admin' || userData.role === 'supervisor') {
         console.warn("Redirecting admin/supervisor from My Assignments page.");
         navigate('/dashboard'); // Or to crew tracking
         return;
      }
      setCurrentUser(userData); // Store user ID

      // Fetch assigned locations for the current user
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('crew_assignments')
        .select(`
          id, status, notes,
          locations (
            id, name, address, latitude, longitude, status
          )
        `)
        .eq('crew_member_id', userData.id)
        .neq('status', 'completed')
        .neq('status', 'cancelled');

      if (assignmentError) {
         console.error("Error fetching assignments:", assignmentError);
         throw assignmentError;
      }
      console.log("Fetched Assignment Data for Crew:", assignmentData);

      // Extract location details and add assignment info
      const locations = assignmentData.map(a => ({
        ...a.locations,
        assignment_id: a.id,
        assignment_status: a.status,
        assignment_notes: a.notes,
        distance: null // Will be calculated later
      }));
      console.log("Processed Assigned Locations for Crew:", locations);
      setAssignedLocations(locations); // Set initial locations (unsorted)

      // Get current user's location
      if (navigator.geolocation) {
        setGeolocationStatus('pending');
        locationWatchId.current = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            console.log("Geolocation success:", { latitude, longitude });
            setCurrentUserLocation({ lat: latitude, lng: longitude });
            setGeolocationStatus('success');
            // Update Supabase with current location and activity timestamp
            updateUserLocation(userData.id, latitude, longitude);
          },
          (geoError) => {
            console.error('Geolocation error:', geoError);
            const errorMsg = `Geolocation error: ${geoError.message}. Location sorting disabled.`;
            setError(errorMsg);
            setGeolocationStatus('error');
            // Keep locations unsorted if geolocation fails
            setAssignedLocations(locations.sort((a, b) => a.name.localeCompare(b.name))); // Sort alphabetically as fallback
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } else {
        const errorMsg = "Geolocation is not supported by this browser. Location sorting disabled.";
        setError(errorMsg);
        setGeolocationStatus('error');
        setAssignedLocations(locations.sort((a, b) => a.name.localeCompare(b.name))); // Sort alphabetically as fallback
      }

    } catch (err) {
      setError(`Failed to load assignment data: ${err.message}`);
      console.error('Error fetching assignment data:', err);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Update user location and last_active_at in Supabase
  const updateUserLocation = async (crewMemberId, latitude, longitude) => {
    try {
      const now = new Date().toISOString();
      console.log(`Attempting to update location for crewMemberId: ${crewMemberId} to ${latitude}, ${longitude}`); // Log attempt

      // Update location
      const { error: locError } = await supabase
        .from('crew_locations')
        .insert({ crew_member_id: crewMemberId, latitude, longitude, timestamp: now });

      if (locError) {
        console.error(`Error inserting into crew_locations:`, locError); // Log specific error
      } else {
        console.log(`Successfully inserted into crew_locations for ${crewMemberId}`); // Log success
      }

      // Update last active timestamp
      const { error: activeError } = await supabase
        .from('crew_members')
        .update({ last_active_at: now })
        .eq('id', crewMemberId); // Use crewMemberId directly

      if (activeError) {
        console.error(`Error updating last_active_at for ${crewMemberId}:`, activeError); // Log specific error
      } else {
         console.log(`Successfully updated last_active_at for ${crewMemberId}`); // Log success
      }

    } catch (err) {
      // This catch block might not catch Supabase client errors unless they throw exceptions
      console.error("Generic error in updateUserLocation:", err);
    }
  };

  // Calculate distances and sort locations when user location is available
  useEffect(() => {
    console.log("Distance calculation effect running. CurrentUserLocation:", currentUserLocation, "AssignedLocations:", assignedLocations);
    // Ensure we have locations and they haven't been sorted by distance yet
    if (currentUserLocation && assignedLocations.length > 0 && assignedLocations[0]?.distance === null) {
       console.log("Calculating distances and sorting...");
      const locationsWithDistance = assignedLocations.map(loc => {
        // Ensure location has coordinates before calculating distance
        if (loc.latitude == null || loc.longitude == null) {
          return { ...loc, distance: Infinity }; // Assign Infinity if no coords
        }
        return {
          ...loc,
          distance: getDistanceFromLatLonInKm(
            currentUserLocation.lat,
            currentUserLocation.lng,
            loc.latitude,
            loc.longitude
          )
        };
      }).sort((a, b) => a.distance - b.distance); // Sort by distance (Infinity will be last)
      setAssignedLocations(locationsWithDistance);
    }
  }, [currentUserLocation, assignedLocations]); // Rerun when location updates or initial locations load


  // --- Directions Service Logic ---
  const calculateRoute = useCallback(() => {
    // Ensure map is loaded, user location exists, locations are assigned & sorted, and route not already calculated
    if (isLoaded && currentUserLocation && assignedLocations.length > 0 && assignedLocations[0]?.distance !== null && !routeCalculated) {
      console.log("Attempting to calculate optimized route...");

      const directionsService = new window.google.maps.DirectionsService();

      // Filter out locations without valid coordinates
      const validLocations = assignedLocations.filter(loc => loc.latitude != null && loc.longitude != null);
      if (validLocations.length === 0) {
        console.log("No valid locations with coordinates to calculate route.");
        return; // No points to route
      }

      // Prepare waypoints (all assigned locations excluding potential start/end if they are the same)
      const waypoints = validLocations.map(loc => ({
        location: { lat: loc.latitude, lng: loc.longitude },
        stopover: true,
      }));

      directionsService.route(
        {
          origin: currentUserLocation, // Start from current location
          destination: currentUserLocation, // End back at current location (round trip)
          waypoints: waypoints,
          optimizeWaypoints: true, // Ask Google to optimize the order!
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === window.google.maps.DirectionsStatus.OK) {
            console.log("Directions calculation successful:", result);
            setDirectionsResponse(result);
            setRouteCalculated(true); // Mark route as calculated
            // Optionally adjust map bounds to fit the route
            if (mapRef.current && result.routes && result.routes.length > 0) {
               const bounds = result.routes[0].bounds;
               mapRef.current.fitBounds(bounds);
            }
          } else {
            console.error(`Error fetching directions ${result}: ${status}`);
            setError(`Failed to calculate route: ${status}`);
          }
        }
      );
    } else {
       console.log("Conditions not met for route calculation:", {isLoaded, currentUserLocation, assignedLocations, routeCalculated});
    }
  }, [isLoaded, currentUserLocation, assignedLocations, routeCalculated]); // Dependencies for calculation trigger

  // Effect to trigger route calculation when ready
  useEffect(() => {
    calculateRoute();
  }, [calculateRoute]); // Run when calculateRoute function updates (due to its dependencies changing)


   // Setup Realtime Subscriptions for assignment changes
   useEffect(() => {
    if (!currentUser || currentUser.role === 'admin' || currentUser.role === 'supervisor') return;

    console.log("Setting up crew assignment realtime subscription...");

    const assignmentChannel = supabase
      .channel('crew_assignments_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crew_assignments', filter: `crew_member_id=eq.${currentUser.id}` },
        (payload) => {
          console.log("Realtime assignment update received:", payload);
          // Re-fetch assignments on change for simplicity
          fetchAssignmentData();
        }
      )
      .subscribe();

    // Cleanup subscriptions and geolocation watch
    return () => {
      console.log("Cleaning up crew assignment realtime subscription...");
      supabase.removeChannel(assignmentChannel);
      if (locationWatchId.current) {
        navigator.geolocation.clearWatch(locationWatchId.current);
      }
    };
  }, [currentUser, fetchAssignmentData]);

  // Initial data fetch
  useEffect(() => {
    fetchAssignmentData();
  }, [fetchAssignmentData]);

  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
    if (location?.latitude && location?.longitude && mapRef.current) {
       mapRef.current.panTo({ lat: location.latitude, lng: location.longitude });
       mapRef.current.setZoom(15);
    }
  };

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);


  // --- Render Logic ---
  if (loading) {
    return <div className="text-center mt-10 dark:text-gray-200">Loading Your Assignments...</div>;
  }

  // Show general error first if it's not a geolocation specific one handled later
  if (error && !error.startsWith('Geolocation error')) {
    return <div className="container mx-auto px-4 py-8 text-red-600 dark:text-red-400">{error}</div>;
  }

  if (!currentUser) {
     return <div className="text-center mt-10 dark:text-gray-200">Initializing...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 text-gray-900 dark:text-gray-200">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold dark:text-white">
          My Assignments
        </h1>
        <button
          onClick={() => navigate('/dashboard')}
          className="btn"
        >
          Back to Dashboard
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Map Area */}
        <div className="md:col-span-2 card p-6">
          {/* Conditional rendering based on the hook's state */}
          {loadError && <div className="text-red-500 dark:text-red-400">Error loading Google Maps: {loadError.message}</div>}
          {!isLoaded && !loadError && <div className="text-center dark:text-gray-200">Loading Map...</div>}
          {isLoaded && (
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={
                  selectedLocation?.latitude // Center on selected location
                  ? { lat: selectedLocation.latitude, lng: selectedLocation.longitude }
                  : currentUserLocation // Center on current user location if available
                  ? currentUserLocation
                  : defaultCenter // Fallback
                }
                zoom={selectedLocation ? 15 : (currentUserLocation ? 13 : 10)}
                onLoad={onMapLoad}
              >
                {/* Don't render assigned location markers directly anymore, will render based on route */}
                {/* {assignedLocations.map((location) => ... )} */}

                {/* Render the calculated route, suppressing default markers */}
                {directionsResponse && (
                  <DirectionsRenderer
                    directions={directionsResponse}
                    options={{
                      suppressMarkers: true, // Hide default A, B, C markers
                      polylineOptions: { // Optional: Style the route line
                        strokeColor: '#0000FF', // Change to Blue
                        strokeOpacity: 0.8,
                        strokeWeight: 4
                      }
                    }}
                  />
                )}

                 {/* Render Custom Markers based on the route */}
                 {isLoaded && directionsResponse && directionsResponse.routes && directionsResponse.routes.length > 0 && (
                   directionsResponse.routes[0].legs.map((leg, index) => (
                     // Marker for the destination of each leg (A, B, C...)
                     <Marker
                      key={`leg-${index}`}
                      position={leg.end_location} // Position is the end of the leg
                      label={String.fromCharCode(65 + index)} // A, B, C...
                      title={`Stop ${String.fromCharCode(65 + index)}: ${leg.end_address}`} // Show address and label on hover
                      // Use default marker appearance for route points
                    />
                  ))
                )}
                {/* Log the legs to see the order */}
                {isLoaded && directionsResponse && console.log("Route Legs:", directionsResponse?.routes?.[0]?.legs)}

                {/* Show Current Location - Keep this marker (Gold Star) */}
                {currentUserLocation && (
                   <Marker
                      key="currentUser"
                      position={currentUserLocation}
                      title="My Current Location"
                      // Use a custom gold star icon
                      icon={{
                        // SVG path for a 5-pointed star (adjust points as needed)
                        path: 'M 12 2 L 15.09 8.26 L 22 9.27 L 17 14.14 L 18.18 21.02 L 12 17.77 L 5.82 21.02 L 7 14.14 L 2 9.27 L 8.91 8.26 Z',
                        fillColor: '#FFD700', // Gold color
                        fillOpacity: 1,
                        strokeWeight: 1,
                        strokeColor: '#B8860B', // Darker gold outline
                        scale: 1, // Adjust scale as needed
                        anchor: new window.google.maps.Point(12, 12) // Center the star (adjust based on path)
                      }}
                      // Old blue dot icon:
                      // icon={{
                      //   path: window.google.maps.SymbolPath.CIRCLE,
                      //   scale: 7,
                      //   fillColor: '#0000FF',
                      //   fillOpacity: 0.8,
                      //   strokeWeight: 1,
                      //   strokeColor: '#FFFFFF'
                      // }}
                    />
                )}
              </GoogleMap>
          )}
        </div>

        {/* Sidebar List */}
        <div className="card p-6 max-h-[600px] overflow-y-auto">
          <h2 className="text-xl font-semibold mb-4 dark:text-white">
            Assigned Locations
          </h2>
          {/* Geolocation Status Feedback */}
          {geolocationStatus === 'pending' && (
            <div className="mb-4 p-3 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded">
              Attempting to get your current location for sorting...
            </div>
          )}
          {geolocationStatus === 'error' && (
             <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-800 border border-yellow-400 dark:border-yellow-600 text-yellow-700 dark:text-yellow-200 rounded">
               Could not get current location. {error.includes('Geolocation error') ? error.split('. ')[0] : error}. Locations sorted alphabetically. Ensure location services are enabled.
             </div>
          )}

          {/* Location List */}
          {assignedLocations.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No locations currently assigned.</p>
          ) : (
            <ul className="space-y-2">
              {assignedLocations.map((location) => (
                <li
                  key={location.assignment_id} // Use assignment ID for key
                  className={`p-3 rounded cursor-pointer ${
                    selectedLocation?.assignment_id === location.assignment_id
                      ? 'bg-blue-100 dark:bg-blue-800'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => handleLocationSelect(location)}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{location.name}</span>
                    {/* Show distance only if successfully calculated */}
                    {location.distance !== null && location.distance !== Infinity && geolocationStatus === 'success' && (
                       <span className="text-sm text-gray-500 dark:text-gray-400">
                         {location.distance.toFixed(2)} km away
                       </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{location.address}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">Status: {location.assignment_status}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Details Panel */}
      {selectedLocation && (
        <div className="mt-6 card p-6">
          <h3 className="text-lg font-semibold mb-4 dark:text-white">
            {selectedLocation.name} - Assignment Details
          </h3>
          <div>
            <p><strong>Address:</strong> {selectedLocation.address}</p>
            {selectedLocation.latitude && <p><strong>Latitude:</strong> {selectedLocation.latitude}</p>}
            {selectedLocation.longitude && <p><strong>Longitude:</strong> {selectedLocation.longitude}</p>}
            {selectedLocation.distance !== null && selectedLocation.distance !== Infinity && geolocationStatus === 'success' && (
              <p><strong>Distance:</strong> {selectedLocation.distance.toFixed(2)} km</p>
            )}
            <p><strong>Assignment Status:</strong> {selectedLocation.assignment_status}</p>
            {selectedLocation.assignment_notes && <p><strong>Notes:</strong> {selectedLocation.assignment_notes}</p>}
            {/* Add buttons here for crew actions like 'Start Job', 'Complete Job' if needed */}
            {/* Example: <button className="btn mt-4">Mark In Progress</button> */}
          </div>
        </div>
      )}
    </div>
  );
}

export default MyAssignments;
