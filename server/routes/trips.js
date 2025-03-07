const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../auth');

// Import airports data
let airports = [];

/**
 * Set airports data from the main server
 * @param {Array} airportsData - Array of airport objects
 */
const setAirports = (airportsData) => {
  airports = airportsData;
};

/**
 * Calculate great circle distance between two points
 * @param {number} lat1 - Latitude of first point in degrees
 * @param {number} lon1 - Longitude of first point in degrees
 * @param {number} lat2 - Latitude of second point in degrees
 * @param {number} lon2 - Longitude of second point in degrees
 * @returns {number} Distance in nautical miles
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3440.065; // Earth's radius in nautical miles
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
           Math.cos(φ1) * Math.cos(φ2) *
           Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in nautical miles
}

/**
 * Calculate estimated trip cost
 * @param {string} departure_airport - ICAO code of departure airport
 * @param {string} arrival_airport - ICAO code of arrival airport
 * @param {number} num_engines - Number of engines on the aircraft
 * @returns {Object} Object containing estimated fuel and total costs
 */
async function calculateTripCost(departure_airport, arrival_airport, num_engines) {
  try {
    if (!num_engines || num_engines < 1) {
      throw new Error('Invalid number of engines');
    }

    // Get coordinates from the airports array directly
    const depAirport = airports.find(a => a.icao === departure_airport);
    const arrAirport = airports.find(a => a.icao === arrival_airport);

    if (!depAirport || !arrAirport) {
      throw new Error('Could not find airport coordinates');
    }

    // Calculate distance
    const distance = calculateDistance(
      depAirport.lat, depAirport.lon,
      arrAirport.lat, arrAirport.lon
    );

    // Calculate fuel needed: 220 * number of engines / 500 * trip distance
    const fuelNeeded = (220 * num_engines / 500) * distance;
    
    // Calculate fuel cost: fuel needed * $6 per gallon
    const fuelCost = fuelNeeded * 6;
    
    // Calculate total cost: fuel cost * 1.25 for additional expenses
    const totalCost = Math.round(fuelCost * 1.25);

    return {
      estimated_fuel_cost: Math.round(fuelCost),
      estimated_total_cost: totalCost
    };
  } catch (error) {
    console.error('Error calculating trip cost:', error);
    throw error;
  }
}

/**
 * Format date for database storage
 * @param {string|Date} date - Date to format
 * @returns {string|null} ISO string or null if invalid
 */
const formatDate = (date) => {
  if (!date) return null;
  return new Date(date).toISOString();
};

/**
 * Get plane by ID for a specific user
 * @param {number} planeId - ID of the plane
 * @param {number} userId - ID of the user
 * @returns {Promise<Object>} Plane object
 */
const getPlaneById = (planeId, userId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM planes WHERE id = ? AND user_id = ?', [planeId, userId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

/**
 * Get trip by ID for a specific user
 * @param {number} tripId - ID of the trip
 * @param {number} userId - ID of the user
 * @returns {Promise<Object>} Trip object
 */
const getTripById = (tripId, userId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM trips WHERE id = ? AND user_id = ?', [tripId, userId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

/**
 * Insert a new trip into the database
 * @param {Object} tripData - Trip data to insert
 * @returns {Promise<Object>} Created trip object
 */
const insertTrip = (tripData) => {
  const { 
    user_id, departure_airport, arrival_airport, plane_id, pilot_id,
    departure_time, estimated_arrival_time, status, estimated_fuel_cost, estimated_total_cost 
  } = tripData;
  
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO trips (
      user_id, departure_airport, arrival_airport, plane_id, pilot_id,
      departure_time, estimated_arrival_time, status, estimated_fuel_cost, estimated_total_cost
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
      user_id,
      departure_airport,
      arrival_airport,
      plane_id,
      pilot_id || null,
      departure_time,
      estimated_arrival_time,
      status || 'scheduled',
      estimated_fuel_cost,
      estimated_total_cost
    ];

    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
        return;
      }
      
      db.get('SELECT * FROM trips WHERE id = ?', [this.lastID], (err, trip) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(trip);
      });
    });
  });
};

/**
 * Update an existing trip
 * @param {number} tripId - ID of the trip to update
 * @param {number} userId - ID of the user
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated trip object
 */
const updateTrip = (tripId, userId, updateData) => {
  return new Promise((resolve, reject) => {
    const { updateFields, updateParams } = updateData;
    
    // Add WHERE clause parameters
    updateParams.push(tripId);
    updateParams.push(userId);

    const updateQuery = `UPDATE trips SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`;

    db.run(updateQuery, updateParams, function(err) {
      if (err) {
        reject(err);
        return;
      }
      
      db.get('SELECT * FROM trips WHERE id = ?', [tripId], (err, trip) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(trip);
      });
    });
  });
};

// Get all trips
router.get('/', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM trips WHERE user_id = ? ORDER BY departure_time',
    [req.user.id],
    (err, trips) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      res.json(trips);
    }
  );
});

