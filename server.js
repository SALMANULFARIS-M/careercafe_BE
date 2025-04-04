import express from "express";
import cors from "cors";
import baileys from "@whiskeysockets/baileys";
import { createTransport } from "nodemailer";
import dotenv from "dotenv";
import qrcode from "qrcode"; // Use `qrcode` instead of `qrcode-terminal`

dotenv.config();

const corsOptions = {
  origin: [
    "https://careercafe.co",
    "https://www.careercafe.co",
    "http://localhost:4200",
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};
const app = express();
const { makeWASocket, useMultiFileAuthState } = baileys;
app.use(cors(corsOptions));

const PORT = process.env.PORT || 5000;

app.use(express.json());

const transporter = createTransport({
  host: process.env.EMAIL_HOST, // e.g., 'smtp.gmail.com'
  port: process.env.EMAIL_SECURE === "true" ? 465 : 587,
  secure:
    process.env.EMAIL_SECURE === "true" || process.env.EMAIL_SECURE === true,
  auth: {
    user: process.env.EMAIL_USER, // Use the correct variable name
    pass: process.env.EMAIL_PASSWORD, // Use the correct variable name
  },
});

// Define the recipient's WhatsApp phone number (should include country code, e.g., +1 for US)
const OWNER_NUMBER = process.env.OWNER_NUMBER + "@s.whatsapp.net"; // Convert to WhatsApp format
let sock;

let isBotRunning = false; // Track bot status

async function startBot() {
  if (isBotRunning) {
    console.log("⚠️ Bot is already running! Skipping restart...");
    return;
  }

  isBotRunning = true; // Mark bot as running

  const { state, saveCreds } = await useMultiFileAuthState("baileys_auth");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { qr, connection, lastDisconnect } = update;

    if (qr) {
      console.log("📌 Scan this QR code to connect:");
      qrcode.toString(qr, { type: "terminal", small: true })
        .then((qrCode) => console.log(qrCode))
        .catch((err) => console.error("Error generating QR code:", err));
    }

    if (connection === "close") {
      isBotRunning = false; // Reset bot status BEFORE restart

      const isLoggedOut = lastDisconnect?.error?.output?.statusCode === 401;

      if (isLoggedOut) {
        console.log("🔴 Logged out. Scan QR again.");
      } else {
        console.log("❌ Connection closed unexpectedly. Restarting in 5 seconds...");
        setTimeout(startBot, 5000);
      }
    } else if (connection === "open") {
      console.log("✅ WhatsApp Connected!");
    }
  });

  // Ignore history messages
  sock.ev.on("messages.upsert", async (m) => {
    const message = m.messages[0];
  
    if (message?.historySyncNotification) return; // Ignore history messages
    if (message?.key?.remoteJid?.endsWith("@newsletter")) return; // Ignore newsletters
  
    if (!message.key.fromMe) {
      console.log("📩 New message received:", message);
    }
  });
}

// Start bot only once
startBot();



app.post("/appointment", async (req, res) => {
  if (!sock) {
    console.log("WhatsApp bot is not connected");
    return res
      .status(500)
      .json({ success: false, message: "WhatsApp bot is not connected" });
  }

  const formData = req.body;

  const messageBody = `📅 *New Appointment Request*:
  🔹 *Name:* ${formData.name}
  📞 *Phone:* ${formData.phone}
  📧 *Email:* ${formData.email}
  🏢 *Category:* ${formData.category}
  📍 *Place:* ${formData.place}
  📅 *Date:* ${formData.date}
  ⏰ *Time:* ${formData.time}`;

  const USER_NUMBER = "91" + formData.phone + "@s.whatsapp.net";

  const userMessageBody = `✅ Appointment Confirmed!\n
    Dear ${formData.name}, your appointment has been successfully booked.\n
    Thank you for choosing us!`;
  // Check if owner is the same as the user
  try {
    // Send message to owner
    await sock.sendMessage(OWNER_NUMBER, { text: messageBody });
    if (USER_NUMBER !== OWNER_NUMBER) {
      await sock.sendMessage(USER_NUMBER, { text: userMessageBody });
    }

    res.json({
      success: true,
      message: "Appointment booked!",
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
      to: "info@careercafe.co", // Your company email
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

    // **Send Success Response Only Once**sent
    res.status(200).json({ message: "Appointment booked!" });
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
