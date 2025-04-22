// server.js
require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log("Using Supabase URL:", process.env.SUPABASE_URL);

// Function to create a new user in Supabase
async function createUser(phone, last_message = "") {
  const url = `${process.env.SUPABASE_URL}/rest/v1/conversation_states`;

  const payload = {
    phone,
    last_message,
    state: "initial",
    agent: null,
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        apikey: process.env.SUPABASE_API_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_API_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
    });

    console.log("User created:", response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error(
      "Error creating user:",
      error.response?.data || error.message
    );
    return { success: false, error: true };
  }
}

// Function to check if user exists in Supabase
async function checkUserExists(phone) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/conversation_states?phone=eq.${phone}`;

  try {
    const response = await axios.get(url, {
      headers: {
        apikey: process.env.SUPABASE_API_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (response.data.length > 0) {
      console.log("User exists:", response.data[0]);
      return { exists: true, data: response.data };
    } else {
      console.log("New user, not found in DB.");
      return { exists: false, data: [] };
    }
  } catch (error) {
    console.error(
      "Error checking user:",
      error.response?.data || error.message
    );
    return { exists: false, data: [], error: true };
  }
}

// Function to update user state and last message in Supabase
async function updateUserState(phone, last_message) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/conversation_states?phone=eq.${phone}`;

  const payload = {
    state: "selecting",
    last_message: last_message,
  };

  try {
    const response = await axios.patch(url, payload, {
      headers: {
        apikey: process.env.SUPABASE_API_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_API_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
    });

    console.log("User state updated:", response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error(
      "Error updating user state:",
      error.response?.data || error.message
    );
    return { success: false, error: true };
  }
}

function handleAgentSelection(currentState, message) {
  if (currentState === "selecting") {
    switch (message.trim()) {
      case "1":
        return {
          choice: "Customer Service",
          reply:
            "Anda telah terhubung dengan Customer Service. Ketik 3, untuk memutuskan koneksi.",
        };
      case "2":
        return {
          choice: "Sales",
          reply:
            "Anda telah terhubung dengan Sales Team. Ketik 3, untuk memutuskan koneksi.",
        };
      case "3":
        return {
          choice: "DISCONNECT",
          reply:
            "Koneksi anda telah terputus. Silahkan pilih agent kami untuk keperluan anda. 1) Customer Service 2) Sales Team",
        };
      default:
        return {
          choice: "INVALID",
          reply:
            "Apakah ada yang bisa kami bantu? Silahkan pilih agent kami untuk keperluan anda. 1) Customer Service 2) Sales Team",
        };
    }
  }
}

// Webhook endpoint
app.post("/", async (req, res) => {
  console.log(
    "Received WhatsAuto Webhook Data:",
    JSON.stringify(req.body, null, 2)
  );

  const rawPhone = req.body.phone;
  const lastMessage = req.body.message;

  if (!rawPhone) {
    return res.status(400).json({ error: "Phone number is missing" });
  }

  const phone = rawPhone.replace(/[\s+-]/g, "");

  const userCheck = await checkUserExists(phone);

  if (!userCheck.exists) {
    await createUser(phone, lastMessage);
  } else {
    await updateUserState(phone, lastMessage);

    const updatedUser = await checkUserExists(phone);
    const userData = updatedUser.data[0];

    const result = handleAgentSelection(userData.state, lastMessage);
    replyMessage = result.reply;
    choice = result.choice;
  }

  res.json({
    exists: userCheck.exists,
    reply: replyMessage,
    choice: choice,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
