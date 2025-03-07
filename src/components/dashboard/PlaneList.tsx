import React, { useState } from 'react';
import { Plane } from '../../types';
import Modal from '../shared/Modal';
import PlaneDetailsComponent from '../planes/PlaneDetailsComponent';
import api from '../../services/api';

interface PlaneListProps {
  planes: Plane[];
  selectedPlaneId: number | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onPlaneSelect: (planeId: number | null) => void;
  onRefreshData: () => Promise<void>;
}

/**
 * Component for displaying and managing planes
 */
export const PlaneList: React.FC<PlaneListProps> = ({
  planes,
  selectedPlaneId,
  isExpanded,
  onToggleExpand,
  onPlaneSelect,
  onRefreshData
}) => {
  const [showAddPlane, setShowAddPlane] = useState(false);
  const [selectedPlane, setSelectedPlane] = useState<Plane | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAddPlane = async (plane: Omit<Plane, 'id'>) => {
    try {
      await api.planes.create(plane);
      setShowAddPlane(false);
      onRefreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error adding plane');
    }
  };

  const handleUpdatePlane = async (updates: Omit<Plane, 'id'>) => {
    try {
      if (!selectedPlane) return;
      await api.planes.update(selectedPlane.id, updates);
      setSelectedPlane(null);
      onRefreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating plane');
    }
  };

  const handleDeletePlane = async () => {
    try {
      if (!selectedPlane) return;
      await api.planes.delete(selectedPlane.id);
      setSelectedPlane(null);
      onRefreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting plane');
    }
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
          <span>My Planes</span>
        </button>
        <button
          onClick={() => setShowAddPlane(true)}
          className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 text-sm"
        >
          Add Plane
        </button>
      </div>

      {/* Planes list */}
      {isExpanded && (
        <div className="space-y-2">
          {planes.map(plane => (
            <div
              key={plane.id}
              className={`p-3 rounded-md cursor-pointer transition-colors ${
                selectedPlaneId === plane.id ? 'bg-gray-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
              onClick={() => {
                if (selectedPlaneId === plane.id) {
                  onPlaneSelect(null);
                } else {
                  onPlaneSelect(plane.id);
                }
              }}
              onDoubleClick={() => setSelectedPlane(plane)}
            >
              <p className="font-medium text-white">{plane.tail_number}</p>
              <p className="text-sm text-gray-300">
                {plane.nickname || `${plane.manufacturer} ${plane.model}`}
              </p>
            </div>
          ))}
          {planes.length === 0 && (
            <p className="text-gray-400 text-center py-4">No planes added yet</p>
          )}
        </div>
      )}

      {/* Add plane modal */}
      <Modal
        isOpen={showAddPlane}
        onClose={() => setShowAddPlane(false)}
        title="Add New Plane"
      >
        <PlaneDetailsComponent
          plane={{
            id: 0,
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
          }}
          onClose={() => setShowAddPlane(false)}
          onSave={handleAddPlane}
          onDelete={() => {}}
        />
      </Modal>

      {/* Edit plane modal */}
      {selectedPlane && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedPlane(null)}
          title="Edit Plane"
        >
          <PlaneDetailsComponent
            plane={selectedPlane}
            onClose={() => setSelectedPlane(null)}
            onSave={handleUpdatePlane}
            onDelete={handleDeletePlane}
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