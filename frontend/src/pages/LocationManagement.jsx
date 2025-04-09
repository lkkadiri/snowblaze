import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';

function LocationManagement() {
  const [locations, setLocations] = useState([]);
  const [newLocation, setNewLocation] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    latitude: '',
    longitude: '',
    geofence_details: '',
    notes: '',
    status: 'active'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        // Get current user session
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          navigate('/login');
          return;
        }

        // Fetch locations for the user's organization
        const { data: locationsData, error: locationsError } = await supabase
          .from('locations')
          .select('*')
          .eq('organization_id', session.user.user_metadata.organization_id);

        if (locationsError) throw locationsError;

        setLocations(locationsData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching locations:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    fetchLocations();
  }, [navigate]);

  const handleAddLocation = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Get current user session to get organization ID
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No active session');
      }

      // Prepare location data
      const locationData = {
        ...newLocation,
        organization_id: session.user.user_metadata.organization_id,
        geofence_details: newLocation.geofence_details
          ? JSON.parse(newLocation.geofence_details)
          : null,
        latitude: newLocation.latitude ? parseFloat(newLocation.latitude) : null,
        longitude: newLocation.longitude ? parseFloat(newLocation.longitude) : null
      };

      // Insert new location
      const { data: newLocationData, error: insertError } = await supabase
        .from('locations')
        .insert(locationData)
        .select()
        .single();

      if (insertError) throw insertError;

      // Update local state
      setLocations([...locations, newLocationData]);

      // Reset form
      setNewLocation({
        name: '',
        address: '',
        phone: '',
        email: '',
        latitude: '',
        longitude: '',
        geofence_details: '',
        notes: '',
        status: 'active'
      });
      setLoading(false);
    } catch (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  const handleRemoveLocation = async (locationId) => {
    setLoading(true);
    try {
      // Remove location
      const { error: deleteError } = await supabase
        .from('locations')
        .delete()
        .eq('id', locationId);

      if (deleteError) throw deleteError;

      // Update local state
      setLocations(locations.filter(l => l.id !== locationId));
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
          <p className="text-gray-700">Loading locations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Location Management</h1>
        <button
          onClick={() => navigate('/dashboard')}
          className="btn"
        >
          Back to Dashboard
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4">Add New Location</h2>
          <form onSubmit={handleAddLocation} className="space-y-4">
            <div>
              <label htmlFor="name" className="block mb-2">Location Name</label>
              <input
                type="text"
                id="name"
                value={newLocation.name}
                onChange={(e) => setNewLocation({...newLocation, name: e.target.value})}
                required
                className="input"
                placeholder="Location Name"
              />
            </div>
            <div>
              <label htmlFor="address" className="block mb-2">Address</label>
              <input
                type="text"
                id="address"
                value={newLocation.address}
                onChange={(e) => setNewLocation({...newLocation, address: e.target.value})}
                required
                className="input"
                placeholder="Full Address"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="phone" className="block mb-2">Phone</label>
                <input
                  type="tel"
                  id="phone"
                  value={newLocation.phone}
                  onChange={(e) => setNewLocation({...newLocation, phone: e.target.value})}
                  className="input"
                  placeholder="Phone Number"
                />
              </div>
              <div>
                <label htmlFor="email" className="block mb-2">Email</label>
                <input
                  type="email"
                  id="email"
                  value={newLocation.email}
                  onChange={(e) => setNewLocation({...newLocation, email: e.target.value})}
                className="input"
                placeholder="Contact Email"
              />
            </div>
            </div> {/* Closing the grid div for phone/email */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="latitude" className="block mb-2">Latitude</label>
                <input
                  type="number"
                  id="latitude"
                  step="0.000001"
                  value={newLocation.latitude}
                  onChange={(e) => setNewLocation({...newLocation, latitude: e.target.value})}
                  className="input"
                  placeholder="Latitude"
                />
              </div>
              <div>
                <label htmlFor="longitude" className="block mb-2">Longitude</label>
                <input
                  type="number"
                  id="longitude"
                  step="0.000001"
                  value={newLocation.longitude}
                  onChange={(e) => setNewLocation({...newLocation, longitude: e.target.value})}
                className="input"
                placeholder="Longitude"
                />
              </div>
            </div>
            <div>
              <label htmlFor="geofence_details" className="block mb-2">Geofence Details (JSON)</label>
              <textarea
                id="geofence_details"
                value={newLocation.geofence_details}
                onChange={(e) => setNewLocation({...newLocation, geofence_details: e.target.value})}
                className="input"
                placeholder='Optional JSON, e.g. {"radius": 500, "shape": "circle"}'
                rows="3"
              />
            </div>
            <div>
              <label htmlFor="notes" className="block mb-2">Notes</label>
              <textarea
                id="notes"
                value={newLocation.notes}
                onChange={(e) => setNewLocation({...newLocation, notes: e.target.value})}
                className="input"
                placeholder="Additional notes about the location"
                rows="3"
              />
            </div>
            <div>
              <label htmlFor="status" className="block mb-2">Status</label>
              <select
                id="status"
                value={newLocation.status}
                onChange={(e) => setNewLocation({...newLocation, status: e.target.value})}
                className="input"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
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
              className="btn"
            >
              {loading ? 'Adding Location...' : 'Add Location'}
            </button>
          </form>
        </div> {/* This closes the 'Add New Location' card div */}

        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4">Current Locations</h2>
          {locations.length === 0 ? (
            <p className="text-gray-500">No locations added yet.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-3">Name</th>
                  <th className="p-3">Address</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((location) => (
                  <tr key={location.id} className="border-b">
                    <td className="p-3">{location.name}</td>
                    <td className="p-3">{location.address}</td>
                    <td className="p-3">{location.status}</td>
                    <td className="p-3">
                      <button
                        onClick={() => handleRemoveLocation(location.id)}
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
        </div> {/* This closes the 'Current Locations' card div */}
      </div> {/* This closes the grid div */}
    </div> // This closes the container div
  );
}

export default LocationManagement;
