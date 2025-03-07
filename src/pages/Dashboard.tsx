/// <reference types="vite/client" />

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import axios from 'axios';

// Type declaration for import.meta.env
declare global {
  interface ImportMetaEnv {
    VITE_MAPBOX_TOKEN: string;
    VITE_MAGICAPI_KEY: string;
  }
}

// Types
interface Plane {
  id: number;
  tail_number: string;
  model: string;
  manufacturer: string;
  nickname?: string;
  num_engines: number;
  num_seats: number;
  isLocked?: boolean;
  modelLocked?: boolean;
  manufacturerLocked?: boolean;
  enginesLocked?: boolean;
  seatsLocked?: boolean;
}

interface Trip {
  id: number;
  plane_id: number;
  pilot_id: number | null;
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;
  estimated_arrival_time: string;
  actual_departure_time: string | null;
  actual_arrival_time: string | null;
  status: 'scheduled' | 'departed' | 'arrived';
  estimated_total_cost: number;
}

interface Pilot {
  id: number;
  name: string;
  license_number: string;
  rating?: string;
  total_hours?: number;
  contact_number?: string;
  email?: string;
}

interface Airport {
  icao: string;
  name: string;
  city: string;
  country: string;
  coordinates: [number, number];
}

// Add token debugging
console.log('Mapbox token status:', {
  tokenExists: !!import.meta.env.VITE_MAPBOX_TOKEN,
  tokenLength: import.meta.env.VITE_MAPBOX_TOKEN?.length
});

// Add this function near the top of the file, after imports
const getWebGLErrorMessage = () => {
  const canvas = document.createElement('canvas');
  let message = 'WebGL is not available.';
  
  try {
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      message = 'Your browser supports WebGL but it could not be initialized.';
      if (window.WebGLRenderingContext) {
        message += ' This might be due to your graphics card or its drivers.';
      }
    }
  } catch (e) {
    message = 'Your browser or device does not support WebGL.';
  }
  
  return message;
};

// Loading component
const Loading = ({ message }: { message: string }) => (
  <div className="absolute inset-0 bg-gray-900 bg-opacity-80 flex items-center justify-center z-50">
    <div className="text-center p-6 bg-gray-800 rounded-lg shadow-lg">
      <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
      <h2 className="text-xl font-semibold text-white mb-2">{message}</h2>
      <p className="text-gray-300">Please wait while we process your request</p>
    </div>
  </div>
);

// Updated Plane Card component
const PlaneCard = ({ plane, onClick }: { plane: Plane; onClick: () => void }) => {
  const displayName = plane.nickname || `${plane.manufacturer} ${plane.model}`;
  
  return (
    <div 
      className="p-3 bg-gray-700 rounded-md hover:bg-gray-600 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <p className="font-medium text-white">{plane.tail_number}</p>
      <p className="text-sm text-gray-300">{displayName}</p>
    </div>
  );
};

