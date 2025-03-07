import React, { useState } from 'react';
import { Pilot } from '../../types';
import Modal from '../shared/Modal';
import api from '../../services/api';

interface PilotListProps {
  pilots: Pilot[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRefreshData: () => Promise<void>;
}

/**
 * Component for displaying and managing pilots
 */
export const PilotList: React.FC<PilotListProps> = ({
  pilots,
  isExpanded,
  onToggleExpand,
  onRefreshData
}) => {
  const [showAddPilot, setShowAddPilot] = useState(false);
  const [selectedPilot, setSelectedPilot] = useState<Pilot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  const handleAddPilot = async (pilot: Omit<Pilot, 'id'>) => {
    try {
      await api.pilots.create(pilot);
      setShowAddPilot(false);
      onRefreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error adding pilot');
    }
  };

  const handleUpdatePilot = async (updates: Partial<Pilot>) => {
    try {
      if (!selectedPilot) return;
      await api.pilots.update(selectedPilot.id, updates);
      setSelectedPilot(null);
      onRefreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating pilot');
    }
  };

  const handleDeletePilot = async () => {
    try {
      if (!selectedPilot) return;
      await api.pilots.delete(selectedPilot.id);
      setSelectedPilot(null);
      setShowDeleteConfirmation(false);
      onRefreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting pilot');
    }
  };

  const PilotForm = ({ pilot, onSubmit, onClose }: {
    pilot?: Pilot;
    onSubmit: (pilot: Omit<Pilot, 'id'>) => Promise<void>;
    onClose: () => void;
  }) => {
    const [formData, setFormData] = useState<Omit<Pilot, 'id'>>({
      name: pilot?.name || '',
      license_number: pilot?.license_number || '',
      rating: pilot?.rating || '',
      total_hours: pilot?.total_hours || 0,
      contact_number: pilot?.contact_number || '',
      email: pilot?.email || ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      await onSubmit(formData);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value, type } = e.target;
      setFormData(prev => ({
        ...prev,
        [name]: type === 'number' ? (value ? parseInt(value, 10) : 0) : value
      }));
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              License Number
            </label>
            <input
              type="text"
              name="license_number"
              value={formData.license_number}
              onChange={handleChange}
              className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Rating
            </label>
            <input
              type="text"
              name="rating"
              value={formData.rating}
              onChange={handleChange}
              className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Total Hours
            </label>
            <input
              type="number"
              name="total_hours"
              value={formData.total_hours || ''}
              onChange={handleChange}
              className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Contact Number
            </label>
            <input
              type="tel"
              name="contact_number"
              value={formData.contact_number}
              onChange={handleChange}
              className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-md"
            />
          </div>
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
            {pilot ? 'Update Pilot' : 'Add Pilot'}
          </button>
        </div>
      </form>
    );
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
          <span>My Pilots</span>
        </button>
        <button
          onClick={() => setShowAddPilot(true)}
          className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 text-sm"
        >
          Add Pilot
        </button>
      </div>

      {/* Pilots list */}
      {isExpanded && (
        <div className="space-y-2">
          {pilots.map(pilot => (
            <div
              key={pilot.id}
              className="p-3 bg-gray-700 rounded-md hover:bg-gray-600 cursor-pointer transition-colors"
              onClick={() => setSelectedPilot(pilot)}
            >
              <p className="font-medium text-white">{pilot.name}</p>
              <p className="text-sm text-gray-300">License: {pilot.license_number}</p>
              {pilot.rating && (
                <p className="text-sm text-gray-300">Rating: {pilot.rating}</p>
              )}
            </div>
          ))}
          {pilots.length === 0 && (
            <p className="text-gray-400 text-center py-4">No pilots added yet</p>
          )}
        </div>
      )}

      {/* Add pilot modal */}
      <Modal
        isOpen={showAddPilot}
        onClose={() => setShowAddPilot(false)}
        title="Add New Pilot"
      >
        <PilotForm
          onSubmit={handleAddPilot}
          onClose={() => setShowAddPilot(false)}
        />
      </Modal>

      {/* Edit pilot modal */}
      {selectedPilot && !showDeleteConfirmation && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedPilot(null)}
          title="Pilot Details"
        >
          {isEditing ? (
            <PilotForm
              pilot={selectedPilot}
              onSubmit={handleUpdatePilot}
              onClose={() => setIsEditing(false)}
            />
          ) : (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Pilot Details</h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirmation(true)}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setSelectedPilot(null)}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-gray-400 text-sm">Name</h3>
                  <p className="text-white text-lg">{selectedPilot.name}</p>
                </div>

                <div>
                  <h3 className="text-gray-400 text-sm">License Number</h3>
                  <p className="text-white text-lg">{selectedPilot.license_number}</p>
                </div>

                {selectedPilot.rating && (
                  <div>
                    <h3 className="text-gray-400 text-sm">Rating</h3>
                    <p className="text-white text-lg">{selectedPilot.rating}</p>
                  </div>
                )}

                {selectedPilot.total_hours !== undefined && (
                  <div>
                    <h3 className="text-gray-400 text-sm">Total Hours</h3>
                    <p className="text-white text-lg">{selectedPilot.total_hours}</p>
                  </div>
                )}

                {selectedPilot.contact_number && (
                  <div>
                    <h3 className="text-gray-400 text-sm">Contact Number</h3>
                    <p className="text-white text-lg">{selectedPilot.contact_number}</p>
                  </div>
                )}

                {selectedPilot.email && (
                  <div>
                    <h3 className="text-gray-400 text-sm">Email</h3>
                    <p className="text-white text-lg">{selectedPilot.email}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirmation && selectedPilot && (
        <Modal
          isOpen={true}
          onClose={() => setShowDeleteConfirmation(false)}
          title="Delete Pilot"
        >
          <div className="p-6">
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete {selectedPilot.name}? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowDeleteConfirmation(false)}
                className="px-4 py-2 text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePilot}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete Pilot
              </button>
            </div>
          </div>
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