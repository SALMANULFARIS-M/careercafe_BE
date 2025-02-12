const express = require("express");
const cors = require("cors");
const bodyParser = require("express").json;
const app = express();
const nodemailer = require("nodemailer");
require("dotenv").config();
const corsOptions = {
  origin: ["https://careercafe.co"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};
app.use(cors(corsOptions));

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

// Define the recipient's WhatsApp phone number (should include country code, e.g., +1 for US)
const OWNER_NUMBER = process.env.OWNER_NUMBER + "@s.whatsapp.net"; // Convert to WhatsApp format

let sock;

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("baileys_auth"); // Save session
  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true, // Show QR code in terminal
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    if (update.qr) {
      console.log("📲 Scan the QR code in the terminal using WhatsApp Web.");
    }
  });
}

app.post("/appointment", async (req, res) => {
  const formData = req.body;
  console.log("📩 Received Appointment Data:", formData);

  const messageBody = `📅 New Appointment Request:\n
    🔹 Name: ${formData.name}\n
    📞 Phone: ${formData.phone}\n
    📧 Email: ${formData.email}\n
    🏢 Category: ${formData.category}\n
    📍 Place: ${formData.place}\n
    📅 Date: ${formData.date}\n
    ⏰ Time: ${formData.time}`;

  const userMessageBody = `✅ Appointment Confirmed!\n
    Dear ${formData.name}, your appointment has been successfully booked.\n
    Thank you for choosing us!`;

  try {
    // Send message to owner
    await sock.sendMessage(OWNER_NUMBER, { text: messageBody });

    // Send confirmation to user
    await sock.sendMessage(`${formData.phone}@s.whatsapp.net`, {
      text: userMessageBody,
    });

    res.json({
      success: true,
      message: "Appointment booked & WhatsApp message sent!",
    });
  } catch (error) {
    console.error("❌ Error sending WhatsApp message:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to send WhatsApp message" });
  }
});

app.post("/patnerRegister", async (req, res) => {
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
      subject: "New Appointment Received ",
      html: `
        <h3>New Appointment Request For Partnership</h3>
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

app.post("/contact", async (req, res) => {
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
            <li><strong>Message:</strong> ${message}</li>
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
