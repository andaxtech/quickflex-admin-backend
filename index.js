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

// Fetch all pending driver details
app.get('/drivers/pending-details', async (req, res) => {
  try {
    const query = `
      SELECT 
        d.driver_id, d.first_name, d.last_name, d.email, d.phone_number, d.birth_date, d.license_number, d.license_expiration,
        c.make, c.model, c.year, c.vin_number, c.license_plate, c.inspection_status, c.inspection_date,
        b.check_status, b.check_date, b.verified_by, b.notes AS background_notes,
        i.provider, i.policy_number, i.start_date AS insurance_start, i.end_date AS insurance_end,
        bank.bank_name, bank.account_number, bank.routing_number
      FROM drivers d
      LEFT JOIN car_details c ON d.driver_id = c.driver_id
      LEFT JOIN background_checks b ON d.driver_id = b.driver_id
      LEFT JOIN insurance_details i ON d.driver_id = i.driver_id
      LEFT JOIN driver_banking_info bank ON d.driver_id = bank.driver_id
      WHERE d.status = 'New Registered'
      ORDER BY d.registration_date DESC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching pending driver details:', err.message);
    res.status(500).json({ error: 'Failed to fetch driver details' });
  }
});

// Update driver status (approve/reject)
app.post('/drivers/update-status', async (req, res) => {
  const { driver_id, new_status } = req.body;

  if (!driver_id || !new_status) {
    return res.status(400).json({ error: 'Missing driver_id or new_status' });
  }

  try {
    await pool.query(
      'UPDATE drivers SET status = $1 WHERE driver_id = $2',
      [new_status, driver_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating driver status:', err.message);
    res.status(500).json({ error: 'Failed to update driver status' });
  }
});

app.listen(port, () => {
  console.log(`Admin backend running on port ${port}`);
});
