import React, { useState } from 'react';
import { Trip, Plane, Pilot } from '../../types';

// Declare window interface
declare global {
  interface Window {
    mapInstance?: any;
    updateTripRouteColor?: (tripId: number, newStatus: string) => void;
    removeTripFromMap?: (tripId: number) => void;
  }
}

interface TripFormProps {
  trip?: Trip;
  planes: Plane[];
  pilots: Pilot[];
  onSubmit: (trip: Omit<Trip, 'id' | 'estimated_total_cost'>) => Promise<void>;
  onClose: () => void;
}

/**
 * Form component for adding and editing trips
 */
export const TripForm: React.FC<TripFormProps> = ({
  trip,
  planes,
  pilots,
  onSubmit,
  onClose
}) => {
  const [formData, setFormData] = useState<Omit<Trip, 'id' | 'estimated_total_cost'>>({
    plane_id: trip?.plane_id || planes[0]?.id || 0,
    pilot_id: trip?.pilot_id || null,
    departure_airport: trip?.departure_airport || '',
    arrival_airport: trip?.arrival_airport || '',
    departure_time: trip?.departure_time || new Date().toISOString().slice(0, 16),
    estimated_arrival_time: trip?.estimated_arrival_time || '',
    actual_departure_time: trip?.actual_departure_time || null,
    actual_arrival_time: trip?.actual_arrival_time || null,
    status: trip?.status || 'scheduled'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'status') {
      const newStatus = value as Trip['status'];
      const now = new Date().toISOString();
      
      setFormData(prev => ({
        ...prev,
        status: newStatus,
        actual_departure_time: newStatus === 'departed' && !prev.actual_departure_time ? now : prev.actual_departure_time,
        actual_arrival_time: newStatus === 'arrived' && !prev.actual_arrival_time ? now : prev.actual_arrival_time
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value === '' ? null : value
      }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Aircraft
          </label>
          <select
            name="plane_id"
            value={formData.plane_id}
            onChange={handleChange}
            className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md"
            required
          >
            {planes.map(plane => (
              <option key={plane.id} value={plane.id}>
                {plane.tail_number} - {plane.nickname || `${plane.manufacturer} ${plane.model}`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Pilot
          </label>
          <select
            name="pilot_id"
            value={formData.pilot_id || ''}
            onChange={handleChange}
            className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md"
          >
            <option value="">Select Pilot</option>
            {pilots.map(pilot => (
              <option key={pilot.id} value={pilot.id}>
                {pilot.name} - {pilot.license_number}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Departure Airport
          </label>
          <input
            type="text"
            name="departure_airport"
            value={formData.departure_airport}
            onChange={handleChange}
            placeholder="KJFK"
            className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Arrival Airport
          </label>
          <input
            type="text"
            name="arrival_airport"
            value={formData.arrival_airport}
            onChange={handleChange}
            placeholder="KLAX"
            className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Departure Time
          </label>
          <input
            type="datetime-local"
            name="departure_time"
            value={formData.departure_time}
            onChange={handleChange}
            className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Status
          </label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md"
            required
          >
            <option value="scheduled">Scheduled</option>
            <option value="departed">Departed</option>
            <option value="arrived">Arrived</option>
          </select>
        </div>

        {formData.status !== 'scheduled' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Actual Departure Time
              </label>
              <input
                type="datetime-local"
                name="actual_departure_time"
                value={formData.actual_departure_time || ''}
                onChange={handleChange}
                className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md"
              />
            </div>

            {formData.status === 'arrived' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Actual Arrival Time
                </label>
                <input
                  type="datetime-local"
                  name="actual_arrival_time"
                  value={formData.actual_arrival_time || ''}
                  onChange={handleChange}
                  className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md"
                />
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex justify-end space-x-2 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-gray-300 hover:text-white"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          {trip ? 'Update Trip' : 'Add Trip'}
        </button>
      </div>
    </form>
  );
};

export default TripForm; 