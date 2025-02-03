const express = require("express");
const cors = require("cors"); // Allow frontend requests
const bodyParser = require("express").json;
const axios = require("axios");
require("dotenv").config(); // Load environment variables from .env file

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors()); // Enable CORS
app.use(bodyParser()); // Parse JSON request body

// Define the WhatsApp API credentials and endpoint
const phoneNumberID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
const whatsappApiUrl = `https://graph.facebook.com/v15.0/${phoneNumberID}/messages`;

// Define the recipient's WhatsApp phone number (should include country code, e.g., +1 for US)
const recipientNumber = process.env.RECIPIENT_PHONE_NUMBER;

app.post("/api/appointment", async (req, res) => {
  const formData = req.body;
  console.log("Received Appointment Data:", formData);

  // Prepare the message body
  const messageBody = `📅 New Appointment Request:\n\n
    🔹 Name: ${formData.name}\n
    📞 Phone: ${formData.phone}\n
    📧 Email: ${formData.email}\n
    🏢 Category: ${formData.category}\n
    📍 Place: ${formData.place}\n
    📅 Date: ${formData.date}\n
    ⏰ Time: ${formData.time}`;

  // Construct the message payload
  const messageData = {
    messaging_product: "whatsapp",
    to: recipientNumber,
    text: { body: messageBody },
  };

  try {
    // Send the WhatsApp message via the API
    const response = await axios.post(whatsappApiUrl, messageData, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    // Respond to the client
    res.json({
      success: true,
      message: "Appointment booked & WhatsApp message sent!",
    });
  } catch (error) {
    
    // Respond with an error
    res.status(500).json({
      success: false,
      message: "Failed to send WhatsApp message",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
