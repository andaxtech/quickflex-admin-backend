const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Database connection setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Root route
app.get('/', (req, res) => {
  res.send('QuickFlex Admin Backend is running.');
});

// Debug route to test DB connection
app.get('/debug/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ success: true, time: result.rows[0].now });
  } catch (error) {
    console.error('DB test failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Route to get drivers with status "New Registered"
app.get('/drivers/pending', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT driver_id, first_name, last_name, email, phone_number, status
       FROM drivers
       WHERE status = 'New Registered'
       ORDER BY registration_date DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching drivers:', err.message);
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Admin backend running on port ${port}`);
});
