import express from "express";
import cors from "cors";
import baileys from "@whiskeysockets/baileys";
import { createTransport } from "nodemailer";
import dotenv from "dotenv";
import qrcode from "qrcode";
import { pino } from "pino";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const OWNER_NUMBER = process.env.OWNER_NUMBER + "@s.whatsapp.net";

const corsOptions = {
  origin: [
    "https://careercafe.co",
    "https://www.careercafe.co",
    "http://localhost:4200",
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

const { makeWASocket, useMultiFileAuthState } = baileys;

let sock = null;
let isBotRunning = false;
let isReconnecting = false;

// ✅ Utility to check if socket is active
function isSockReady() {
  return (
    sock &&
    sock.user &&
    typeof sock.sendMessage === "function"
  );
}


// ✅ Build socket safely
async function buildSocket() {
  const { state, saveCreds } = await useMultiFileAuthState("baileys_auth");

  const newSock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    logger: pino({ level: "silent" }),
  });

  newSock.ev.on("creds.update", saveCreds);

  newSock.ev.on("connection.update", (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      console.log("📌 Scan this QR code to connect:");
      qrcode
        .toString(qr, { type: "terminal", small: true })
        .then((qrCode) => console.log(qrCode))
        .catch((err) => console.error("QR code error:", err));
    }

if (connection === "open" && newSock.user) {
  console.log("✅ WhatsApp Connected as:", newSock.user.id);
  sock = newSock;
  isBotRunning = true;
}


    if (connection === "close") {
      sock = null;
      isBotRunning = false;

      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;

      if (shouldReconnect && !isReconnecting) {
        isReconnecting = true;
        console.log("🔄 Connection closed. Reconnecting in 5s...");
        setTimeout(() => {
          isReconnecting = false;
          startBot();
        }, 5000);
      } else {
        console.log("🔴 Logged out. Awaiting QR scan.");
      }
    }
  });

  newSock.ev.on("messages.upsert", async (m) => {
    try {
      const msg = m.messages[0];
      if (!msg || msg.key.fromMe) return;
      if (msg?.historySyncNotification) return;
      if (msg?.key?.remoteJid?.endsWith("@newsletter")) return;
      console.log(
        "📩 New incoming message:",
        msg.message?.conversation || "[non-text]"
      );
    } catch (err) {
      console.error("⚠️ Error in message handler:", err);
    }
  });
}

// ✅ Start bot safely
async function startBot() {
  if (isBotRunning || isReconnecting) {
    console.log("⚠️ Bot already running or reconnecting.");
    return;
  }
  await buildSocket();
}

// ✅ Start bot on boot
startBot();

// ✅ Appointment Route
app.post("/appointment", async (req, res) => {
  if (!isSockReady()) {
    console.log("❌ WhatsApp bot not ready");
    return res.status(503).json({
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

  const userMessageBody = `✅ Appointment Confirmed!\n\nDear ${formData.name}, your appointment has been successfully booked.\nThank you for choosing us!`;

  try {
    await sock.sendMessage(OWNER_NUMBER, { text: messageBody });

    if (USER_NUMBER !== OWNER_NUMBER) {
      await sock.sendMessage(USER_NUMBER, { text: userMessageBody });
    }

    res.json({ success: true, message: "Appointment booked!" });
  } catch (error) {
    console.error("❌ Failed to send WhatsApp message:", error);
    res.status(500).json({
      success: false,
      message: "Error sending WhatsApp message",
    });
  }
});

// ✅ Health Check Route
app.get("/", (req, res) => {
  res.json({
    connected: isSockReady(),
    user: sock?.user || null,
  });
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
