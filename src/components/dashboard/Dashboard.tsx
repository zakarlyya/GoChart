import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MapComponent from '../map/MapComponent';
import { SidePanel } from './SidePanel';
import { Header } from './Header';
import useDataFetching from '../../hooks/useDataFetching';
import api from '../../services/api';
import { Plane, Trip, Pilot } from '../../types';

// Type declaration for import.meta.env
declare global {
  interface ImportMeta {
    env: {
      VITE_MAPBOX_TOKEN: string;
      VITE_MAGICAPI_KEY: string:
    }
  }
  
  interface Window {
    mapInstance?: any;
    updateTripRouteColor?: (tripId: number, newStatus: string) => void;
    removeTripFromMap?: (tripId: number) => void;
  }
}

/**
 * Main Dashboard component
 */
const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  // Data fetching hooks
  const { 
    data: planes, 
    isLoading: planesLoading, 
    error: planesError,
    refetch: refetchPlanes 
  } = useDataFetching(api.planes.getAll, [], []);

  const { 
    data: trips, 
    isLoading: tripsLoading, 
    error: tripsError,
    refetch: refetchTrips 
  } = useDataFetching(api.trips.getAll, [], []);

  const { 
    data: pilots, 
    isLoading: pilotsLoading, 
    error: pilotsError,
    refetch: refetchPilots 
  } = useDataFetching(api.pilots.getAll, [], []);

  // State
  const [selectedPlaneId, setSelectedPlaneId] = useState<number | null>(null);
  const [hoveredTripId, setHoveredTripId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check for token on mount
  useEffect(() => {
    if (!token) {
      navigate('/', { replace: true });
    }
  }, [token, navigate]);

  // Handle errors
  useEffect(() => {
    const errors = [planesError, tripsError, pilotsError].filter(Boolean);
    if (errors.length > 0) {
      setError(errors.join(', '));
    } else {
      setError(null);
    }
  }, [planesError, tripsError, pilotsError]);

  // Force map refresh when trips change
  useEffect(() => {
    // This is a workaround to ensure the map updates when trip data changes
    const handleTripChange = () => {
      if (window.mapInstance) {
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
        }, 100);
      }
    };
    
    handleTripChange();
  }, [trips]);

  // Handlers
  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/', { replace: true });
  };

  const handleRefreshData = async () => {
    await Promise.all([
      refetchPlanes(),
      refetchTrips(),
      refetchPilots()
    ]);
  };

  const handlePlaneSelect = (planeId: number | null) => {
    setSelectedPlaneId(planeId);
  };

  const handleTripHover = (tripId: number | null) => {
    setHoveredTripId(tripId);
  };

  // Loading state
  const isLoading = planesLoading || tripsLoading || pilotsLoading;
  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-gray-900">
        <Header onLogout={handleLogout} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-300">Loading data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <Header onLogout={handleLogout} />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Map */}
        <div className="flex-1 relative">
          <MapComponent
            key={`map-${trips.map(t => `${t.id}-${t.status}`).join('-')}`}
            trips={trips}
            selectedPlaneId={selectedPlaneId}
            hoveredTripId={hoveredTripId}
            onTripHover={handleTripHover}
            mapboxToken={import.meta.env.VITE_MAPBOX_TOKEN}
          />
        </div>

        {/* Side Panel */}
        <SidePanel
          planes={planes}
          trips={trips}
          pilots={pilots}
          selectedPlaneId={selectedPlaneId}
          hoveredTripId={hoveredTripId}
          error={error}
          onPlaneSelect={handlePlaneSelect}
          onTripHover={handleTripHover}
          onRefreshData={handleRefreshData}
        />
      </div>
    </div>
  );
};

export default Dashboard; 