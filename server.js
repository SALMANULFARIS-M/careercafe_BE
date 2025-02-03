const express = require("express");
const cors = require("cors"); // Allow frontend requests
const bodyParser = require("express").json;

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors()); // Enable CORS
app.use(bodyParser()); // Parse JSON request body

app.post("/api/appointment", (req, res) => {
  const formData = req.body;

  console.log("Received Appointment Data:", formData);

  res.json({ success: true, message: "Appointment booked successfully!" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

    