// Create a new trip
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { departure_airport, arrival_airport, plane_id, pilot_id, departure_time } = req.body;
    const user_id = req.user.id;

    // Validate required fields
    if (!departure_airport || !arrival_airport || !plane_id || !departure_time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get the plane details for cost calculation
    const plane = await getPlaneById(plane_id, user_id);

    if (!plane) {
      return res.status(404).json({ error: 'Plane not found' });
    }

    // Calculate estimated cost
    let costs;
    try {
      costs = await calculateTripCost(departure_airport, arrival_airport, plane.num_engines);
    } catch (error) {
      console.error('Error in cost calculation:', error);
      return res.status(400).json({ error: 'Could not calculate trip cost: ' + error.message });
    }

    // Calculate estimated arrival time (2 hours after departure)
    const departure = new Date(departure_time);
    const estimated_arrival = new Date(departure.getTime() + (2 * 60 * 60 * 1000));

    // Insert the new trip
    const tripData = {
      user_id,
      departure_airport,
      arrival_airport,
      plane_id,
      pilot_id,
      departure_time,
      estimated_arrival_time: estimated_arrival.toISOString(),
      status: 'scheduled',
      estimated_fuel_cost: costs.estimated_fuel_cost,
      estimated_total_cost: costs.estimated_total_cost
    };

    const trip = await insertTrip(tripData);
    res.status(201).json(trip);
  } catch (error) {
    console.error('Error creating trip:', error);
    res.status(500).json({ error: 'Error creating trip: ' + error.message });
  }
});

// Update trip
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const trip_id = req.params.id;

    // Get the existing trip first
    const existingTrip = await getTripById(trip_id, user_id);

    if (!existingTrip) {
      return res.status(404).json({ error: 'Trip not found or unauthorized' });
    }

    // Merge existing data with updates
    const updates = {
      departure_airport: req.body.departure_airport || existingTrip.departure_airport,
      arrival_airport: req.body.arrival_airport || existingTrip.arrival_airport,
      plane_id: req.body.plane_id || existingTrip.plane_id,
      pilot_id: 'pilot_id' in req.body ? req.body.pilot_id : existingTrip.pilot_id,
      departure_time: req.body.departure_time || existingTrip.departure_time,
      status: req.body.status || existingTrip.status,
      estimated_arrival_time: req.body.estimated_arrival_time || existingTrip.estimated_arrival_time,
      actual_departure_time: req.body.actual_departure_time || existingTrip.actual_departure_time,
      actual_arrival_time: req.body.actual_arrival_time || existingTrip.actual_arrival_time
    };

    // Get plane details to get number of engines
    const plane = await getPlaneById(updates.plane_id, user_id);

    if (!plane) {
      return res.status(404).json({ error: 'Plane not found' });
    }

    // Recalculate costs if airports or plane changed
    let costs = {
      estimated_fuel_cost: existingTrip.estimated_fuel_cost,
      estimated_total_cost: existingTrip.estimated_total_cost
    };

    if (
      updates.departure_airport !== existingTrip.departure_airport ||
      updates.arrival_airport !== existingTrip.arrival_airport ||
      updates.plane_id !== existingTrip.plane_id
    ) {
      try {
        costs = await calculateTripCost(updates.departure_airport, updates.arrival_airport, plane.num_engines);
      } catch (error) {
        console.error('Error recalculating trip cost:', error);
        return res.status(400).json({ error: 'Could not recalculate trip cost: ' + error.message });
      }
    }

    // Build the update query
    const updateFields = [];
    const updateParams = [];

    // Add all fields to update
    updateFields.push('departure_airport = ?');
    updateParams.push(updates.departure_airport);

    updateFields.push('arrival_airport = ?');
    updateParams.push(updates.arrival_airport);

    updateFields.push('plane_id = ?');
    updateParams.push(updates.plane_id);

    updateFields.push('pilot_id = ?');
    updateParams.push(updates.pilot_id);

    updateFields.push('departure_time = ?');
    updateParams.push(updates.departure_time);

    updateFields.push('estimated_arrival_time = ?');
    updateParams.push(updates.estimated_arrival_time);

    updateFields.push('status = ?');
    updateParams.push(updates.status);

    updateFields.push('estimated_fuel_cost = ?');
    updateParams.push(costs.estimated_fuel_cost);

    updateFields.push('estimated_total_cost = ?');
    updateParams.push(costs.estimated_total_cost);

    // Handle actual times based on status
    if (updates.status === 'departed' && !updates.actual_departure_time) {
      updateFields.push('actual_departure_time = ?');
      updateParams.push(formatDate(new Date()));
    } else {
      updateFields.push('actual_departure_time = ?');
      updateParams.push(updates.actual_departure_time);
    }

    if (updates.status === 'arrived' && !updates.actual_arrival_time) {
      updateFields.push('actual_arrival_time = ?');
      updateParams.push(formatDate(new Date()));
    } else {
      updateFields.push('actual_arrival_time = ?');
      updateParams.push(updates.actual_arrival_time);
    }

    // Update the trip
    const updateData = { updateFields, updateParams };
    const updatedTrip = await updateTrip(trip_id, user_id, updateData);
    res.json(updatedTrip);
  } catch (error) {
    console.error('Error updating trip:', error);
    res.status(500).json({ error: 'Error updating trip: ' + error.message });
  }
});

// Delete trip
router.delete('/:id', authenticateToken, (req, res) => {
  const tripId = req.params.id;
  
  // Only allow deletion of scheduled trips
  db.get(
    'SELECT * FROM trips WHERE id = ? AND user_id = ? AND status = "scheduled"',
    [tripId, req.user.id],
    (err, trip) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!trip) return res.status(404).json({ error: 'Trip not found or cannot be deleted' });

      // Delete the trip
      db.run(
        'DELETE FROM trips WHERE id = ? AND user_id = ?',
        [tripId, req.user.id],
        (err) => {
          if (err) return res.status(500).json({ error: 'Error deleting trip' });
          res.json({ message: 'Trip deleted successfully' });
        }
      );
    }
  );
});

module.exports = { router, setAirports }; 