import express from "express";
import cors from "cors";
import baileys from "@whiskeysockets/baileys";
import { createTransport } from "nodemailer";
import dotenv from "dotenv";
import qrcode from "qrcode";
import { pino } from "pino";

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
app.use(express.json());

const PORT = process.env.PORT || 5000;
const OWNER_NUMBER = process.env.OWNER_NUMBER + "@s.whatsapp.net";

let sock; // ✅ Global sock instance
let isBotRunning = false;

// ✅ START BOT FUNCTION
async function startBot() {
  if (isBotRunning) {
    console.log("⚠️ Bot is already running! Skipping restart...");
    return;
  }

  isBotRunning = true;

  const { state, saveCreds } = await useMultiFileAuthState("baileys_auth");

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    logger: pino({ level: "silent" }),
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { qr, connection, lastDisconnect } = update;

    if (qr) {
      console.log("📌 Scan this QR code to connect:");
      qrcode
        .toString(qr, { type: "terminal", small: true })
        .then((qrCode) => console.log(qrCode))
        .catch((err) => console.error("Error generating QR code:", err));
    }

    if (connection === "close") {
      isBotRunning = false;

      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;

      if (shouldReconnect) {
        console.log("❌ Connection closed. Restarting in 5 seconds...");
        setTimeout(startBot, 5000);
      } else {
        console.log("🔴 Logged out. Please scan the QR code again.");
      }
    } else if (connection === "open") {
      console.log("✅ WhatsApp Connected!");
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    try {
      const msg = m.messages[0];
      if (!msg) return;
      if (msg?.historySyncNotification) return;
      if (msg?.key?.remoteJid?.endsWith("@newsletter")) return;

      if (!msg.key.fromMe) {
        console.log(
          "📩 New message received:",
          msg.message?.conversation || "[non-text]"
        );
      }
    } catch (err) {
      console.error("❌ Error handling message:", err);
    }
  });
}

// ✅ START THE BOT ONCE
startBot();

// ✅ HEALTH CHECK ROUTE
app.get("/status", (req, res) => {
  const isConnected = !!sock?.user;
  res.json({
    success: true,
    connected: isConnected,
    user: sock?.user || null,
  });
});

// ✅ APPOINTMENT ROUTE
app.post("/appointment", async (req, res) => {
  if (!sock || !sock?.user) {
    console.log("❌ WhatsApp bot is not connected");
    return res.status(500).json({
      success: false,
      message: "WhatsApp bot is not connected",
    });
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

  const userMessageBody = `✅ Appointment Confirmed!

Dear ${formData.name}, your appointment has been successfully booked.
Thank you for choosing us!`;

  try {
    await sock.sendMessage(OWNER_NUMBER, { text: messageBody });

    if (USER_NUMBER !== OWNER_NUMBER) {
      await sock.sendMessage(USER_NUMBER, { text: userMessageBody });
    }

    res.json({ success: true, message: "Appointment booked!" });
  } catch (error) {
    console.error("❌ Error sending WhatsApp message:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to send WhatsApp message" });
  }
});



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
