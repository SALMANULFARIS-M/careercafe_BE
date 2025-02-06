const express = require("express");
const cors = require("cors"); // Allow frontend requests
const bodyParser = require("express").json;
const axios = require("axios");
const nodemailer = require("nodemailer");
require("dotenv").config(); // Load environment variables from .env file

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors()); // Enable CORS
app.use(bodyParser()); // Parse JSON request body

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST, // e.g., 'smtp.gmail.com'
  port: process.env.EMAIL_SECURE === "true" ? 465 : 587,
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER, // Use the correct variable name
    pass: process.env.EMAIL_PASSWORD, // Use the correct variable name
  },
});

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

  const userMessageBody = `✅ Appointment Confirmed!\n\n
    Dear ${formData.name}, your appointment has been successfully booked.\n
    Thank you for choosing us!`;

  // Construct the message payload
  const messageData = {
    messaging_product: "whatsapp",
    to: recipientNumber,
    text: { body: messageBody },
  };
  const userMessageData = {
    messaging_product: "whatsapp",
    to: "whatsapp:+91" + formData.phone, // Correct format for WhatsApp API
    text: { body: userMessageBody },
  };
  try {
    const response = await axios.post(whatsappApiUrl, messageData, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    try {
      // Try sending the confirmation message to the user
      await axios.post(whatsappApiUrl, userMessageData, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }).then((res)=> console.log("api urra",res.data)).catch((err)=>console.log("ereera",err));
    } catch (userError) {
      console.error("Failed to send WhatsApp message to user:", userError);
      // We don't return an error here since the business message is already sent
    }

    // Respond to the client
    res.json({
      success: true,
      message: "Appointment booked & WhatsApp message sent!",
    });
  } catch (error) {
    console.log("errer :dsf",error);
    
    // Respond with an error
    res.status(500).json({
      success: false,
      message: "Failed to send WhatsApp message",
    });
  }
});

app.post("/api/patnerRegister", async (req, res) => {
  const { name, email, mobile, state, city } = req.body;
  try {
    // **Email to the User (Confirmation Email)**
    await transporter.sendMail({
      from: process.env.COMPANY_EMAIL,
      to: email,
      subject: "Appointment Confirmation",
      html: `
        <h1>CAREER CAFE</h1>
        <h3>Hello ${name},</h3>
        <p>Thank you for your interest. We have received your details:</p>
        <p>We will get back to you soon!</p>
      `,
    });

    // **Email to the Company (Notification Email)**
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: "ceo@careercafe.co", // Your company email
      subject: "New Appointment Received",
      html: `
        <h3>New Appointment Request</h3>
        <ul>
          <li><strong>Name:</strong> ${name}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Mobile:</strong> ${mobile}</li>
          <li><strong>State:</strong> ${state}</li>
          <li><strong>City:</strong> ${city}</li>
        </ul>
      `,
    });

    // **Send Success Response Only Once**
    res
      .status(200)
      .json({ message: "Appointment booked and emails sent successfully!" });
  } catch (error) {
    console.error("Error sending email:", error);

    // **Only Send One Error Response**
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to send email" });
    }
  }
});

app.post("/api/contact", async (req, res) => {
  const { name, email, message } = req.body;
  try {
    // **Email to the Company (Notification Email)**
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: "ceo@careercafe.co", // Your company email
      subject: "Contact",
      html: `
          <h3>Someone contacted us </h3>
          <ul>
            <li><strong>Name:</strong> ${name}</li>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>Mobile:</strong> ${message}</li>
          </ul>
        `,
    });
    res.status(200).json({ message: "We will contact you soon!" });
  } catch (error) {
    res.status(500).json({ error: "Failed to send email" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
