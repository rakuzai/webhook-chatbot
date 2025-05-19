/**
 * WhatsAuto Webhook Server
 *
 * This server integrates WhatsAuto messaging with Supabase database and an AI chatbot system.
 * It handles user creation, agent selection, and conversation management for customer service
 * and sales support.
 *
 */

require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log("Using Supabase URL:", process.env.SUPABASE_URL);

/**
 * Creates a new user in the Supabase database
 *
 * @param {string} phone - The user's phone number (without formatting characters)
 * @param {string} last_message - The most recent message from the user
 * @returns {Promise<Object>} Object containing success status and data or error
 */
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

/**
 * Checks if a user already exists in the Supabase database
 *
 * @param {string} phone - The user's phone number (without formatting characters)
 * @returns {Promise<Object>} Object containing existence status and user data
 */
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

/**
 * Updates a user's state and last message in the Supabase database
 *
 * @param {string} phone - The user's phone number (without formatting characters)
 * @param {string} last_message - The most recent message from the user
 * @returns {Promise<Object>} Object containing success status and updated data
 */
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

/**
 * Handles agent selection and message routing logic
 *
 * @param {string} phone - The user's phone number
 * @param {string} currentState - The user's current conversation state
 * @param {string} message - The message from the user
 * @param {string|null} currentAgent - The user's currently selected agent, if any
 * @returns {Promise<Object>} Object containing the selected agent and reply message
 */
async function handleAgentSelection(
  phone,
  currentState,
  message,
  currentAgent
) {
  // Default reply message
  let replyMessage = "";
  let choice = "";
  let shouldUpdateAgent = false;

  if (currentState === "selecting") {
    switch (message.trim()) {
      case "1":
        choice = "Customer Service";
        replyMessage =
          "Anda telah terhubung dengan Customer Service. Ketik 3, untuk memutuskan koneksi.";
        shouldUpdateAgent = true;
        break;

      case "2":
        choice = "Sales";
        replyMessage =
          "Anda telah terhubung dengan Sales Team. Ketik 3, untuk memutuskan koneksi.";
        shouldUpdateAgent = true;
        break;

      case "3":
        choice = ""; // Empty string for disconnection
        replyMessage =
          "Koneksi anda telah terputus. Silahkan pilih agent kami untuk keperluan anda. 1) Customer Service 2) Sales Team";
        shouldUpdateAgent = true;
        break;

      default:
        // If user has an active agent, route the message to that agent
        if (currentAgent) {
          const chatResponse = await chatWithAgent(currentAgent, message);
          replyMessage = chatResponse.reply;
          choice = currentAgent; // Maintain current agent
        } else {
          // If no agent is selected, prompt user to select one
          choice = "INVALID";
          replyMessage =
            "Apakah ada yang bisa kami bantu? Silahkan pilih agent kami untuk keperluan anda. 1) Customer Service 2) Sales Team";
        }
        break;
    }

    // Update agent if needed
    if (shouldUpdateAgent) {
      await updateUserAgent(phone, choice);
    }

    return {
      choice: choice,
      reply: replyMessage,
    };
  }
}

/**
 * Communicates with elwyn API
 *
 * @param {string} agent - The selected agent type ("Customer Service" or "Sales")
 * @param {string} message - The user's message to send to the agent
 * @returns {Promise<Object>} Object containing the AI agent's reply
 */
async function chatWithAgent(agent, message) {
  let conversationId;

  // Determine the conversation ID based on agent type
  if (agent === "Customer Service") {
    conversationId = process.env.CUSTOMER_SERVICE_CONVERSATION_ID;
  } else if (agent === "Sales") {
    conversationId = process.env.SALES_CONVERSATION_ID;
  } else {
    return {
      reply: "Maaf, terjadi kesalahan. Silahkan coba lagi nanti.",
    };
  }

  try {
    const response = await axios.post(
      "https://ai-dashboard-api.primeskills.space/gateway/ai/conversational/chat-agent-stream-v2?model=GPT-4o-Mini",
      {
        conversation_id: conversationId,
        message: message,
      },
      {
        headers: {
          accept: "application/json",
          "X-AI_TOKEN": process.env.AI_TOKEN,
          "X-REQUEST_FROM": "AI_TOKEN",
          "Content-Type": "application/json",
        },
      }
    );

    // Log the entire response for debugging
    console.log(
      "Agent API Raw Response:",
      JSON.stringify(response.data, null, 2)
    );

    // Process and return the AI response
    return {
      reply:
        response.data ||
        "Maaf, kami tidak dapat memproses pesan Anda saat ini.",
    };
  } catch (error) {
    console.error(
      "Error chatting with agent:",
      error.response?.data || error.message
    );
    return {
      reply:
        "Terjadi kesalahan saat berkomunikasi dengan agen. Silahkan coba lagi nanti.",
    };
  }
}

/**
 * Updates the user's selected agent in the Supabase database
 *
 * @param {string} phone - The user's phone number
 * @param {string} agent - The selected agent ("Customer Service", "Sales", or empty string)
 * @returns {Promise<Object>} Object containing success status and updated data
 */
async function updateUserAgent(phone, agent) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/conversation_states?phone=eq.${phone}`;

  const payload = {
    agent: agent,
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

    console.log("Agent updated:", response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error(
      "Error updating agent:",
      error.response?.data || error.message
    );
    return { success: false, error: true };
  }
}

/**
 * Main webhook endpoint handler for WhatsAuto messages
 * Processes incoming messages, manages user state, and returns appropriate responses
 */
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
    // Update user's last message
    await updateUserState(phone, lastMessage);

    // Get updated user data
    const updatedUser = await checkUserExists(phone);
    const userData = updatedUser.data[0];

    // Handle agent selection and get response
    const result = await handleAgentSelection(
      phone,
      userData.state,
      lastMessage,
      userData.agent
    );
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

module.exports = app;
