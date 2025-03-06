import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import axios from 'axios';

// Types
interface Plane {
  id: number;
  tail_number: string;
  model: string;
  manufacturer: string;
}

interface Trip {
  id: number;
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;
  status: string;
  estimated_total_cost: number;
}

// Add token debugging
console.log('Mapbox token status:', {
  tokenExists: !!import.meta.env.VITE_MAPBOX_TOKEN,
  tokenLength: import.meta.env.VITE_MAPBOX_TOKEN?.length
});

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

// Loading component
const Loading = ({ message }: { message: string }) => (
  <div className="h-screen flex items-center justify-center bg-gray-900">
    <div className="text-center">
      <h2 className="text-xl font-semibold text-gray-200">{message}</h2>
      <p className="text-gray-400 mt-2">Please wait while we process your request</p>
    </div>
  </div>
);

// Plane Card component
const PlaneCard = ({ plane }: { plane: Plane }) => (
  <div className="p-3 bg-gray-700 rounded-md">
    <p className="font-medium text-white">{plane.tail_number}</p>
    <p className="text-sm text-gray-300">
      {plane.manufacturer} {plane.model}
    </p>
  </div>
);

// Trip Card component
const TripCard = ({ trip }: { trip: Trip }) => (
  <div className="p-3 bg-gray-700 rounded-md">
    <p className="font-medium text-white">
      {trip.departure_airport} → {trip.arrival_airport}
    </p>
    <p className="text-sm text-gray-300">
      {new Date(trip.departure_time).toLocaleDateString()}
    </p>
    <p className="text-sm text-gray-300">
      Status: <span className="capitalize">{trip.status}</span>
    </p>
    {trip.estimated_total_cost && (
      <p className="text-sm text-gray-300">
        Est. Cost: ${trip.estimated_total_cost.toLocaleString()}
      </p>
    )}
  </div>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [planes, setPlanes] = useState<Plane[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [showAddPlane, setShowAddPlane] = useState(false);
  const [showAddTrip, setShowAddTrip] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [newPlane, setNewPlane] = useState({ 
    tail_number: '',
    model: '',
    manufacturer: ''
  });
  const [newTrip, setNewTrip] = useState({
    departure_airport: '',
    arrival_airport: '',
    plane_id: '',
    departure_time: '',
  });
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('No token found, redirecting to login');
      navigate('/', { replace: true });
      return;
    }

    // Set up axios default headers
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    // First fetch data
    console.log('Fetching initial data...');
    Promise.all([fetchPlanes(), fetchTrips()])
      .then(([planesResponse, tripsResponse]) => {
        console.log('Initial data fetched successfully:', {
          planes: planesResponse,
          trips: tripsResponse
        });
        setDataLoaded(true);
      })
      .catch(error => {
        console.error('Error fetching initial data:', error);
        setError(error instanceof Error ? error.message : 'Error fetching data');
        setDataLoaded(true); // Set to true even on error to allow map initialization
      });
  }, [navigate]);

  // Separate useEffect for map initialization that depends on data being loaded
  useEffect(() => {
    console.log('Map initialization check:', {
      dataLoaded,
      hasContainer: !!mapContainer.current,
      hasMap: !!map.current,
      mapboxToken: !!MAPBOX_TOKEN
    });

    if (!dataLoaded || !mapContainer.current || map.current) {
      return;
    }

    console.log('Starting map initialization...');
    try {
      if (!MAPBOX_TOKEN) {
        throw new Error('Mapbox token is not set in environment variables');
      }

      console.log('Initializing Mapbox...');
      mapboxgl.accessToken = MAPBOX_TOKEN;

      console.log('Creating map instance...');
      const mapInstance = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [-98.5795, 39.8283],
        zoom: 3
      });

      map.current = mapInstance;

      mapInstance.on('load', () => {
        console.log('Map loaded successfully');
        setIsInitialized(true);
        setIsLoading(false);
      });

      mapInstance.on('error', (e) => {
        console.error('Mapbox error:', e);
        setError('Error loading map: ' + (e.error?.message || 'Unknown error'));
        setIsInitialized(true);
        setIsLoading(false);
      });

    } catch (error) {
      console.error('Error initializing map:', error);
      setError(error instanceof Error ? error.message : 'Error initializing map');
      setIsInitialized(true);
      setIsLoading(false);
    }

    return () => {
      if (map.current) {
        console.log('Cleaning up map instance');
        map.current.remove();
        map.current = null;
      }
    };
  }, [dataLoaded]); // Depend on dataLoaded instead of an empty array

  const fetchPlanes = async () => {
    try {
      console.log('Fetching planes...');
      const { data } = await axios.get('/api/planes', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      console.log('Planes fetched:', data);
      setPlanes(data);
      return data;
    } catch (error: any) {
      console.error('Error fetching planes:', error);
      const errorMessage = error.response?.data?.error || 'Error fetching planes';
      setError(errorMessage);
      if (error.response?.status === 401) {
        navigate('/');
      }
      throw error;
    }
  };

  const fetchTrips = async () => {
    try {
      console.log('Fetching trips...');
      const { data } = await axios.get('/api/trips', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      console.log('Trips fetched:', data);
      setTrips(data);
      return data;
    } catch (error: any) {
      console.error('Error fetching trips:', error);
      const errorMessage = error.response?.data?.error || 'Error fetching trips';
      setError(errorMessage);
      if (error.response?.status === 401) {
        navigate('/');
      }
      throw error;
    }
  };

  const handleAddPlane = async () => {
    try {
      await axios.post(
        '/api/planes',
        newPlane,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }
      );
      setShowAddPlane(false);
      setNewPlane({ tail_number: '', model: '', manufacturer: '' });
      fetchPlanes();
    } catch (error: any) {
      console.error('Error adding plane:', error);
      alert(error.response?.data?.error || 'Error adding plane');
    }
  };

  const handleAddTrip = async () => {
    try {
      await axios.post(
        '/api/trips',
        newTrip,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }
      );
      setShowAddTrip(false);
      setNewTrip({
        departure_airport: '',
        arrival_airport: '',
        plane_id: '',
        departure_time: ''
      });
      fetchTrips();
    } catch (error: any) {
      console.error('Error adding trip:', error);
      alert(error.response?.data?.error || 'Error adding trip');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  if (!dataLoaded) {
    return (
      <Loading message="Loading Dashboard" />
    );
  }

  // Add a loading overlay for map initialization
  const LoadingOverlay = () => (
    <div className="absolute inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-10">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-200">Initializing Map...</h2>
        <p className="text-gray-400 mt-2">Please wait while we set up your dashboard</p>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">GoChart Dashboard</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Map */}
        <div ref={mapContainer} className="flex-1 relative">
          {isLoading && !isInitialized && <LoadingOverlay />}
        </div>

        {/* Side Panel */}
        <div className="w-96 bg-gray-800 shadow-xl overflow-y-auto border-l border-gray-700">
          {error && (
            <div className="p-4 bg-red-900/50 border-l-4 border-red-500 text-red-200">
              {error}
            </div>
          )}

          {/* Planes Section */}
          <div className="p-4 border-b border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">My Planes</h2>
              <button
                onClick={() => setShowAddPlane(true)}
                className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 text-sm"
              >
                Add Plane
              </button>
            </div>
            {isLoading ? (
              <div className="text-center py-4 text-gray-400">Loading planes...</div>
            ) : (
              <div className="space-y-2">
                {planes.map(plane => (
                  <PlaneCard key={plane.id} plane={plane} />
                ))}
                {planes.length === 0 && (
                  <p className="text-gray-400 text-center py-4">No planes added yet</p>
                )}
              </div>
            )}
          </div>

          {/* Trips Section */}
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">My Trips</h2>
              <button
                onClick={() => setShowAddTrip(true)}
                className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={planes.length === 0}
              >
                Add Trip
              </button>
            </div>
            <div className="space-y-2">
              {trips.map(trip => (
                <TripCard key={trip.id} trip={trip} />
              ))}
              {trips.length === 0 && (
                <p className="text-gray-400 text-center py-4">No trips scheduled</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Plane Modal */}
      {showAddPlane && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-white">Add New Plane</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Tail Number
                </label>
                <input
                  type="text"
                  placeholder="N12345"
                  className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                  value={newPlane.tail_number}
                  onChange={e => setNewPlane({ ...newPlane, tail_number: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Model
                </label>
                <input
                  type="text"
                  placeholder="Citation CJ4"
                  className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                  value={newPlane.model}
                  onChange={e => setNewPlane({ ...newPlane, model: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Manufacturer
                </label>
                <input
                  type="text"
                  placeholder="Cessna"
                  className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                  value={newPlane.manufacturer}
                  onChange={e => setNewPlane({ ...newPlane, manufacturer: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowAddPlane(false)}
                className="px-4 py-2 text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPlane}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Add Plane
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Trip Modal */}
      {showAddTrip && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-white">Add New Trip</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Departure Airport (ICAO)
                </label>
                <input
                  type="text"
                  placeholder="KJFK"
                  className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                  value={newTrip.departure_airport}
                  onChange={e => setNewTrip({ ...newTrip, departure_airport: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Arrival Airport (ICAO)
                </label>
                <input
                  type="text"
                  placeholder="KLAX"
                  className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                  value={newTrip.arrival_airport}
                  onChange={e => setNewTrip({ ...newTrip, arrival_airport: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Aircraft
                </label>
                <select
                  className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={newTrip.plane_id}
                  onChange={e => setNewTrip({ ...newTrip, plane_id: e.target.value })}
                >
                  <option value="" className="text-gray-400">Select Aircraft</option>
                  {planes.map(plane => (
                    <option key={plane.id} value={plane.id}>
                      {plane.tail_number} - {plane.model}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Departure Time
                </label>
                <input
                  type="datetime-local"
                  className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={newTrip.departure_time}
                  onChange={e => setNewTrip({ ...newTrip, departure_time: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowAddTrip(false)}
                className="px-4 py-2 text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTrip}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Add Trip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard; 