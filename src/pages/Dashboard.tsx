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
  }
}

// Types
interface Plane {
  id: number;
  tail_number: string;
  model: string;
  manufacturer: string;
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

// Updated Plane Card component
const PlaneCard = ({ plane, onClick }: { plane: Plane; onClick: () => void }) => (
  <div 
    className="p-3 bg-gray-700 rounded-md hover:bg-gray-600 cursor-pointer transition-colors"
    onClick={onClick}
  >
    <p className="font-medium text-white">{plane.tail_number}</p>
    <p className="text-sm text-gray-300">
      {plane.manufacturer} {plane.model}
    </p>
  </div>
);

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
    manufacturer: plane.manufacturer
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
const TripCard = ({ trip, onClick, pilots, planes }: { 
  trip: Trip; 
  onClick: () => void;
  pilots: Pilot[];
  planes: Plane[];
}) => {
  const pilot = pilots.find(p => p.id === trip.pilot_id);
  const plane = planes.find(p => p.id === trip.plane_id);
  
  return (
    <div 
      className="p-3 bg-gray-700 rounded-md hover:bg-gray-600 cursor-pointer transition-colors"
      onClick={onClick}
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
    departure_time: trip.departure_time?.slice(0, 16) || '',
    estimated_arrival_time: trip.estimated_arrival_time?.slice(0, 16) || '',
    actual_departure_time: trip.actual_departure_time?.slice(0, 16) || '',
    actual_arrival_time: trip.actual_arrival_time?.slice(0, 16) || ''
  });

  const plane = planes.find(p => p.id === trip.plane_id);
  const canDelete = trip.status === 'scheduled';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({
      ...form,
      pilot_id: form.pilot_id ? Number(form.pilot_id) : null
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
              <p className="text-white text-sm">{plane?.tail_number}</p>
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

          {form.status === 'scheduled' && (
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
          )}

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
  onConfirm,
  onCancel
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) => (
  <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
    <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md">
      <h3 className="text-xl font-bold mb-2 text-white">{title}</h3>
      <p className="text-gray-300 mb-6">{message}</p>
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
    manufacturer: ''
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
        const [planesData, tripsData, pilotsData] = await Promise.all([
          fetchPlanes(),
          fetchTrips(),
          fetchPilots()
        ]);
        console.log('Data fetched successfully:', {
          planes: planesData,
          trips: tripsData,
          pilots: pilotsData
        });
      } catch (error) {
        console.error('Error fetching data:', error);
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          handleLogout();
          return;
        }
        setError(error instanceof Error ? error.message : 'Error fetching data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  // Initialize map after data is loaded
  useEffect(() => {
    if (!mapContainer.current || map.current || isLoading) {
      return;
    }

    const initializeMap = async () => {
      try {
        setIsLoadingMap(true);
        
        if (!MAPBOX_TOKEN) {
          throw new Error('Mapbox token is not set in environment variables');
        }

        mapboxgl.accessToken = MAPBOX_TOKEN;
        const mapInstance = new mapboxgl.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: [-98.5795, 39.8283],
          zoom: 3
        });

        map.current = mapInstance;

        mapInstance.on('load', () => {
          console.log('Map loaded successfully');
          setIsInitialized(true);
          setIsLoadingMap(false);
        });

        mapInstance.on('error', (e) => {
          console.error('Mapbox error:', e);
          setError('Error loading map: ' + (e.error?.message || 'Unknown error'));
          setIsInitialized(true);
          setIsLoadingMap(false);
        });

      } catch (error) {
        console.error('Error initializing map:', error);
        setError(error instanceof Error ? error.message : 'Error initializing map');
        setIsLoadingMap(false);
      }
    };

    initializeMap();

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [isLoading]); // Only depend on isLoading state

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

  const fetchPilots = async () => {
    try {
      console.log('Fetching pilots...');
      const { data } = await axios.get('/api/pilots', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      console.log('Pilots fetched:', data);
      setPilots(data);
      return data;
    } catch (error: any) {
      console.error('Error fetching pilots:', error);
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
    
    // Navigate to login page
    navigate('/', { replace: true });
  };

  const handleUpdatePlane = async (updatedPlane: Partial<Plane>) => {
    try {
      if (!selectedPlane) return;
      
      await axios.put(
        `/api/planes/${selectedPlane.id}`,
        updatedPlane,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }
      );
      
      setSelectedPlane(null);
      fetchPlanes();
    } catch (error: any) {
      console.error('Error updating plane:', error);
      setError(error.response?.data?.error || 'Error updating plane');
    }
  };

  const handleDeletePlane = async () => {
    try {
      if (!selectedPlane) return;
      
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

  if (isLoading) {
    return <Loading message="Loading Data..." />;
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
        <div ref={mapContainer} className="flex-1 relative">
          {isLoadingMap && <LoadingOverlay />}
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
          onClose={() => setSelectedPlane(null)}
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
          onConfirm={handleDeletePlane}
          onCancel={() => setShowDeleteConfirmation(false)}
        />
      )}

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