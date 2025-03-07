import React, { useState } from 'react';
import { Plane, Trip, Pilot } from '../../types';
import { PlaneList } from './PlaneList';
import { TripList } from './TripList';
import { PilotList } from './PilotList';

interface SidePanelProps {
  planes: Plane[];
  trips: Trip[];
  pilots: Pilot[];
  selectedPlaneId: number | null;
  hoveredTripId: number | null;
  error: string | null;
  onPlaneSelect: (planeId: number | null) => void;
  onTripHover: (tripId: number | null) => void;
  onRefreshData: () => Promise<void>;
}

/**
 * Side panel component containing planes, trips, and pilots lists
 */
export const SidePanel: React.FC<SidePanelProps> = ({
  planes,
  trips,
  pilots,
  selectedPlaneId,
  hoveredTripId,
  error,
  onPlaneSelect,
  onTripHover,
  onRefreshData
}) => {
  // Section expansion state
  const [isPlanesExpanded, setIsPlanesExpanded] = useState(true);
  const [isTripsExpanded, setIsTripsExpanded] = useState(true);
  const [isPilotsExpanded, setIsPilotsExpanded] = useState(true);

  return (
    <div className="w-96 bg-gray-800 shadow-xl overflow-y-auto border-l border-gray-700">
      {/* Error display */}
      {error && (
        <div className="p-4 bg-red-900/50 border-l-4 border-red-500 text-red-200">
          {error}
        </div>
      )}

      {/* Planes section */}
      <div className="p-4 border-b border-gray-700">
        <PlaneList
          planes={planes}
          selectedPlaneId={selectedPlaneId}
          isExpanded={isPlanesExpanded}
          onToggleExpand={() => setIsPlanesExpanded(!isPlanesExpanded)}
          onPlaneSelect={onPlaneSelect}
          onRefreshData={onRefreshData}
        />
      </div>

      {/* Trips section */}
      <div className="p-4">
        <TripList
          trips={trips}
          pilots={pilots}
          planes={planes}
          isExpanded={isTripsExpanded}
          hoveredTripId={hoveredTripId}
          onToggleExpand={() => setIsTripsExpanded(!isTripsExpanded)}
          onTripHover={onTripHover}
          onRefreshData={onRefreshData}
        />
      </div>

      {/* Pilots section */}
      <div className="p-4 border-t border-gray-700">
        <PilotList
          pilots={pilots}
          isExpanded={isPilotsExpanded}
          onToggleExpand={() => setIsPilotsExpanded(!isPilotsExpanded)}
          onRefreshData={onRefreshData}
        />
      </div>
    </div>
  );
}; 