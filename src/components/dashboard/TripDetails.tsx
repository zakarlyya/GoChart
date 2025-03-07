import React, { useState } from 'react';
import { Trip, Plane, Pilot } from '../../types';
import TripForm from './TripForm';

// Declare window interface
declare global {
  interface Window {
    mapInstance?: any;
    updateTripRouteColor?: (tripId: number, newStatus: string) => void;
    removeTripFromMap?: (tripId: number) => void;
  }
}

interface TripDetailsProps {
  trip: Trip;
  planes: Plane[];
  pilots: Pilot[];
  onClose: () => void;
  onUpdate: (updates: Partial<Trip>) => Promise<void>;
  onDelete: () => Promise<void>;
}

/**
 * Component for viewing and managing trip details
 */
export const TripDetails: React.FC<TripDetailsProps> = ({
  trip,
  planes,
  pilots,
  onClose,
  onUpdate,
  onDelete
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  const handleStatusChange = async (newStatus: Trip['status']) => {
    try {
      // Create a new object with only the fields we want to update
      const updates: Partial<Trip> = {
        status: newStatus
      };
      
      // Set actual departure time if changing to departed and not already set
      if (newStatus === 'departed' && !trip.actual_departure_time) {
        updates.actual_departure_time = new Date().toISOString();
      }
      
      // Set actual arrival time if changing to arrived and not already set
      if (newStatus === 'arrived' && !trip.actual_arrival_time) {
        updates.actual_arrival_time = new Date().toISOString();
      }
      
      // Update the trip
      await onUpdate(updates);
      
      // Directly update the map route color
      if (window.updateTripRouteColor) {
        window.updateTripRouteColor(trip.id, newStatus);
      }
      
      // Force a refresh by closing and reopening the modal
      onClose();
      setTimeout(() => {
        // This is a workaround to ensure the map updates
        window.dispatchEvent(new Event('resize'));
      }, 100);
    } catch (error) {
      console.error('Error updating trip status:', error);
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleString();
  };

  const formatCost = (cost: number) => {
    return `$${cost.toLocaleString()}`;
  };

  if (isEditing) {
    return (
      <TripForm
        trip={trip}
        planes={planes}
        pilots={pilots}
        onSubmit={onUpdate}
        onClose={() => setIsEditing(false)}
      />
    );
  }

  if (showDeleteConfirmation) {
    return (
      <div className="p-6">
        <h3 className="text-xl font-bold text-white mb-4">Delete Trip</h3>
        <p className="text-gray-300 mb-6">
          Are you sure you want to delete this trip? This action cannot be undone.
        </p>
        <div className="flex justify-end space-x-2">
          <button
            onClick={() => setShowDeleteConfirmation(false)}
            className="px-4 py-2 text-gray-300 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Delete Trip
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Trip Details</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Edit
          </button>
          {trip.status === 'scheduled' && (
            <button
              onClick={() => setShowDeleteConfirmation(true)}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
            >
              Delete
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
          >
            Close
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="text-gray-400 text-sm">Route</h3>
          <p className="text-white text-lg">
            {trip.departure_airport} → {trip.arrival_airport}
          </p>
        </div>

        <div>
          <h3 className="text-gray-400 text-sm">Status</h3>
          <select
            value={trip.status}
            onChange={(e) => handleStatusChange(e.target.value as Trip['status'])}
            className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md"
          >
            <option value="scheduled">Scheduled</option>
            <option value="departed">Departed</option>
            <option value="arrived">Arrived</option>
          </select>
        </div>

        <div>
          <h3 className="text-gray-400 text-sm">Aircraft</h3>
          <p className="text-white text-lg">{getPlaneDetails(trip.plane_id)}</p>
        </div>

        <div>
          <h3 className="text-gray-400 text-sm">Pilot</h3>
          <p className="text-white text-lg">{getPilotName(trip.pilot_id)}</p>
        </div>

        <div>
          <h3 className="text-gray-400 text-sm">Scheduled Departure</h3>
          <p className="text-white text-lg">{formatDate(trip.departure_time)}</p>
        </div>

        <div>
          <h3 className="text-gray-400 text-sm">Estimated Arrival</h3>
          <p className="text-white text-lg">{formatDate(trip.estimated_arrival_time)}</p>
        </div>

        {trip.status !== 'scheduled' && (
          <>
            <div>
              <h3 className="text-gray-400 text-sm">Actual Departure</h3>
              <p className="text-white text-lg">{formatDate(trip.actual_departure_time)}</p>
            </div>

            {trip.status === 'arrived' && (
              <div>
                <h3 className="text-gray-400 text-sm">Actual Arrival</h3>
                <p className="text-white text-lg">{formatDate(trip.actual_arrival_time)}</p>
              </div>
            )}
          </>
        )}

        <div>
          <h3 className="text-gray-400 text-sm">Estimated Cost</h3>
          <p className="text-white text-lg">{formatCost(trip.estimated_total_cost)}</p>
        </div>
      </div>
    </div>
  );
};

export default TripDetails; 