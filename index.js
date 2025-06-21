const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Root route
app.get('/', (req, res) => {
  res.send('QuickFlex Admin Backend is running.');
});

// Get all drivers (basic info for dashboard)
app.get('/drivers/all', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT driver_id, first_name, last_name, email, phone_number, status
      FROM drivers
      ORDER BY 
        CASE WHEN status = 'New Registered' THEN 0 ELSE 1 END,
        registration_date DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching all drivers:', err.message);
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

// Get detailed pending driver info
app.get('/drivers/pending-details', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT ON (d.driver_id)
        d.driver_id, d.first_name, d.last_name, d.email, d.phone_number, d.birth_date,
        d.license_number, d.license_expiration, d.registration_date, d.status,
        c.make, c.model, c.year, c.vin_number, c.license_plate, c.inspection_status, c.inspection_date,
        b.check_status, b.check_date, b.verified_by, b.notes AS background_notes,
        i.provider, i.policy_number, i.start_date AS insurance_start, i.end_date AS insurance_end,
        bank.bank_name, bank.account_number, bank.routing_number
      FROM drivers d
      LEFT JOIN LATERAL (
        SELECT * FROM car_details WHERE driver_id = d.driver_id ORDER BY inspection_date DESC LIMIT 1
      ) c ON true
      LEFT JOIN LATERAL (
        SELECT * FROM background_checks WHERE driver_id = d.driver_id ORDER BY check_date DESC LIMIT 1
      ) b ON true
      LEFT JOIN LATERAL (
        SELECT * FROM insurance_details WHERE driver_id = d.driver_id ORDER BY start_date DESC LIMIT 1
      ) i ON true
      LEFT JOIN LATERAL (
        SELECT * FROM driver_banking_info WHERE driver_id = d.driver_id ORDER BY created_at DESC LIMIT 1
      ) bank ON true
      WHERE d.status = 'New Registered'
      ORDER BY d.driver_id, d.registration_date DESC;
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching pending driver details:', err.message);
    res.status(500).json({ error: 'Failed to fetch driver details' });
  }
});

// Get single driver profile
app.get('/drivers/:driverId', async (req, res) => {
  const { driverId } = req.params;
  try {
    const result = await pool.query(`
      SELECT driver_id, first_name, last_name, email, phone_number, birth_date,
             license_number, license_expiration, registration_date, status
      FROM drivers
      WHERE driver_id = $1
    `, [driverId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching driver:', err.message);
    res.status(500).json({ error: 'Failed to fetch driver' });
  }
});

// Get car details for a specific driver
app.get('/drivers/:driverId/car', async (req, res) => {
  const { driverId } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM car_details WHERE driver_id = $1 ORDER BY inspection_date DESC LIMIT 1',
      [driverId]
    );
    res.json(result.rows[0] || {});
  } catch (err) {
    console.error('Error fetching car details:', err.message);
    res.status(500).json({ error: 'Failed to fetch car details' });
  }
});

// Update car details
app.post('/drivers/:driverId/car', async (req, res) => {
  const { driverId } = req.params;
  const {
    make, model, year, vin_number, license_plate,
    inspection_status, inspection_date
  } = req.body;

  try {
    await pool.query(
      `INSERT INTO car_details (driver_id, make, model, year, vin_number, license_plate, inspection_status, inspection_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [driverId, make, model, year, vin_number, license_plate, inspection_status, inspection_date]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating car details:', err.message);
    res.status(500).json({ error: 'Failed to update car details' });
  }
});

// Update driver status
app.post('/drivers/update-status', async (req, res) => {
  const { driver_id, new_status } = req.body;
  if (!driver_id || !new_status) {
    return res.status(400).json({ error: 'Missing driver_id or new_status' });
  }
  try {
    await pool.query('UPDATE drivers SET status = $1 WHERE driver_id = $2', [new_status, driver_id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating driver status:', err.message);
    res.status(500).json({ error: 'Failed to update driver status' });
  }
});

app.listen(port, () => console.log(`Admin backend running on port ${port}`));