// Plane Details Modal component
const PlaneDetailsModal = ({ 
  plane, 
  onClose, 
  onSave, 
  onDelete 
}: { 
  plane: Plane; 
  onClose: () => void; 
  onSave: (updatedPlane: Partial<Plane>) => void;
  onDelete: () => void;
}) => {
  const [form, setForm] = useState({
    tail_number: plane.tail_number,
    model: plane.model,
    manufacturer: plane.manufacturer,
    nickname: plane.nickname || '',
    num_engines: plane.num_engines || 2,
    num_seats: plane.num_seats || 20
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-2 z-50">
      <div className="bg-gray-800 p-4 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold text-white">Plane Details</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300">Tail Number</label>
              <input
                type="text"
                value={form.tail_number}
                onChange={e => setForm({ ...form, tail_number: e.target.value })}
                className="mt-1 w-full p-1.5 bg-gray-700 border border-gray-600 text-white rounded-md text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300">Model</label>
              <input
                type="text"
                value={form.model}
                onChange={e => setForm({ ...form, model: e.target.value })}
                className="mt-1 w-full p-1.5 bg-gray-700 border border-gray-600 text-white rounded-md text-sm"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">Manufacturer</label>
            <input
              type="text"
              value={form.manufacturer}
              onChange={e => setForm({ ...form, manufacturer: e.target.value })}
              className="mt-1 w-full p-1.5 bg-gray-700 border border-gray-600 text-white rounded-md text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">Nickname (Optional)</label>
            <input
              type="text"
              value={form.nickname}
              onChange={e => setForm({ ...form, nickname: e.target.value })}
              placeholder="Enter a nickname for this plane"
              className="mt-1 w-full p-1.5 bg-gray-700 border border-gray-600 text-white rounded-md text-sm"
            />
          </div>

          <div className="flex justify-between pt-3">
            <button
              type="button"
              onClick={onDelete}
              className="px-3 py-1.5 text-red-400 hover:text-red-300 text-sm"
            >
              Delete Plane
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit Plane Modal component
const EditPlaneModal = ({ 
  plane, 
  onClose, 
  onSave 
}: { 
  plane: Plane; 
  onClose: () => void; 
  onSave: (updatedPlane: Partial<Plane>) => void;
}) => {
  const [form, setForm] = useState({
    tail_number: plane.tail_number,
    model: plane.model,
    manufacturer: plane.manufacturer
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md">
        <h3 className="text-xl font-bold mb-4 text-white">Edit Plane</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Tail Number
            </label>
            <input
              type="text"
              value={form.tail_number}
              onChange={e => setForm({ ...form, tail_number: e.target.value })}
              className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Model
            </label>
            <input
              type="text"
              value={form.model}
              onChange={e => setForm({ ...form, model: e.target.value })}
              className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Manufacturer
            </label>
            <input
              type="text"
              value={form.manufacturer}
              onChange={e => setForm({ ...form, manufacturer: e.target.value })}
              className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
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
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Trip Card component
const TripCard = ({ 
  trip, 
  onClick, 
  pilots, 
  planes, 
  isHovered,
  onHover 
}: { 
  trip: Trip; 
  onClick: () => void; 
  pilots: Pilot[]; 
  planes: Plane[]; 
  isHovered?: boolean;
  onHover: (tripId: number | null) => void;
}) => {
  const pilot = pilots.find(p => p.id === trip.pilot_id);
  const plane = planes.find(p => p.id === trip.plane_id);
  
  return (
    <div 
      className={`p-3 rounded-lg cursor-pointer transition-all duration-200 mb-2 mx-1 ${
        isHovered 
          ? 'bg-gray-600 ring-2 ring-blue-500 shadow-lg scale-[1.02] z-10' 
          : 'bg-gray-700 hover:bg-gray-600'
      }`}
      onClick={onClick}
      onMouseEnter={() => onHover(trip.id)}
      onMouseLeave={() => onHover(null)}
    >
      <p className="font-medium text-white">
        {trip.departure_airport} → {trip.arrival_airport}
      </p>
      <p className="text-sm text-gray-300">
        {new Date(trip.departure_time).toLocaleDateString()}
      </p>
      <p className="text-sm text-gray-300">
        Status: <span className="capitalize">{trip.status}</span>
      </p>
      {plane && (
        <p className="text-sm text-gray-300">
          Aircraft: {plane.tail_number}
        </p>
      )}
      {pilot && (
        <p className="text-sm text-gray-300">
          Pilot: {pilot.name}
        </p>
      )}
      {trip.estimated_total_cost && (
        <p className="text-sm text-gray-300">
          Est. Cost: ${trip.estimated_total_cost.toLocaleString()}
        </p>
      )}
    </div>
  );
};

// Trip Details Modal component
const TripDetailsModal = ({
  trip,
  planes,
  pilots,
  onClose,
  onUpdate,
  onDelete
}: {
  trip: Trip;
  planes: Plane[];
  pilots: Pilot[];
  onClose: () => void;
  onUpdate: (updatedTrip: Partial<Trip>) => void;
  onDelete: () => void;
}) => {
  const [form, setForm] = useState({
    status: trip.status,
    pilot_id: trip.pilot_id || '',
    plane_id: trip.plane_id,
    departure_time: trip.departure_time?.slice(0, 16) || '',
    estimated_arrival_time: trip.estimated_arrival_time?.slice(0, 16) || '',
    actual_departure_time: trip.actual_departure_time?.slice(0, 16) || '',
    actual_arrival_time: trip.actual_arrival_time?.slice(0, 16) || ''
  });

  const plane = planes.find(p => p.id === trip.plane_id);
  const canDelete = trip.status === 'scheduled';
  const canChangeAircraft = trip.status === 'scheduled';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({
      ...form,
      pilot_id: form.pilot_id ? Number(form.pilot_id) : null,
      plane_id: Number(form.plane_id)
    });
  };

  const handleStatusChange = (newStatus: Trip['status']) => {
    const now = new Date().toISOString().slice(0, 16);
    setForm(prev => ({
      ...prev,
      status: newStatus,
      actual_departure_time: newStatus === 'departed' && !prev.actual_departure_time ? now : prev.actual_departure_time,
      actual_arrival_time: newStatus === 'arrived' && !prev.actual_arrival_time ? now : prev.actual_arrival_time
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-2 z-50">
      <div className="bg-gray-800 p-4 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold text-white">Trip Details</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300">Aircraft</label>
              {canChangeAircraft ? (
                <select
                  value={form.plane_id}
                  onChange={e => setForm({ ...form, plane_id: Number(e.target.value) })}
                  className="mt-1 w-full p-1.5 bg-gray-700 border border-gray-600 text-white rounded-md text-sm"
                >
                  {planes.map(plane => (
                    <option key={plane.id} value={plane.id}>
                      {plane.tail_number} - {plane.nickname || `${plane.manufacturer} ${plane.model}`}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-white text-sm">{plane?.tail_number} - {plane?.nickname || `${plane?.manufacturer} ${plane?.model}`}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300">Route</label>
              <p className="text-white text-sm">{trip.departure_airport} → {trip.arrival_airport}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300">Status</label>
              <select
                value={form.status}
                onChange={e => handleStatusChange(e.target.value as Trip['status'])}
                className="mt-1 w-full p-1.5 bg-gray-700 border border-gray-600 text-white rounded-md text-sm"
              >
                <option value="scheduled">Scheduled</option>
                <option value="departed">Departed</option>
                <option value="arrived">Arrived</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300">Pilot</label>
              <select
                value={form.pilot_id}
                onChange={e => setForm({ ...form, pilot_id: e.target.value })}
                className="mt-1 w-full p-1.5 bg-gray-700 border border-gray-600 text-white rounded-md text-sm"
              >
                <option value="">Select Pilot</option>
                {pilots.map(pilot => (
                  <option key={pilot.id} value={pilot.id}>
                    {pilot.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300">Scheduled Departure</label>
              <input
                type="datetime-local"
                value={form.departure_time}
                onChange={e => setForm({ ...form, departure_time: e.target.value })}
                className="mt-1 w-full p-1.5 bg-gray-700 border border-gray-600 text-white rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300">Est. Arrival</label>
              <input
                type="datetime-local"
                value={form.estimated_arrival_time}
                onChange={e => setForm({ ...form, estimated_arrival_time: e.target.value })}
                className="mt-1 w-full p-1.5 bg-gray-700 border border-gray-600 text-white rounded-md text-sm"
              />
            </div>
          </div>

          {(form.status === 'departed' || form.status === 'arrived') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-300">Actual Departure</label>
                <input
                  type="datetime-local"
                  value={form.actual_departure_time}
                  onChange={e => setForm({ ...form, actual_departure_time: e.target.value })}
                  className="mt-1 w-full p-1.5 bg-gray-700 border border-gray-600 text-white rounded-md text-sm"
                />
              </div>
              {form.status === 'arrived' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300">Actual Arrival</label>
                  <input
                    type="datetime-local"
                    value={form.actual_arrival_time}
                    onChange={e => setForm({ ...form, actual_arrival_time: e.target.value })}
                    className="mt-1 w-full p-1.5 bg-gray-700 border border-gray-600 text-white rounded-md text-sm"
                  />
                </div>
              )}
            </div>
          )}

          {trip.estimated_total_cost && (
            <div>
              <label className="block text-sm font-medium text-gray-300">Est. Cost</label>
              <p className="text-white text-sm">${trip.estimated_total_cost.toLocaleString()}</p>
            </div>
          )}

          <div className="flex justify-between pt-3">
            {canDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="px-3 py-1.5 text-red-400 hover:text-red-300 text-sm"
              >
                Delete Trip
              </button>
            )}
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Add this new component after other modal components
const ConfirmationModal = ({
  title,
  message,
  errorMessage,
  onConfirm,
  onCancel
}: {
  title: string;
  message: string;
  errorMessage?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) => (
  <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
    <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md">
      <h3 className="text-xl font-bold mb-2 text-white">{title}</h3>
      <p className="text-gray-300 mb-6">{message}</p>
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-900/50 border-l-4 border-red-500 text-red-200">
          {errorMessage}
        </div>
      )}
      <div className="flex justify-end space-x-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-300 hover:text-white"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
);

// Add this new component for section headers
const SectionHeader = ({
  title,
  isExpanded,
  onToggle,
  onAdd,
  addDisabled = false
}: {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  onAdd: () => void;
  addDisabled?: boolean;
}) => (
  <div className="flex justify-between items-center mb-4">
    <button
      onClick={onToggle}
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
      <span>{title}</span>
    </button>
    <button
      onClick={onAdd}
      disabled={addDisabled}
      className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
    >
      Add {title.slice(3)}
    </button>
  </div>
);

// Add PilotCard component after TripCard component
const PilotCard = ({ pilot, onClick }: { pilot: Pilot; onClick: () => void }) => (
  <div 
    className="p-3 bg-gray-700 rounded-md hover:bg-gray-600 cursor-pointer transition-colors"
    onClick={onClick}
  >
    <p className="font-medium text-white">{pilot.name}</p>
    <p className="text-sm text-gray-300">License: {pilot.license_number}</p>
    {pilot.rating && (
      <p className="text-sm text-gray-300">Rating: {pilot.rating}</p>
    )}
  </div>
);

// Pilot Details Modal component
const PilotDetailsModal = ({
  pilot,
  onClose,
  onSave,
  onDelete
}: {
  pilot: Pilot;
  onClose: () => void;
  onSave: (updatedPilot: Partial<Pilot>) => void;
  onDelete: () => void;
}) => {
  const [form, setForm] = useState({
    name: pilot.name,
    license_number: pilot.license_number,
    rating: pilot.rating || '',
    total_hours: pilot.total_hours || '',
    contact_number: pilot.contact_number || '',
    email: pilot.email || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedPilot = {
      ...form,
      total_hours: form.total_hours ? Number(form.total_hours) : undefined
    };
    onSave(updatedPilot);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-2 z-50">
      <div className="bg-gray-800 p-4 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold text-white">Pilot Details</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full p-1.5 bg-gray-700 border border-gray-600 text-white rounded-md text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300">License Number</label>
              <input
                type="text"
                value={form.license_number}
                onChange={e => setForm({ ...form, license_number: e.target.value })}
                className="mt-1 w-full p-1.5 bg-gray-700 border border-gray-600 text-white rounded-md text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300">Rating</label>
              <input
                type="text"
                value={form.rating}
                onChange={e => setForm({ ...form, rating: e.target.value })}
                className="mt-1 w-full p-1.5 bg-gray-700 border border-gray-600 text-white rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300">Total Hours</label>
              <input
                type="number"
                value={form.total_hours}
                onChange={e => setForm({ ...form, total_hours: e.target.value ? parseFloat(e.target.value) : '' })}
                className="mt-1 w-full p-1.5 bg-gray-700 border border-gray-600 text-white rounded-md text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300">Contact Number</label>
              <input
                type="tel"
                value={form.contact_number}
                onChange={e => setForm({ ...form, contact_number: e.target.value })}
                className="mt-1 w-full p-1.5 bg-gray-700 border border-gray-600 text-white rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="mt-1 w-full p-1.5 bg-gray-700 border border-gray-600 text-white rounded-md text-sm"
              />
            </div>
          </div>

          <div className="flex justify-between pt-3">
            <button
              type="button"
              onClick={onDelete}
              className="px-3 py-1.5 text-red-400 hover:text-red-300 text-sm"
            >
              Delete Pilot
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Add EditPilotModal component after PilotDetailsModal component
const EditPilotModal = ({
  pilot,
  onClose,
  onSave
}: {
  pilot: Pilot;
  onClose: () => void;
  onSave: (updatedPilot: Partial<Pilot>) => void;
}) => {
  const [form, setForm] = useState({
    name: pilot.name,
    license_number: pilot.license_number,
    rating: pilot.rating || '',
    total_hours: pilot.total_hours || '',
    contact_number: pilot.contact_number || '',
    email: pilot.email || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedPilot = {
      ...form,
      total_hours: form.total_hours ? Number(form.total_hours) : undefined
    };
    onSave(updatedPilot);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-4 text-white">Edit Pilot</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">License Number</label>
            <input
              type="text"
              value={form.license_number}
              onChange={e => setForm({ ...form, license_number: e.target.value })}
              className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Rating</label>
            <input
              type="text"
              value={form.rating}
              onChange={e => setForm({ ...form, rating: e.target.value })}
              className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Total Hours</label>
            <input
              type="number"
              value={form.total_hours}
              onChange={e => setForm({ ...form, total_hours: e.target.value ? parseFloat(e.target.value) : '' })}
              className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Contact Number</label>
            <input
              type="tel"
              value={form.contact_number}
              onChange={e => setForm({ ...form, contact_number: e.target.value })}
              className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md"
            />
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
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AirportInput = ({
  value,
  onChange,
  placeholder,
  label
}: {
  value: string;
  onChange: (value: string, airport?: Airport) => void;
  placeholder: string;
  label: string;
}) => {
  const [suggestions, setSuggestions] = useState<Airport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!value || value.length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        setIsLoading(true);
        const { data } = await axios.get(`/api/airports/search?query=${encodeURIComponent(value)}`);
        setSuggestions(data);
      } catch (error) {
        console.error('Error fetching airport suggestions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [value]);

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-300 mb-1">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        placeholder={placeholder}
        className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
      />
      {showSuggestions && (value.length >= 2) && (
        <div className="absolute z-50 w-full mt-1 bg-gray-700 border border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="p-2 text-gray-400 text-sm">Loading...</div>
          ) : suggestions.length > 0 ? (
            <ul>
              {suggestions.map((airport) => (
                <li
                  key={airport.icao}
                  onClick={() => {
                    onChange(airport.icao, airport);
                    setShowSuggestions(false);
                  }}
                  className="p-2 hover:bg-gray-600 cursor-pointer text-white text-sm"
                >
                  <div className="font-medium">{airport.icao} - {airport.name}</div>
                  <div className="text-gray-400 text-xs">{airport.city}, {airport.country}</div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-2 text-gray-400 text-sm">No airports found</div>
          )}
        </div>
      )}
    </div>
  );
};

// Add these new interfaces after the existing interfaces
interface MapTrip extends Trip {
  coordinates: [number, number][];
  sourceId: string;
  layerId: string;
}

interface MapAirport {
  icao: string;
  coordinates: [number, number];
  name: string;
  city: string;
}

// Add this function to fetch airport data
const fetchAirportData = async (icao: string): Promise<MapAirport | null> => {
  try {
    const { data } = await axios.get(`/api/airports/search?query=${icao}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (data && data.length > 0) {
      const airport = data[0];
      return {
        icao,
        coordinates: airport.coordinates,
        name: airport.name,
        city: airport.city
      };
    }
    return null;
  } catch (error) {
    return null;
  }
};

const Dashboard = () => {
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [planes, setPlanes] = useState<Plane[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [showAddPlane, setShowAddPlane] = useState(false);
  const [showAddTrip, setShowAddTrip] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMap, setIsLoadingMap] = useState(true);
  const [error, setError] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [newPlane, setNewPlane] = useState({
    tail_number: '',
    model: '',
    manufacturer: '',
    nickname: '',
    num_engines: 2,
    num_seats: 20,
    isLocked: false,
    modelLocked: false,
    manufacturerLocked: false,
    enginesLocked: false,
    seatsLocked: false
  });
  const [newTrip, setNewTrip] = useState({
    departure_airport: '',
    arrival_airport: '',
    plane_id: '',
    pilot_id: '',
    departure_time: '',
  });
  const [selectedPlane, setSelectedPlane] = useState<Plane | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [selectedPilot, setSelectedPilot] = useState<Pilot | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showDeleteTripConfirmation, setShowDeleteTripConfirmation] = useState(false);
  const [showDeletePilotConfirmation, setShowDeletePilotConfirmation] = useState(false);
  const [isPlanesExpanded, setIsPlanesExpanded] = useState(true);
  const [isTripsExpanded, setIsTripsExpanded] = useState(true);
  const [isPilotsExpanded, setIsPilotsExpanded] = useState(true);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [showAddPilot, setShowAddPilot] = useState(false);
  const [newPilot, setNewPilot] = useState({
    name: '',
    license_number: '',
    rating: '',
    total_hours: '',
    contact_number: '',
    email: ''
  });
  const [hasWebGLSupport, setHasWebGLSupport] = useState(true);
  const [mapTrips, setMapTrips] = useState<MapTrip[]>([]);
  const [airports, setAirports] = useState<Record<string, MapAirport>>({});
  const [hoveredTripId, setHoveredTripId] = useState<number | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Check for token before any data fetching
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/', { replace: true });
      return;
    }

    // Set up axios default headers
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        await Promise.all([
          fetchPlanes(),
          fetchTrips(),
          fetchPilots()
        ]);
        
        setIsLoading(false);
      } catch (error) {
        setIsLoading(false);
        setError('Failed to fetch data. Please try again.');
      }
    };

    fetchData();
  }, [navigate]);

  // Add a useEffect to check if the Mapbox token is being loaded correctly
  useEffect(() => {
    // Check if the Mapbox token is available
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    console.log('Mapbox token available:', !!token);
    if (!token) {
      console.error('Mapbox token is missing in environment variables');
      setError('Mapbox token is missing. Please check your .env file.');
      setHasWebGLSupport(false);
    }
  }, []);

  // Update the initializeMap function to ensure proper loading
  const initializeMap = async () => {
    if (!mapContainer.current) return;
    
    try {
      setIsLoadingMap(true);
      
      // Get the token directly
      const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
      if (!MAPBOX_TOKEN) {
        throw new Error('Mapbox token is missing');
      }
      
      // Remove console.log statement
      mapboxgl.accessToken = MAPBOX_TOKEN;
      
      // Create the map with 3D globe view
      const newMap = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [-95.7129, 37.0902],
        zoom: 2,
        projection: 'globe' // Use globe projection for 3D view
      });
      
      // Set the map reference
      map.current = newMap;
      
      // Add event listeners
      newMap.on('load', () => {
        // Remove console.log statement
        
        // Add atmosphere and stars for 3D globe effect
        newMap.setFog({
          color: 'rgb(4, 6, 22)', // night sky
          'high-color': 'rgb(36, 92, 223)', // blue atmosphere
          'horizon-blend': 0.4,
          'space-color': 'rgb(0, 0, 10)', // dark space
          'star-intensity': 0.6 // stars in the night sky
        });
        
        setIsInitialized(true);
        setMapLoaded(true);
        setIsLoadingMap(false);
        
        // Wait a moment before updating trips to ensure the map is fully rendered
        setTimeout(() => {
          updateMapTrips();
        }, 500);
      });
      
      newMap.on('error', (e) => {
        // Remove console.log statement
        setIsLoadingMap(false);
        setError('Error loading map: ' + (e.error?.message || 'Unknown error'));
      });
    } catch (error: any) {
      // Remove console.log statement
      setHasWebGLSupport(false);
      setIsLoadingMap(false);
      setError(error.message || 'Error initializing map');
    }
  };

  // Update the updateMapTrips function to ensure proper rendering
  const updateMapTrips = async () => {
    if (!map.current || !map.current.loaded()) {
      // Remove console.log statement
      return;
    }
    
    // Remove console.log statement
    
    try {
      // Clear existing markers
      markers.current.forEach(marker => marker.remove());
      markers.current = [];

      // Remove existing layers and sources
      mapTrips.forEach(trip => {
        try {
          if (map.current?.getLayer(trip.layerId)) {
            map.current.removeLayer(trip.layerId);
          }
          if (map.current?.getSource(trip.sourceId)) {
            map.current.removeSource(trip.sourceId);
          }
        } catch (error) {
          // Remove console.log statement
        }
      });

      // Get trips that should be displayed
      const tripsToDisplay = trips.filter(trip => 
        trip.status === 'scheduled' || trip.status === 'departed'
      );
      
      // Remove console.log statement
      
      if (tripsToDisplay.length === 0) {
        // Remove console.log statement
        setMapTrips([]);
        return;
      }

      // Fetch airport coordinates for all unique airports
      const uniqueAirports = new Set(
        tripsToDisplay.flatMap(trip => [trip.departure_airport, trip.arrival_airport])
      );
      
      // Remove console.log statement
      
      const newAirports: Record<string, MapAirport> = { ...airports };
      
      // Fetch airport data for each unique airport
      for (const icao of uniqueAirports) {
        if (airports[icao]) continue;
        
        const airportData = await fetchAirportData(icao);
        if (airportData) {
          newAirports[icao] = airportData;
        }
      }
      
      // Remove console.log statement
      setAirports(newAirports);

      // Create new map trips with coordinates
      const newMapTrips = tripsToDisplay
        .map(trip => {
          const departureAirport = newAirports[trip.departure_airport];
          const arrivalAirport = newAirports[trip.arrival_airport];
          
          if (!departureAirport || !arrivalAirport) {
            // Remove console.log statement
            return null;
          }

          return {
            ...trip,
            coordinates: [departureAirport.coordinates, arrivalAirport.coordinates],
            sourceId: `route-source-${trip.id}`,
            layerId: `route-layer-${trip.id}`
          };
        })
        .filter((trip): trip is MapTrip => trip !== null);
      
      // Remove console.log statement
      setMapTrips(newMapTrips);

      if (newMapTrips.length === 0) {
        // Remove console.log statement
        return;
      }

      // Add airport markers first
      const airportsToShow = new Set<string>();
      newMapTrips.forEach(trip => {
        airportsToShow.add(trip.departure_airport);
        airportsToShow.add(trip.arrival_airport);
      });

      // Add airport markers
      Array.from(airportsToShow).forEach(icaoCode => {
        const airport = newAirports[icaoCode];
        if (!airport) return;
        
        try {
          // Remove console.log statement
          
          // Create a custom HTML element for the marker
          const el = document.createElement('div');
          el.className = 'airport-marker';
          el.style.width = '14px';
          el.style.height = '14px';
          el.style.borderRadius = '50%';
          el.style.backgroundColor = '#ffffff';
          el.style.border = '3px solid #374151';
          el.style.boxShadow = '0 0 5px rgba(0, 0, 0, 0.5)';
          
          // Create the marker
          const marker = new mapboxgl.Marker(el)
            .setLngLat(airport.coordinates)
            .setPopup(
              new mapboxgl.Popup({ offset: 25 })
                .setHTML(`
                  <div>
                    <div style="font-weight: bold;">${airport.icao}</div>
                    <div>${airport.name}</div>
                    <div style="color: #9CA3AF;">${airport.city}</div>
                  </div>
                `)
            )
            .addTo(map.current!);

          markers.current.push(marker);
        } catch (error) {
          // Remove console.log statement
        }
      });

      // Then add route lines
      newMapTrips.forEach(trip => {
        try {
          // Remove console.log statement
          
          // Check if source already exists and remove it
          if (map.current?.getSource(trip.sourceId)) {
            try {
              if (map.current?.getLayer(trip.layerId)) {
                map.current.removeLayer(trip.layerId);
              }
              map.current.removeSource(trip.sourceId);
              // Remove console.log statement
            } catch (error) {
              // Remove console.log statement
            }
          }
          
          // Add the route source
          map.current?.addSource(trip.sourceId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {
                tripId: trip.id,
                status: trip.status,
                hover: hoveredTripId === trip.id
              },
              geometry: {
                type: 'LineString',
                coordinates: trip.coordinates
              }
            }
          });

          // Add the route layer
          map.current?.addLayer({
            id: trip.layerId,
            type: 'line',
            source: trip.sourceId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': trip.status === 'scheduled' ? '#3b82f6' : '#22c55e',
              'line-width': [
                'case',
                ['boolean', ['==', ['get', 'hover'], true], false],
                8, // Width for hovered state
                3  // Width for default state
              ],
              'line-opacity': [
                'case',
                ['boolean', ['==', ['get', 'hover'], true], false],
                0.8, // Opacity for hovered state
                0.6  // Opacity for default state
              ]
            }
          });

          // Add hover effect
          map.current?.on('mouseenter', trip.layerId, () => {
            if (map.current) map.current.getCanvas().style.cursor = 'pointer';
            setHoveredTripId(trip.id);
          });

          map.current?.on('mouseleave', trip.layerId, () => {
            if (map.current) map.current.getCanvas().style.cursor = '';
            setHoveredTripId(null);
          });
        } catch (error) {
          // Remove console.log statement
        }
      });

      // Fit the map to show all routes
      if (newMapTrips.length > 0) {
        try {
          const bounds = new mapboxgl.LngLatBounds();
          newMapTrips.forEach(trip => {
            trip.coordinates.forEach(coord => {
              bounds.extend(coord as mapboxgl.LngLatLike);
            });
          });
          
          // Remove console.log statement
          map.current.fitBounds(bounds, { padding: 50 });
        } catch (error) {
          // Remove console.log statement
        }
      }
    } catch (error) {
      // Remove console.log statement
    }
  };

  // Fix the duplicate useEffect calls
  useEffect(() => {
    if (mapLoaded && map.current && trips.length > 0) {
      // Remove console.log statement
      updateMapTrips();
    }
  }, [mapLoaded, trips.length]);

  // Update the useEffect for hoveredTripId
  useEffect(() => {
    if (!map.current || !isInitialized) return;
    
    // Update the appearance of all trip routes based on hover state
    mapTrips.forEach(trip => {
      try {
        const source = map.current?.getSource(trip.sourceId) as mapboxgl.GeoJSONSource;
        if (source) {
          source.setData({
            type: 'Feature',
            properties: {
              tripId: trip.id,
              status: trip.status,
              hover: hoveredTripId === trip.id
            },
            geometry: {
              type: 'LineString',
              coordinates: trip.coordinates
            }
          });
        }
      } catch (error) {
        // Remove console.log statement
      }
    });
  }, [hoveredTripId, mapTrips]);

  const fetchPlanes = async () => {
    try {
      const { data } = await axios.get('/api/planes', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setPlanes(data);
      return data;
    } catch (error: any) {
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
      const { data } = await axios.get('/api/trips', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setTrips(data);
      return data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Error fetching trips';
      setError(errorMessage);
      if (error.response?.status === 401) {
        navigate('/');
      }
      throw error;
    }
  };

  const fetchPilots = async () => {
    try {
      const { data } = await axios.get('/api/pilots', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setPilots(data);
      return data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Error fetching pilots';
      setError(errorMessage);
      if (error.response?.status === 401) {
        navigate('/');
      }
      throw error;
    }
  };

  const handleAddPlane = async () => {
    try {
      setError('');
      
      if (!newPlane.tail_number || !newPlane.model || !newPlane.manufacturer) {
        setError('Please fill in all required fields');
        return;
      }
      
      const { data } = await axios.post('/api/planes', {
        tail_number: newPlane.tail_number,
        model: newPlane.model,
        manufacturer: newPlane.manufacturer,
        nickname: newPlane.nickname,
        num_engines: newPlane.num_engines,
        num_seats: newPlane.num_seats
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      setPlanes([...planes, data]);
      setShowAddPlane(false);
      setNewPlane({
        tail_number: '',
        model: '',
        manufacturer: '',
        nickname: '',
        num_engines: 2,
        num_seats: 20,
        isLocked: false,
        modelLocked: false,
        manufacturerLocked: false,
        enginesLocked: false,
        seatsLocked: false
      });
    } catch (error: any) {
      setError(error.response?.data?.error || 'Error adding plane');
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
        pilot_id: '',
        departure_time: ''
      });
      fetchTrips();
    } catch (error: any) {
      console.error('Error adding trip:', error);
      alert(error.response?.data?.error || 'Error adding trip');
    }
  };

  const handleLogout = () => {
    // Remove token and authorization header
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    
    // Navigate to login page without using the navigate hook
    window.location.href = '/';
  };

  const handleUpdatePlane = async (updatedPlane: Partial<Plane>) => {
    try {
      if (!selectedPlane) return;
      
      setError(''); // Clear any existing errors
      if (!updatedPlane.tail_number || !updatedPlane.model || !updatedPlane.manufacturer) {
        setError('Tail number, model, and manufacturer are required');
        return;
      }

      const { data } = await axios.put(
        `/api/planes/${selectedPlane.id}`,
        updatedPlane,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }
      );
      
      // Update the planes list with the updated plane
      setPlanes(planes.map(p => p.id === selectedPlane.id ? data : p));
      setSelectedPlane(null);
      setError(''); // Clear any existing errors
    } catch (error: any) {
      console.error('Error updating plane:', error);
      setError(error.response?.data?.error || 'Error updating plane');
      // Don't close the modal on error so user can try again
    }
  };

  const handleDeletePlane = async () => {
    try {
      if (!selectedPlane) return;
      
      console.log('Selected plane:', selectedPlane);
      console.log('All trips:', trips);
      
      // Check if the plane is on any departed or arrived trips
      const activeTrips = trips.filter(trip => 
        trip.plane_id === selectedPlane.id && 
        (trip.status === 'departed' || trip.status === 'arrived')
      );

      console.log('Active trips for selected plane:', activeTrips);

      if (activeTrips.length > 0) {
        setError('Cannot delete plane as it is assigned to trips that have already departed or arrived');
        setShowDeleteConfirmation(true);
        return;
      }
      
      await axios.delete(
        `/api/planes/${selectedPlane.id}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }
      );
      
      setShowDeleteConfirmation(false);
      setSelectedPlane(null);
      fetchPlanes();
    } catch (error: any) {
      console.error('Error deleting plane:', error);
      setError(error.response?.data?.error || 'Error deleting plane');
    }
  };

  const handleUpdateTrip = async (updatedTrip: Partial<Trip>) => {
    try {
      if (!selectedTrip) return;
      
      await axios.put(
        `/api/trips/${selectedTrip.id}`,
        updatedTrip,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }
      );
      
      setSelectedTrip(null);
      fetchTrips();
    } catch (error: any) {
      console.error('Error updating trip:', error);
      setError(error.response?.data?.error || 'Error updating trip');
    }
  };

  const handleDeleteTrip = async () => {
    try {
      if (!selectedTrip) return;
      
      await axios.delete(
        `/api/trips/${selectedTrip.id}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }
      );
      
      setShowDeleteTripConfirmation(false);
      setSelectedTrip(null);
      fetchTrips();
    } catch (error: any) {
      console.error('Error deleting trip:', error);
      setError(error.response?.data?.error || 'Error deleting trip');
    }
  };

  const handleAddPilot = async () => {
    try {
      await axios.post(
        '/api/pilots',
        newPilot,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }
      );
      setShowAddPilot(false);
      setNewPilot({
        name: '',
        license_number: '',
        rating: '',
        total_hours: '',
        contact_number: '',
        email: ''
      });
      fetchPilots();
    } catch (error: any) {
      console.error('Error adding pilot:', error);
      alert(error.response?.data?.error || 'Error adding pilot');
    }
  };

  const handleUpdatePilot = async (updatedPilot: Partial<Pilot>) => {
    try {
      if (!selectedPilot) return;
      
      await axios.put(
        `/api/pilots/${selectedPilot.id}`,
        updatedPilot,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }
      );
      
      setSelectedPilot(null);
      fetchPilots();
    } catch (error: any) {
      console.error('Error updating pilot:', error);
      setError(error.response?.data?.error || 'Error updating pilot');
    }
  };

  const handleDeletePilot = async () => {
    try {
      if (!selectedPilot) return;
      
      await axios.delete(
        `/api/pilots/${selectedPilot.id}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }
      );
      
      setShowDeletePilotConfirmation(false);
      setSelectedPilot(null);
      fetchPilots();
    } catch (error: any) {
      console.error('Error deleting pilot:', error);
      setError(error.response?.data?.error || 'Error deleting pilot');
    }
  };

  // Add this useEffect to initialize the map
  useEffect(() => {
    if (!mapContainer.current || map.current || isLoading) {
      console.log('Skipping map initialization:', {
        hasContainer: !!mapContainer.current,
        mapAlreadyExists: !!map.current,
        isLoading
      });
      return;
    }
    
    initializeMap();
    
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [isLoading]);

  // Update the aircraft lookup in the Add Plane Modal section
  const handleAircraftLookup = async () => {
    try {
      setError('');
      if (!newPlane.tail_number) {
        setError('Please enter a tail number');
        return;
      }
      
      const response = await axios.get(
        `https://prod.api.market/api/v1/aedbx/aerodatabox/aircrafts/Reg/${newPlane.tail_number}`,
        {
          headers: {
            'x-magicapi-key': import.meta.env.VITE_MAGICAPI_KEY
          }
        }
      );
      
      if (response.data) {
        // Split productionLine into manufacturer and model
        const productionLine = response.data.productionLine || '';
        const [manufacturer, ...modelParts] = productionLine.split(' ');
        const model = modelParts.join(' ') || response.data.modelCode || response.data.model || '';

        // Only lock the fields if we actually get values from the API
        const hasEngines = typeof response.data.numEngines === 'number';
        const hasSeats = typeof response.data.numSeats === 'number';
        const hasManufacturer = manufacturer && manufacturer.trim() !== '';
        const hasModel = model && model.trim() !== '';

        setNewPlane(prev => ({
          ...prev,
          model: hasModel ? model : prev.model,
          manufacturer: hasManufacturer ? manufacturer : prev.manufacturer,
          num_engines: hasEngines ? response.data.numEngines : prev.num_engines,
          num_seats: hasSeats ? response.data.numSeats : prev.num_seats,
          isLocked: false, // Don't lock the entire form
          modelLocked: hasModel, // Only lock model if we have a value
          manufacturerLocked: hasManufacturer, // Only lock manufacturer if we have a value
          enginesLocked: hasEngines,
          seatsLocked: hasSeats
        }));
      } else {
        setError('No aircraft data found for this tail number');
      }
    } catch (error) {
      console.error('Error looking up aircraft:', error);
      setError('Error looking up aircraft. Please try again.');
      setNewPlane(prev => ({
        ...prev,
        isLocked: false,
        modelLocked: false,
        manufacturerLocked: false,
        enginesLocked: false,
        seatsLocked: false
      }));
    }
  };

  if (isLoading) {
    return <Loading message="Loading Data..." />;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex justify-between items-center">
          <h1 className="text-xl font-bold text-white">GoChart</h1>
          <button
            onClick={handleLogout}
            className="px-3 py-1 text-sm font-medium text-gray-300 hover:text-white"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Map */}
        <div className="flex-1 relative">
          {isLoadingMap && <Loading message="Loading map..." />}
          {!hasWebGLSupport && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 text-white p-4 z-40">
              <div className="max-w-md text-center">
                <h2 className="text-xl font-bold mb-2">WebGL Not Supported</h2>
                <p>{error || getWebGLErrorMessage()}</p>
              </div>
            </div>
          )}
          <div 
            ref={mapContainer} 
            className="w-full h-full" 
            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
          />
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
            <SectionHeader
              title="My Planes"
              isExpanded={isPlanesExpanded}
              onToggle={() => setIsPlanesExpanded(!isPlanesExpanded)}
              onAdd={() => setShowAddPlane(true)}
            />
            <div className={`space-y-2 overflow-hidden transition-all duration-200 ease-in-out ${
              isPlanesExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
            }`}>
              {planes.map(plane => (
                <PlaneCard 
                  key={plane.id} 
                  plane={plane} 
                  onClick={() => setSelectedPlane(plane)}
                />
              ))}
              {planes.length === 0 && (
                <p className="text-gray-400 text-center py-4">No planes added yet</p>
              )}
            </div>
          </div>

          {/* Trips Section */}
          <div className="p-4">
            <SectionHeader
              title="My Trips"
              isExpanded={isTripsExpanded}
              onToggle={() => setIsTripsExpanded(!isTripsExpanded)}
              onAdd={() => setShowAddTrip(true)}
              addDisabled={planes.length === 0}
            />
            <div className={`space-y-2 overflow-hidden transition-all duration-200 ease-in-out ${
              isTripsExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
            }`}>
              {trips.map(trip => (
                <TripCard 
                  key={trip.id} 
                  trip={trip}
                  pilots={pilots}
                  planes={planes}
                  onClick={() => setSelectedTrip(trip)}
                  isHovered={hoveredTripId === trip.id}
                  onHover={setHoveredTripId}
                />
              ))}
              {trips.length === 0 && (
                <p className="text-gray-400 text-center py-4">No trips scheduled</p>
              )}
            </div>
          </div>

          {/* Pilots Section */}
          <div className="p-4 border-t border-gray-700">
            <SectionHeader
              title="My Pilots"
              isExpanded={isPilotsExpanded}
              onToggle={() => setIsPilotsExpanded(!isPilotsExpanded)}
              onAdd={() => setShowAddPilot(true)}
            />
            <div className={`space-y-2 overflow-hidden transition-all duration-200 ease-in-out ${
              isPilotsExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
            }`}>
              {pilots.map(pilot => (
                <PilotCard
                  key={pilot.id}
                  pilot={pilot}
                  onClick={() => setSelectedPilot(pilot)}
                />
              ))}
              {pilots.length === 0 && (
                <p className="text-gray-400 text-center py-4">No pilots added yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {selectedPlane && (
        <PlaneDetailsModal
          plane={selectedPlane}
          onClose={() => {
            setSelectedPlane(null);
            setError(''); // Clear error when closing the modal
          }}
          onSave={handleUpdatePlane}
          onDelete={() => setShowDeleteConfirmation(true)}
        />
      )}

      {selectedPilot && (
        <PilotDetailsModal
          pilot={selectedPilot}
          onClose={() => setSelectedPilot(null)}
          onSave={handleUpdatePilot}
          onDelete={() => setShowDeletePilotConfirmation(true)}
        />
      )}

      {showDeleteConfirmation && selectedPlane && (
        <ConfirmationModal
          title="Delete Plane"
          message={`Are you sure you want to delete ${selectedPlane.tail_number}? This action cannot be undone.`}
          errorMessage={error}
          onConfirm={handleDeletePlane}
          onCancel={() => setShowDeleteConfirmation(false)}
        />
      )}

      {/* Add Plane Modal */}
      {showAddPlane && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-white">Add New Plane</h3>
            {error && (
              <div className="mb-4 p-3 bg-red-900/50 border-l-4 border-red-500 text-red-200">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Tail Number
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="N12345"
                    className="flex-1 p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                    value={newPlane.tail_number}
                    onChange={e => setNewPlane({ ...newPlane, tail_number: e.target.value.toUpperCase() })}
                  />
                  <button
                    onClick={handleAircraftLookup}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  >
                    Lookup
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Model
                </label>
                <input
                  type="text"
                  placeholder="Citation CJ4"
                  className={`w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 ${newPlane.modelLocked ? 'opacity-75 cursor-not-allowed' : ''}`}
                  value={newPlane.model}
                  onChange={e => setNewPlane({ ...newPlane, model: e.target.value })}
                  disabled={newPlane.modelLocked}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Manufacturer
                </label>
                <input
                  type="text"
                  placeholder="Cessna"
                  className={`w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 ${newPlane.manufacturerLocked ? 'opacity-75 cursor-not-allowed' : ''}`}
                  value={newPlane.manufacturer}
                  onChange={e => setNewPlane({ ...newPlane, manufacturer: e.target.value })}
                  disabled={newPlane.manufacturerLocked}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Number of Engines
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    className={`w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${newPlane.enginesLocked ? 'opacity-75 cursor-not-allowed' : ''}`}
                    value={newPlane.num_engines}
                    onChange={e => setNewPlane({ ...newPlane, num_engines: parseInt(e.target.value) || 2 })}
                    disabled={newPlane.enginesLocked}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Number of Seats
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    className={`w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${newPlane.seatsLocked ? 'opacity-75 cursor-not-allowed' : ''}`}
                    value={newPlane.num_seats}
                    onChange={e => setNewPlane({ ...newPlane, num_seats: parseInt(e.target.value) || 20 })}
                    disabled={newPlane.seatsLocked}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Nickname (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Enter a nickname"
                  className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={newPlane.nickname}
                  onChange={e => setNewPlane({ ...newPlane, nickname: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setNewPlane({ 
                    tail_number: '',
                    model: '',
                    manufacturer: '',
                    nickname: '',
                    num_engines: 2,
                    num_seats: 20,
                    isLocked: false,
                    modelLocked: false,
                    manufacturerLocked: false,
                    enginesLocked: false,
                    seatsLocked: false
                  });
                  setShowAddPlane(false);
                  setError(''); // Clear error when closing
                }}
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
              <AirportInput
                value={newTrip.departure_airport}
                onChange={(value) => setNewTrip({ ...newTrip, departure_airport: value })}
                placeholder="KJFK"
                label="Departure Airport (ICAO)"
              />
              <AirportInput
                value={newTrip.arrival_airport}
                onChange={(value) => setNewTrip({ ...newTrip, arrival_airport: value })}
                placeholder="KLAX"
                label="Arrival Airport (ICAO)"
              />
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
                  className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={newTrip.pilot_id}
                  onChange={e => setNewTrip({ ...newTrip, pilot_id: e.target.value })}
                >
                  <option value="" className="text-gray-400">Select Pilot</option>
                  {pilots.map(pilot => (
                    <option key={pilot.id} value={pilot.id}>
                      {pilot.name} - {pilot.license_number}
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

      {/* Trip Modals */}
      {selectedTrip && (
        <TripDetailsModal
          trip={selectedTrip}
          planes={planes}
          pilots={pilots}
          onClose={() => setSelectedTrip(null)}
          onUpdate={handleUpdateTrip}
          onDelete={() => setShowDeleteTripConfirmation(true)}
        />
      )}

      {showDeleteTripConfirmation && selectedTrip && (
        <ConfirmationModal
          title="Delete Trip"
          message={`Are you sure you want to delete the trip from ${selectedTrip.departure_airport} to ${selectedTrip.arrival_airport}? This action cannot be undone.`}
          onConfirm={handleDeleteTrip}
          onCancel={() => setShowDeleteTripConfirmation(false)}
        />
      )}

      {/* Add Pilot Modal */}
      {showAddPilot && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md">
            <h3 className="text-xl font-bold mb-3 text-white">Add New Pilot</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  placeholder="John Doe"
                  className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                  value={newPilot.name}
                  onChange={e => setNewPilot({ ...newPilot, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  License Number
                </label>
                <input
                  type="text"
                  placeholder="ATP123456"
                  className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                  value={newPilot.license_number}
                  onChange={e => setNewPilot({ ...newPilot, license_number: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Rating
                </label>
                <input
                  type="text"
                  placeholder="ATP"
                  className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                  value={newPilot.rating}
                  onChange={e => setNewPilot({ ...newPilot, rating: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Contact Number
                </label>
                <input
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                  value={newPilot.contact_number}
                  onChange={e => setNewPilot({ ...newPilot, contact_number: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="pilot@example.com"
                  className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                  value={newPilot.email}
                  onChange={e => setNewPilot({ ...newPilot, email: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={() => setShowAddPilot(false)}
                className="px-4 py-2 text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPilot}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Add Pilot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard; 