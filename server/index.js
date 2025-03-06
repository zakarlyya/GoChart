require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Debug middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body);
  next();
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Auth routes
app.post('/api/register', async (req, res) => {
  console.log('Register request:', req.body);
  try {
    const { email, password, company_name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      'INSERT INTO users (email, password, company_name) VALUES (?, ?, ?)',
      [email, hashedPassword, company_name],
      function(err) {
        if (err) {
          console.error('Registration error:', err);
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Email already exists' });
          }
          return res.status(500).json({ error: 'Error creating user' });
        }
        
        const token = jwt.sign(
          { id: this.lastID, email },
          process.env.JWT_SECRET,
          { expiresIn: '24h' }
        );
        res.json({ token });
      }
    );
  } catch (error) {
    console.error('Server error during registration:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', (req, res) => {
  console.log('Login request:', req.body);
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) {
      console.error('Database error during login:', err);
      return res.status(500).json({ error: 'Server error' });
    }
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    try {
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid password' });
      }

      const token = jwt.sign(
        { id: user.id, email },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      res.json({ token });
    } catch (error) {
      console.error('Error during password comparison:', error);
      res.status(500).json({ error: 'Error during authentication' });
    }
  });
});

// Protected routes
app.get('/api/planes', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM planes WHERE user_id = ?',
    [req.user.id],
    (err, planes) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      res.json(planes);
    }
  );
});

app.post('/api/planes', authenticateToken, (req, res) => {
  const { tail_number, model, manufacturer, range_nm, cruise_speed_kts, fuel_capacity_gal } = req.body;
  
  db.run(
    `INSERT INTO planes (
      user_id, tail_number, model, manufacturer, 
      range_nm, cruise_speed_kts, fuel_capacity_gal
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, tail_number, model, manufacturer, range_nm, cruise_speed_kts, fuel_capacity_gal],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Tail number already exists' });
        }
        return res.status(500).json({ error: 'Error adding plane' });
      }
      res.json({ id: this.lastID, tail_number });
    }
  );
});

app.get('/api/trips', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM trips WHERE user_id = ? ORDER BY departure_time',
    [req.user.id],
    (err, trips) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      res.json(trips);
    }
  );
});

app.post('/api/trips', authenticateToken, (req, res) => {
  const {
    plane_id,
    departure_airport,
    arrival_airport,
    departure_time,
    estimated_arrival_time,
    estimated_fuel_cost,
    estimated_total_cost
  } = req.body;

  db.run(
    `INSERT INTO trips (
      user_id, plane_id, departure_airport, arrival_airport,
      departure_time, estimated_arrival_time,
      estimated_fuel_cost, estimated_total_cost
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.user.id, plane_id, departure_airport, arrival_airport,
      departure_time, estimated_arrival_time,
      estimated_fuel_cost, estimated_total_cost
    ],
    function(err) {
      if (err) return res.status(500).json({ error: 'Error creating trip' });
      res.json({ id: this.lastID });
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 