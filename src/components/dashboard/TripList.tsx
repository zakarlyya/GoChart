import React, { useState } from 'react';
import { Trip, Plane, Pilot } from '../../types';
import Modal from '../shared/Modal';
import TripForm from './TripForm';
import TripDetails from './TripDetails';
import api from '../../services/api';

// Declare window.mapInstance
declare global {
  interface Window {
    mapInstance?: any;
    updateTripRouteColor?: (tripId: number, status: string) => void;
    removeTripFromMap?: (tripId: number) => void;
  }
}

interface TripListProps {
  trips: Trip[];
  pilots: Pilot[];
  planes: Plane[];
  isExpanded: boolean;
  hoveredTripId: number | null;
  onToggleExpand: () => void;
  onTripHover: (tripId: number | null) => void;
  onRefreshData: () => Promise<void>;
}

/**
 * Component for displaying and managing trips
 */
export const TripList: React.FC<TripListProps> = ({
  trips,
  pilots,
  planes,
  isExpanded,
  hoveredTripId,
  onToggleExpand,
  onTripHover,
  onRefreshData
}) => {
  const [showAddTrip, setShowAddTrip] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAddTrip = async (trip: Omit<Trip, 'id' | 'estimated_total_cost'>) => {
    try {
      await api.trips.create(trip);
      setShowAddTrip(false);
      onRefreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error adding trip');
    }
  };

  const handleUpdateTrip = async (updates: Partial<Trip>) => {
    try {
      if (!selectedTrip) return;
      
      // Update the trip
      await api.trips.update(selectedTrip.id, updates);
      
      // Directly update the map route color if status changed
      if (updates.status && window.updateTripRouteColor) {
        window.updateTripRouteColor(selectedTrip.id, updates.status);
      }
      
      // Close the modal
      setSelectedTrip(null);
      
      // Refresh the data to update the map
      await onRefreshData();
      
      // Force map refresh
      setTimeout(() => {
        if (window.mapInstance) {
          // Trigger a resize event to force map redraw
          window.dispatchEvent(new Event('resize'));
          
          // If the trip status changed, force a complete map rebuild
          if (updates.status && updates.status !== selectedTrip.status) {
            // This will force the map to rebuild all routes with the new status colors
            if (window.mapInstance.getSource) {
              const sourceId = `route-source-${selectedTrip.id}`;
              const layerId = `route-layer-${selectedTrip.id}`;
              
              try {
                if (window.mapInstance.getLayer(layerId)) {
                  window.mapInstance.removeLayer(layerId);
                }
                if (window.mapInstance.getSource(sourceId)) {
                  window.mapInstance.removeSource(sourceId);
                }
              } catch (e) {
                // Ignore errors when removing layers/sources
              }
            }
          }
        }
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating trip');
    }
  };

  const handleDeleteTrip = async () => {
    try {
      if (!selectedTrip) return;
      
      // Store the trip ID before deleting
      const tripId = selectedTrip.id;
      
      // Delete the trip
      await api.trips.delete(tripId);
      
      // Remove the trip from the map
      if (window.removeTripFromMap) {
        window.removeTripFromMap(tripId);
      }
      
      // Close the modal
      setSelectedTrip(null);
      
      // Refresh the data
      await onRefreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting trip');
    }
  };

  const getPlaneDetails = (planeId: number) => {
    const plane = planes.find(p => p.id === planeId);
    return plane ? `${plane.tail_number} - ${plane.nickname || `${plane.manufacturer} ${plane.model}`}` : 'Unknown';
  };

  const getPilotName = (pilotId: number | null) => {
    if (!pilotId) return 'No pilot assigned';
    const pilot = pilots.find(p => p.id === pilotId);
    return pilot ? pilot.name : 'Unknown';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div>
      {/* Section header */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={onToggleExpand}
          className="flex items-center space-x-2 text-xl font-bold text-white hover:text-gray-300 transition-colors"
        >
          <svg
            className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          <span>My Trips</span>
        </button>
        <button
          onClick={() => setShowAddTrip(true)}
          className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 text-sm"
          disabled={planes.length === 0}
        >
          Add Trip
        </button>
      </div>

      {/* Trips list */}
      {isExpanded && (
        <div className="space-y-2">
          {trips.map(trip => (
            <div
              key={trip.id}
              className={`p-3 rounded-md cursor-pointer transition-colors ${
                hoveredTripId === trip.id ? 'bg-gray-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
              onMouseEnter={() => onTripHover(trip.id)}
              onMouseLeave={() => onTripHover(null)}
              onClick={() => setSelectedTrip(trip)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-white">
                    {trip.departure_airport} → {trip.arrival_airport}
                  </p>
                  <p className="text-sm text-gray-300">
                    {formatDate(trip.departure_time)}
                  </p>
                  <p className="text-sm text-gray-300">
                    Status: <span className="capitalize">{trip.status}</span>
                  </p>
                  <p className="text-sm text-gray-300">
                    Aircraft: {getPlaneDetails(trip.plane_id)}
                  </p>
                  <p className="text-sm text-gray-300">
                    Pilot: {getPilotName(trip.pilot_id)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-300">
                    Est. Cost: ${trip.estimated_total_cost.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {trips.length === 0 && (
            <p className="text-gray-400 text-center py-4">No trips scheduled</p>
          )}
        </div>
      )}

      {/* Add trip modal */}
      <Modal
        isOpen={showAddTrip}
        onClose={() => setShowAddTrip(false)}
        title="Add New Trip"
      >
        <TripForm
          planes={planes}
          pilots={pilots}
          onSubmit={handleAddTrip}
          onClose={() => setShowAddTrip(false)}
        />
      </Modal>

      {/* Trip details modal */}
      {selectedTrip && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedTrip(null)}
          title="Trip Details"
        >
          <TripDetails
            trip={selectedTrip}
            planes={planes}
            pilots={pilots}
            onClose={() => setSelectedTrip(null)}
            onUpdate={handleUpdateTrip}
            onDelete={handleDeleteTrip}
          />
        </Modal>
      )}

      {/* Error display */}
      {error && (
        <div className="mt-4 p-3 bg-red-900/50 border-l-4 border-red-500 text-red-200">
          {error}
        </div>
      )}
    </div>
  );
}; 
 