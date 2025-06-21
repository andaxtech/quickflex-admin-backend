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

// Get pending-driver details
app.get('/drivers/pending-details', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT ON (d.driver_id)
        d.driver_id, d.first_name, d.last_name, d.email, d.phone_number,
        TO_CHAR(d.birth_date, 'MM-DD-YYYY') AS birth_date,
        d.license_number,
        TO_CHAR(d.license_expiration, 'MM-DD-YYYY') AS license_expiration,
        TO_CHAR(d.registration_date, 'MM-DD-YYYY') AS registration_date,
        d.status,
        c.make, c.model, c.year, c.vin_number, c.license_plate, c.inspection_status,
        TO_CHAR(c.inspection_date, 'MM-DD-YYYY') AS inspection_date,
        b.check_status,
        TO_CHAR(b.check_date, 'MM-DD-YYYY') AS check_date, b.verified_by, b.notes AS background_notes,
        i.provider, i.policy_number,
        TO_CHAR(i.start_date, 'MM-DD-YYYY') AS insurance_start,
        TO_CHAR(i.end_date, 'MM-DD-YYYY') AS insurance_end,
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
      SELECT driver_id, first_name, last_name, email, phone_number,
             TO_CHAR(birth_date, 'MM-DD-YYYY') AS birth_date,
             license_number,
             TO_CHAR(license_expiration, 'MM-DD-YYYY') AS license_expiration,
             TO_CHAR(registration_date, 'MM-DD-YYYY') AS registration_date,
             status
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
    const result = await pool.query(`
      SELECT make, model, year, vin_number, license_plate, inspection_status,
             TO_CHAR(inspection_date, 'MM-DD-YYYY') AS inspection_date
      FROM car_details
      WHERE driver_id = $1
      ORDER BY inspection_date DESC
      LIMIT 1
    `, [driverId]);
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
    await pool.query(`
      INSERT INTO car_details (driver_id, make, model, year, vin_number, license_plate, inspection_status, inspection_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (vin_number) DO UPDATE
        SET make = EXCLUDED.make,
            model = EXCLUDED.model,
            year = EXCLUDED.year,
            license_plate = EXCLUDED.license_plate,
            inspection_status = EXCLUDED.inspection_status,
            inspection_date = EXCLUDED.inspection_date
    `, [driverId, make, model, year, vin_number, license_plate, inspection_status, inspection_date]);

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating car details:', err.message);
    res.status(500).json({ error: 'Failed to update car details' });
  }
});

// Get background check details
app.get('/drivers/:driverId/background', async (req, res) => {
  const { driverId } = req.params;
  try {
    const result = await pool.query(`
      SELECT check_status,
             TO_CHAR(check_date, 'MM-DD-YYYY') AS check_date,
             verified_by, notes
      FROM background_checks
      WHERE driver_id = $1
      ORDER BY check_date DESC
      LIMIT 1
    `, [driverId]);
    res.json(result.rows[0] || {});
  } catch (err) {
    console.error('Error fetching background check:', err.message);
    res.status(500).json({ error: 'Failed to fetch background check' });
  }
});

// Update background check info
app.post('/drivers/:driverId/background', async (req, res) => {
  const { driverId } = req.params;
  const { check_status, check_date, verified_by, notes } = req.body;

  try {
    await pool.query(`
      INSERT INTO background_checks (driver_id, check_status, check_date, verified_by, notes)
      VALUES ($1, $2, $3, $4, $5)
    `, [driverId, check_status, check_date, verified_by, notes]);

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating background check:', err.message);
    res.status(500).json({ error: 'Failed to update background check' });
  }
});

// Get insurance details
app.get('/drivers/:driverId/insurance', async (req, res) => {
  const { driverId } = req.params;
  try {
    const result = await pool.query(`
      SELECT provider, policy_number,
             TO_CHAR(start_date, 'MM-DD-YYYY') AS start_date,
             TO_CHAR(end_date, 'MM-DD-YYYY') AS end_date
      FROM insurance_details
      WHERE driver_id = $1
      ORDER BY start_date DESC
      LIMIT 1
    `, [driverId]);
    res.json(result.rows[0] || {});
  } catch (err) {
    console.error('Error fetching insurance details:', err.message);
    res.status(500).json({ error: 'Failed to fetch insurance details' });
  }
});

// Update insurance details
app.post('/drivers/:driverId/insurance', async (req, res) => {
  const { driverId } = req.params;
  const { provider, policy_number, start_date, end_date } = req.body;

  if (!policy_number) {
    return res.status(400).json({ error: 'Missing policy_number' });
  }

  try {
    await pool.query(`
      INSERT INTO insurance_details(driver_id, provider, policy_number, start_date, end_date)
      VALUES ($1, $2, $3, $4, $5)
    `, [driverId, provider, policy_number, start_date, end_date]);

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating insurance details:', err.message);
    res.status(500).json({ error: 'Failed to update insurance details' });
  }
});

// Get banking info
app.get('/drivers/:driverId/banking', async (req, res) => {
  const { driverId } = req.params;
  try {
    const result = await pool.query(`
      SELECT bank_name, account_number, routing_number,
             TO_CHAR(created_at, 'MM-DD-YYYY') AS created_at
      FROM driver_banking_info
      WHERE driver_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [driverId]);
    res.json(result.rows[0] || {});
  } catch (err) {
    console.error('Error fetching banking info:', err.message);
    res.status(500).json({ error: 'Failed to fetch banking info' });
  }
});

// Update banking info
app.post('/drivers/:driverId/banking', async (req, res) => {
  const { driverId } = req.params;
  const { bank_name, account_number, routing_number } = req.body;

  try {
    await pool.query(`
      INSERT INTO driver_banking_info(driver_id, bank_name, account_number, routing_number, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (driver_id) DO UPDATE SET
        bank_name = EXCLUDED.bank_name,
        account_number = EXCLUDED.account_number,
        routing_number = EXCLUDED.routing_number,
        created_at = NOW()
    `, [driverId, bank_name, account_number, routing_number]);

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating banking info:', err.message);
    res.status(500).json({ error: 'Failed to update banking info' });
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
