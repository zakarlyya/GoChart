import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import axios from 'axios';

// Types
export interface MapAirport {
  icao: string;
  coordinates: [number, number];
  name: string;
  city: string;
  country?: string;
}

export interface MapTrip {
  id: number;
  plane_id: number;
  departure_airport: string;
  arrival_airport: string;
  status: 'scheduled' | 'departed' | 'arrived';
  coordinates: [number, number][];
  sourceId: string;
  layerId: string;
}

interface MapComponentProps {
  trips: any[];
  selectedPlaneId: number | null;
  hoveredTripId: number | null;
  onTripHover: (tripId: number | null) => void;
  onTripClick?: (tripId: number) => void;
  mapboxToken: string;
}

// Add this at the top of the file
declare global {
  interface Window {
    mapInstance?: any;
    updateTripRouteColor?: (tripId: number, newStatus: string) => void;
    removeTripFromMap?: (tripId: number) => void;
  }
}

/**
 * Utility function to check WebGL support and return error message if not supported
 */
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

/**
 * Fetch airport data from the API
 */
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
        city: airport.city,
        country: airport.country
      };
    }
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Map Component for displaying trips on a 3D globe
 */
const MapComponent: React.FC<MapComponentProps> = ({
  trips,
  selectedPlaneId,
  hoveredTripId,
  onTripHover,
  onTripClick,
  mapboxToken
}) => {
  // Refs
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  
  // State
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isLoadingMap, setIsLoadingMap] = useState<boolean>(false);
  const [hasWebGLSupport, setHasWebGLSupport] = useState<boolean>(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [airports, setAirports] = useState<Record<string, MapAirport>>({});
  const [mapTrips, setMapTrips] = useState<MapTrip[]>([]);

  /**
   * Initialize the map with 3D globe view
   */
  const initializeMap = async () => {
    if (!mapContainer.current || map.current) return;
    
    try {
      setIsLoadingMap(true);
      
      if (!mapboxToken) {
        throw new Error('Mapbox token is missing');
      }
      
      mapboxgl.accessToken = mapboxToken;
      
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
      
      // Store map instance in window for external access
      window.mapInstance = map.current;
      
      // Add event listeners
      newMap.on('load', () => {
        // Add atmosphere and stars for 3D globe effect
        newMap.setFog({
          color: 'rgb(4, 6, 22)', // night sky
          'high-color': 'rgb(36, 92, 223)', // blue atmosphere
          'horizon-blend': 0.4,
          'space-color': 'rgb(0, 0, 10)', // dark space
          'star-intensity': 0.6 // stars in the night sky
        });
        
        setIsInitialized(true);
        setIsLoadingMap(false);
        
        // Add a slight delay before adding trip routes to ensure map is fully loaded
        setTimeout(() => {
          updateMapTrips();
        }, 500);
      });
      
      newMap.on('error', (e) => {
        setIsLoadingMap(false);
        setMapError('Error loading map: ' + (e.error?.message || 'Unknown error'));
      });
    } catch (error: any) {
      setHasWebGLSupport(false);
      setIsLoadingMap(false);
      setMapError(error.message || 'Error initializing map');
    }
  };

  /**
   * Update the map with trip routes and airport markers
   */
  const updateMapTrips = async () => {
    if (!map.current || !map.current.loaded()) {
      return;
    }
    
    try {
      // Clear existing markers
      markers.current.forEach(marker => marker.remove());
      markers.current = [];

      // Get current trip IDs
      const currentTripIds = trips.map(trip => trip.id);

      // Remove layers and sources for trips that no longer exist
      mapTrips.forEach(trip => {
        if (!currentTripIds.includes(trip.id)) {
          try {
            if (map.current?.getLayer(trip.layerId)) {
              map.current.removeLayer(trip.layerId);
            }
            if (map.current?.getSource(trip.sourceId)) {
              map.current.removeSource(trip.sourceId);
            }
          } catch (error) {
            // Ignore errors when removing layers/sources
          }
        }
      });

      // Remove existing layers and sources for trips that will be updated
      mapTrips.forEach(trip => {
        try {
          if (map.current?.getLayer(trip.layerId)) {
            map.current.removeLayer(trip.layerId);
          }
          if (map.current?.getSource(trip.sourceId)) {
            map.current.removeSource(trip.sourceId);
          }
        } catch (error) {
          // Ignore errors when removing layers/sources
        }
      });

      // Get trips that should be displayed
      const tripsToDisplay = selectedPlaneId
        ? trips.filter(trip => trip.plane_id === selectedPlaneId && (trip.status === 'scheduled' || trip.status === 'departed'))
        : trips.filter(trip => trip.status === 'scheduled' || trip.status === 'departed');
      
      if (tripsToDisplay.length === 0) {
        setMapTrips([]);
        return;
      }

      // Fetch airport coordinates for all unique airports
      const uniqueAirports = new Set(
        tripsToDisplay.flatMap(trip => [trip.departure_airport, trip.arrival_airport])
      );
      
      const newAirports: Record<string, MapAirport> = { ...airports };
      
      // Fetch airport data for each unique airport
      for (const icao of uniqueAirports) {
        if (airports[icao]) continue;
        
        const airportData = await fetchAirportData(icao);
        if (airportData) {
          newAirports[icao] = airportData;
        }
      }
      
      setAirports(newAirports);

      // Create new map trips with coordinates
      const newMapTrips = tripsToDisplay
        .map(trip => {
          const departureAirport = newAirports[trip.departure_airport];
          const arrivalAirport = newAirports[trip.arrival_airport];
          
          if (!departureAirport || !arrivalAirport) {
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
      
      setMapTrips(newMapTrips);

      if (newMapTrips.length === 0) {
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
                    <div style="color: #9CA3AF;">${airport.city}${airport.country ? `, ${airport.country}` : ''}</div>
                  </div>
                `)
            )
            .addTo(map.current!);

          markers.current.push(marker);
        } catch (error) {
          // Ignore errors when adding markers
        }
      });

      // Then add route lines
      newMapTrips.forEach(trip => {
        try {
          // Check if source already exists and remove it
          if (map.current?.getSource(trip.sourceId)) {
            try {
              if (map.current?.getLayer(trip.layerId)) {
                map.current.removeLayer(trip.layerId);
              }
              map.current.removeSource(trip.sourceId);
            } catch (error) {
              // Ignore errors when removing existing sources
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
              'line-color': [
                'match',
                ['get', 'status'],
                'scheduled', '#3b82f6', // Blue for scheduled
                'departed', '#f59e0b',  // Amber for departed
                'arrived', '#22c55e',   // Green for arrived
                '#3b82f6' // Default blue
              ],
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
            onTripHover(trip.id);
          });

          map.current?.on('mouseleave', trip.layerId, () => {
            if (map.current) map.current.getCanvas().style.cursor = '';
            onTripHover(null);
          });

          // Add click handler if provided
          if (onTripClick) {
            map.current?.on('click', trip.layerId, () => {
              onTripClick(trip.id);
            });
          }
        } catch (error) {
          // Ignore errors when adding routes
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
          
          map.current.fitBounds(bounds, { padding: 50 });
        } catch (error) {
          // Ignore errors when fitting bounds
        }
      }
    } catch (error) {
      // Ignore general errors in updateMapTrips
    }
  };

  // Initialize map on component mount
  useEffect(() => {
    initializeMap();
    
    // Cleanup function
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapboxToken]);

  // Update map when trips or selected plane changes
  useEffect(() => {
    if (mapLoaded && map.current) {
      updateMapTrips();
    }
  }, [mapLoaded, trips, selectedPlaneId]);

  // Update trip hover state
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
        // Ignore errors when updating hover state
      }
    });
  }, [hoveredTripId, mapTrips, isInitialized]);

  // Force rebuild map when trip statuses change
  useEffect(() => {
    if (map.current && map.current.loaded()) {
      // Remove all existing layers and sources
      mapTrips.forEach(trip => {
        try {
          if (map.current?.getLayer(trip.layerId)) {
            map.current.removeLayer(trip.layerId);
          }
          if (map.current?.getSource(trip.sourceId)) {
            map.current.removeSource(trip.sourceId);
          }
        } catch (error) {
          // Ignore errors when removing layers/sources
        }
      });
      
      // Clear the mapTrips state to force a complete rebuild
      setMapTrips([]);
      
      // Rebuild the map with updated trip data
      updateMapTrips();
    }
  }, [JSON.stringify(trips.map(t => ({ id: t.id, status: t.status })))]);

  // Update the map when trips are added or removed
  useEffect(() => {
    if (map.current && map.current.loaded()) {
      // Check if any trips were removed
      const currentTripIds = trips.map(trip => trip.id);
      const removedTrips = mapTrips.filter(trip => !currentTripIds.includes(trip.id));
      
      // Remove layers and sources for removed trips
      removedTrips.forEach(trip => {
        try {
          if (map.current?.getLayer(trip.layerId)) {
            map.current.removeLayer(trip.layerId);
          }
          if (map.current?.getSource(trip.sourceId)) {
            map.current.removeSource(trip.sourceId);
          }
        } catch (error) {
          // Ignore errors when removing layers/sources
        }
      });
      
      // If trips were added or removed, update the map
      if (trips.length !== mapTrips.length || removedTrips.length > 0) {
        updateMapTrips();
      }
    }
  }, [trips.length]);

  // Render loading state
  if (isLoadingMap) {
    return (
      <div className="relative w-full h-full min-h-[400px] bg-gray-800 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-300">Loading map...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (mapError || !hasWebGLSupport) {
    return (
      <div className="w-full h-full min-h-[400px] bg-gray-800 rounded-lg flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-xl font-semibold text-white mb-2">Map Error</h3>
          <p className="text-gray-300">{mapError || getWebGLErrorMessage()}</p>
        </div>
      </div>
    );
  }

  // Render map
  return (
    <div 
      ref={mapContainer} 
      className="w-full h-full min-h-[400px] bg-gray-800 rounded-lg"
    />
  );
};

// Add this at the top level of the file, outside the component
// This will allow direct access to update trip colors from outside the component
if (typeof window !== 'undefined') {
  window.updateTripRouteColor = (tripId: number, newStatus: string) => {
    if (!window.mapInstance) return;
    
    const map = window.mapInstance;
    const sourceId = `route-source-${tripId}`;
    const layerId = `route-layer-${tripId}`;
    
    try {
      // Get the source
      const source = map.getSource(sourceId);
      if (source && 'setData' in source) {
        // Get the current data
        const currentData = (source as any)._data;
        if (currentData) {
          // Update the status in the properties
          const newData = {
            ...currentData,
            properties: {
              ...currentData.properties,
              status: newStatus
            }
          };
          
          // Set the updated data
          source.setData(newData);
        }
      }
      
      // Force redraw by triggering a resize event
      window.dispatchEvent(new Event('resize'));
    } catch (error) {
      console.error('Error updating trip route color:', error);
    }
  };
  
  // Add method to remove a trip from the map
  window.removeTripFromMap = (tripId: number) => {
    if (!window.mapInstance) return;
    
    const map = window.mapInstance;
    const sourceId = `route-source-${tripId}`;
    const layerId = `route-layer-${tripId}`;
    
    try {
      // Remove the layer and source
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
      
      // Force redraw by triggering a resize event
      window.dispatchEvent(new Event('resize'));
    } catch (error) {
      console.error('Error removing trip from map:', error);
    }
  };
}

export default MapComponent; 