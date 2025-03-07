const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../auth');

// Import airports data
let airports = [];

// Function to set airports data from the main server
const setAirports = (airportsData) => {
  airports = airportsData;
};

// Function to calculate great circle distance between two points
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

// Function to calculate estimated trip cost
async function calculateTripCost(departure_airport, arrival_airport, num_engines) {
  try {
    console.log('Calculating cost for:', {
      departure_airport,
      arrival_airport,
      num_engines,
      airportsAvailable: airports.length
    });

    if (!num_engines || num_engines < 1) {
      throw new Error('Invalid number of engines');
    }

    // Get coordinates from the airports array directly
    const depAirport = airports.find(a => a.icao === departure_airport);
    const arrAirport = airports.find(a => a.icao === arrival_airport);

    if (!depAirport || !arrAirport) {
      console.error('Could not find airport coordinates for:', {
        departure: departure_airport,
        arrival: arrival_airport,
        depFound: !!depAirport,
        arrFound: !!arrAirport
      });
      throw new Error('Could not find airport coordinates');
    }

    // Calculate distance
    const distance = calculateDistance(
      depAirport.lat, depAirport.lon,
      arrAirport.lat, arrAirport.lon
    );

    console.log('Trip cost calculation:', {
      distance,
      num_engines,
      airports: {
        departure: { icao: depAirport.icao, lat: depAirport.lat, lon: depAirport.lon },
        arrival: { icao: arrAirport.icao, lat: arrAirport.lat, lon: arrAirport.lon }
      }
    });

    // Calculate fuel needed: 220 * number of engines / 500 * trip distance
    const fuelNeeded = (220 * num_engines / 500) * distance;
    
    // Calculate fuel cost: fuel needed * $6 per gallon
    const fuelCost = fuelNeeded * 6;
    
    // Calculate total cost: fuel cost * 1.25 for additional expenses
    const totalCost = Math.round(fuelCost * 1.25);

    console.log('Cost breakdown:', {
      distance,
      num_engines,
      fuelNeeded,
      fuelCost,
      totalCost
    });

    return {
      estimated_fuel_cost: Math.round(fuelCost),
      estimated_total_cost: totalCost
    };
  } catch (error) {
    console.error('Error calculating trip cost:', error);
    throw error;
  }
}

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

    console.log('Creating new trip:', {
      departure_airport,
      arrival_airport,
      plane_id,
      pilot_id,
      departure_time,
      user_id
    });

    // Validate required fields
    if (!departure_airport || !arrival_airport || !plane_id || !departure_time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get the plane details for cost calculation
    const plane = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM planes WHERE id = ? AND user_id = ?', [plane_id, user_id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!plane) {
      return res.status(404).json({ error: 'Plane not found' });
    }

    console.log('Found plane:', plane);

    // Calculate estimated cost
    let costs;
    try {
      costs = await calculateTripCost(departure_airport, arrival_airport, plane.num_engines);
      console.log('Calculated trip costs:', costs);
    } catch (error) {
      console.error('Error in cost calculation:', error);
      return res.status(400).json({ error: 'Could not calculate trip cost: ' + error.message });
    }

    // Calculate estimated arrival time (2 hours after departure)
    const departure = new Date(departure_time);
    const estimated_arrival = new Date(departure.getTime() + (2 * 60 * 60 * 1000));

    // Insert the new trip
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
      estimated_arrival.toISOString(),
      'scheduled',
      costs.estimated_fuel_cost,
      costs.estimated_total_cost
    ];

    console.log('Inserting trip with params:', params);

    db.run(sql, params, function(err) {
      if (err) {
        console.error('Error inserting trip:', err);
        return res.status(500).json({ error: 'Error creating trip: ' + err.message });
      }

      // Fetch and return the newly created trip
      db.get('SELECT * FROM trips WHERE id = ?', [this.lastID], (err, trip) => {
        if (err) {
          console.error('Error fetching new trip:', err);
          return res.status(500).json({ error: 'Error fetching new trip' });
        }
        console.log('Created trip:', trip);
        res.status(201).json(trip);
      });
    });
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

    console.log('Updating trip:', {
      tripId: trip_id,
      userId: user_id,
      updates: req.body
    });

    // Get the existing trip first
    const existingTrip = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM trips WHERE id = ? AND user_id = ?', [trip_id, user_id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

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

    console.log('Merged updates:', updates);

    // Get plane details to get number of engines
    const plane = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM planes WHERE id = ? AND user_id = ?', [updates.plane_id, user_id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!plane) {
      return res.status(404).json({ error: 'Plane not found or unauthorized' });
    }

    console.log('Found plane for trip update:', plane);

    // Calculate estimated cost
    const costs = await calculateTripCost(updates.departure_airport, updates.arrival_airport, plane.num_engines);
    console.log('Calculated new costs for trip:', costs);

    // Format dates
    const formatDate = (date) => {
      if (!date) return null;
      try {
        return new Date(date).toISOString();
      } catch (error) {
        console.error('Invalid date:', date);
        return null;
      }
    };

    const sql = `UPDATE trips 
                 SET departure_airport = ?, 
                     arrival_airport = ?, 
                     plane_id = ?, 
                     pilot_id = ?,
                     departure_time = ?,
                     estimated_arrival_time = ?,
                     actual_departure_time = ?,
                     actual_arrival_time = ?,
                     status = ?, 
                     estimated_fuel_cost = ?, 
                     estimated_total_cost = ?
                 WHERE id = ? AND user_id = ?`;

    const params = [
      updates.departure_airport,
      updates.arrival_airport,
      updates.plane_id,
      updates.pilot_id,
      formatDate(updates.departure_time),
      formatDate(updates.estimated_arrival_time),
      formatDate(updates.actual_departure_time),
      formatDate(updates.actual_arrival_time),
      updates.status,
      costs.estimated_fuel_cost,
      costs.estimated_total_cost,
      trip_id,
      user_id
    ];

    console.log('Updating trip with params:', params);

    db.run(sql, params, function(err) {
      if (err) {
        console.error('Error updating trip:', err);
        return res.status(500).json({ error: 'Error updating trip: ' + err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Trip not found or unauthorized' });
      }

      db.get('SELECT * FROM trips WHERE id = ? AND user_id = ?', [trip_id, user_id], (err, trip) => {
        if (err) {
          console.error('Error fetching updated trip:', err);
          return res.status(500).json({ error: 'Error fetching updated trip' });
        }
        console.log('Trip updated successfully:', trip);
        res.json(trip);
      });
    });
  } catch (error) {
    console.error('Error in trip update:', error);
    res.status(500).json({ error: 'Error updating trip: ' + error.message });
  }
});

// Delete trip
router.delete('/:id', authenticateToken, (req, res) => {
  const tripId = req.params.id;
  
  // First check if the trip belongs to the user and is scheduled
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