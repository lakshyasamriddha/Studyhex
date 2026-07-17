const express = require("express");
const pool = require("../db/init");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();


// GET friends
router.get("/", requireAuth, async (req, res) => {
  try {
    const myId = req.user.id;

    const result = await pool.query(
      `
      SELECT u.id, u.username, p.profile_photo_url
      FROM connections c
      JOIN users u ON u.id = CASE
        WHEN c.requester_id = $1 THEN c.addressee_id
        ELSE c.requester_id
      END
      LEFT JOIN profiles p ON p.user_id = u.id
      WHERE c.status = 'accepted'
      AND (c.requester_id = $1 OR c.addressee_id = $1)
      ORDER BY u.username
      `,
      [myId]
    );

    res.json({ friends: result.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get friends" });
  }
});


// Pending requests
router.get("/requests", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        c.id AS connection_id,
        u.id AS user_id,
        u.username,
        p.profile_photo_url,
        c.created_at
      FROM connections c
      JOIN users u ON u.id = c.requester_id
      LEFT JOIN profiles p ON p.user_id = u.id
      WHERE c.status='pending'
      AND c.addressee_id=$1
      ORDER BY c.created_at DESC
      `,
      [req.user.id]
    );

    res.json({ requests: result.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error:"Failed to get requests" });
  }
});


// Send request
router.post("/request/:username", requireAuth, async (req,res)=>{
  try {
    const targetResult = await pool.query(
      "SELECT id, username FROM users WHERE username=$1",
      [req.params.username]
    );

    if (!targetResult.rows.length)
      return res.status(404).json({error:"User not found"});

    const target = targetResult.rows[0];

    if(target.id === req.user.id)
      return res.status(400).json({error:"You can't friend yourself"});


    const existing = await pool.query(
      `
      SELECT *
      FROM connections
      WHERE (requester_id=$1 AND addressee_id=$2)
      OR (requester_id=$2 AND addressee_id=$1)
      `,
      [req.user.id,target.id]
    );

    if(existing.rows.length){
      if(existing.rows[0].status==="accepted")
        return res.status(409).json({error:"Already friends"});

      return res.status(409).json({error:"Request already exists"});
    }


    await pool.query(
      `
      INSERT INTO connections
      (requester_id,addressee_id,status)
      VALUES($1,$2,'pending')
      `,
      [req.user.id,target.id]
    );

    res.status(201).json({ok:true});

  } catch(err){
    console.error(err);
    res.status(500).json({error:"Failed"});
  }
});


// Accept
router.post("/accept/:username", requireAuth, async(req,res)=>{
  try{
    const target = await pool.query(
      "SELECT id FROM users WHERE username=$1",
      [req.params.username]
    );

    if(!target.rows.length)
      return res.status(404).json({error:"User not found"});


    const result = await pool.query(
      `
      UPDATE connections
      SET status='accepted'
      WHERE requester_id=$1
      AND addressee_id=$2
      AND status='pending'
      `,
      [target.rows[0].id, req.user.id]
    );

    if(result.rowCount===0)
      return res.status(404).json({error:"No pending request"});

    res.json({ok:true});

  }catch(err){
    console.error(err);
    res.status(500).json({error:"Failed"});
  }
});


// Decline
router.post("/decline/:username", requireAuth, async(req,res)=>{
  try{
    const target = await pool.query(
      "SELECT id FROM users WHERE username=$1",
      [req.params.username]
    );

    if(!target.rows.length)
      return res.status(404).json({error:"User not found"});


    const result = await pool.query(
      `
      DELETE FROM connections
      WHERE status='pending'
      AND (
        (requester_id=$1 AND addressee_id=$2)
        OR
        (requester_id=$2 AND addressee_id=$1)
      )
      `,
      [target.rows[0].id,req.user.id]
    );

    if(result.rowCount===0)
      return res.status(404).json({error:"No request found"});

    res.json({ok:true});

  }catch(err){
    console.error(err);
    res.status(500).json({error:"Failed"});
  }
});


// Remove friend
router.delete("/:username", requireAuth, async(req,res)=>{
  try{
    const target = await pool.query(
      "SELECT id FROM users WHERE username=$1",
      [req.params.username]
    );

    if(!target.rows.length)
      return res.status(404).json({error:"User not found"});


    const result = await pool.query(
      `
      DELETE FROM connections
      WHERE status='accepted'
      AND (
        (requester_id=$1 AND addressee_id=$2)
        OR
        (requester_id=$2 AND addressee_id=$1)
      )
      `,
      [target.rows[0].id,req.user.id]
    );


    if(result.rowCount===0)
      return res.status(404).json({error:"Not friends"});

    res.json({ok:true});

  }catch(err){
    console.error(err);
    res.status(500).json({error:"Failed"});
  }
});


module.exports = router;
