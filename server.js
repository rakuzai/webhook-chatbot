// server.js
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");

const axios = require("axios");

const app = express();
app.use(bodyParser.json()); // Parse incoming JSON data
app.use(bodyParser.urlencoded({ extended: true }));

// Main webhook for WhatsAuto (on /)
app.post("/", (req, res) => {
  console.log(
    "Received WhatsAuto Webhook Data:",
    JSON.stringify(req.body, null, 2)
  );

  res.json({
    reply: "the webhook received",
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
