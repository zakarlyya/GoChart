import React, { useState } from 'react';
import { Plane } from '../../types';

interface PlaneDetailsComponentProps {
  plane: Plane;
  onClose: () => void;
  onSave: (updatedPlane: Omit<Plane, 'id'>) => void;
  onDelete: () => void;
}

const PlaneDetailsComponent: React.FC<PlaneDetailsComponentProps> = ({
  plane,
  onClose,
  onSave,
  onDelete
}) => {
  const [formData, setFormData] = useState<Omit<Plane, 'id'>>({
    tail_number: plane.tail_number,
    model: plane.model,
    manufacturer: plane.manufacturer,
    nickname: plane.nickname,
    num_engines: plane.num_engines,
    num_seats: plane.num_seats,
    isLocked: plane.isLocked,
    modelLocked: plane.modelLocked,
    manufacturerLocked: plane.manufacturerLocked,
    enginesLocked: plane.enginesLocked,
    seatsLocked: plane.seatsLocked
  });
  
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value, 10) || 0 : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setIsEditing(false);
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">
            {isEditing ? 'Edit Aircraft' : 'Aircraft Details'}
          </h2>
          <div className="flex space-x-2">
            {!isEditing && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  Edit
                </button>
                <button
                  onClick={onDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                >
                  Delete
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
            >
              {isEditing ? 'Cancel' : 'Close'}
            </button>
          </div>
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-300 mb-2">Tail Number</label>
                <input
                  type="text"
                  name="tail_number"
                  value={formData.tail_number}
                  onChange={handleChange}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded"
                  disabled={formData.isLocked}
                  required
                />
              </div>
              
              <div>
                <label className="block text-gray-300 mb-2">Nickname</label>
                <input
                  type="text"
                  name="nickname"
                  value={formData.nickname || ''}
                  onChange={handleChange}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded"
                />
              </div>
              
              <div>
                <label className="block text-gray-300 mb-2">Model</label>
                <input
                  type="text"
                  name="model"
                  value={formData.model}
                  onChange={handleChange}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded"
                  disabled={formData.modelLocked}
                  required
                />
              </div>
              
              <div>
                <label className="block text-gray-300 mb-2">Manufacturer</label>
                <input
                  type="text"
                  name="manufacturer"
                  value={formData.manufacturer}
                  onChange={handleChange}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded"
                  disabled={formData.manufacturerLocked}
                  required
                />
              </div>
              
              <div>
                <label className="block text-gray-300 mb-2">Number of Engines</label>
                <input
                  type="number"
                  name="num_engines"
                  value={formData.num_engines}
                  onChange={handleChange}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded"
                  disabled={formData.enginesLocked}
                  min="1"
                  required
                />
              </div>
              
              <div>
                <label className="block text-gray-300 mb-2">Number of Seats</label>
                <input
                  type="number"
                  name="num_seats"
                  value={formData.num_seats}
                  onChange={handleChange}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded"
                  disabled={formData.seatsLocked}
                  min="1"
                  required
                />
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
              >
                Save Changes
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-gray-400 text-sm">Tail Number</h3>
              <p className="text-white text-lg">{plane.tail_number}</p>
            </div>
            
            {plane.nickname && (
              <div>
                <h3 className="text-gray-400 text-sm">Nickname</h3>
                <p className="text-white text-lg">{plane.nickname}</p>
              </div>
            )}
            
            <div>
              <h3 className="text-gray-400 text-sm">Model</h3>
              <p className="text-white text-lg">{plane.model}</p>
            </div>
            
            <div>
              <h3 className="text-gray-400 text-sm">Manufacturer</h3>
              <p className="text-white text-lg">{plane.manufacturer}</p>
            </div>
            
            <div>
              <h3 className="text-gray-400 text-sm">Number of Engines</h3>
              <p className="text-white text-lg">{plane.num_engines}</p>
            </div>
            
            <div>
              <h3 className="text-gray-400 text-sm">Number of Seats</h3>
              <p className="text-white text-lg">{plane.num_seats}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlaneDetailsComponent; 