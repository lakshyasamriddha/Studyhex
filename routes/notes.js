const express = require('express');
const pool = require('../db/init');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

async function areFriends(userIdA, userIdB) {
  const result = await pool.query(`
    SELECT 1 FROM connections
    WHERE status = 'accepted'
    AND (
      (requester_id = $1 AND addressee_id = $2)
      OR
      (requester_id = $2 AND addressee_id = $1)
    )
  `, [userIdA, userIdB]);

  return result.rows.length > 0;
}
module.exports = router; 
