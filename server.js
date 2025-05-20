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

// Configuration constants
const INACTIVITY_THRESHOLD_MS = 1 * 60 * 1000; // 1 minute in milliseconds for testing
const AGENT_IDS = {
  "Customer Service": "948aad98-7c1a-4c07-830a-82125d85543c",
  Sales: "726fb1ca-dee1-4cfb-bba5-41e2cd3b032d",
};

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
    cs_conversation_id: null,
    sales_conversation_id: null,
    last_activity_timestamp: new Date().toISOString(),
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
      return { exists: true, data: response.data[0] };
    } else {
      console.log("New user, not found in DB.");
      return { exists: false, data: null };
    }
  } catch (error) {
    console.error(
      "Error checking user:",
      error.response?.data || error.message
    );
    return { exists: false, data: null, error: true };
  }
}

/**
 * Updates a user's state and last message in the Supabase database
 * WITHOUT updating the last_activity_timestamp
 *
 * @param {string} phone - The user's phone number (without formatting characters)
 * @param {string} last_message - The most recent message from the user
 * @returns {Promise<Object>} Object containing success status and updated data
 */
async function updateUserMessage(phone, last_message) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/conversation_states?phone=eq.${phone}`;

  const payload = {
    state: "selecting",
    last_message: last_message,
    // Intentionally NOT updating last_activity_timestamp here
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

    console.log("User message updated:", response.data);
    return { success: true, data: response.data[0] };
  } catch (error) {
    console.error(
      "Error updating user message:",
      error.response?.data || error.message
    );
    return { success: false, error: true };
  }
}

/**
 * Creates a new conversation ID by calling the external API
 *
 * @param {string} agentType - The type of agent ("Customer Service" or "Sales")
 * @returns {Promise<string|null>} The newly created conversation ID or null if failed
 */
async function createConversationId(agentType) {
  try {
    const agentId = AGENT_IDS[agentType];

    if (!agentId) {
      console.error(`Unknown agent type: ${agentType}`);
      return null;
    }

    console.log(
      `Creating new conversation ID for ${agentType} with agent ID: ${agentId}`
    );

    const response = await axios.post(
      "https://ai-dashboard-api.primeskills.space/gateway/ai/conversational/create-conversation",
      { agent_id: agentId },
      {
        headers: {
          accept: "application/json",
          "X-AI_TOKEN": process.env.AI_TOKEN,
          "X-REQUEST_FROM": "AI_TOKEN",
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data && response.data.data && response.data.data.id) {
      console.log(
        `Created new conversation ID for ${agentType}:`,
        response.data.data.id
      );
      return response.data.data.id;
    } else {
      console.error(
        "Failed to create conversation ID, unexpected response:",
        response.data
      );
      return null;
    }
  } catch (error) {
    console.error(
      "Error creating conversation ID:",
      error.response?.data || error.message
    );
    return null;
  }
}

/**
 * Updates the conversation ID for a specific agent type for a user
 *
 * @param {string} phone - The user's phone number
 * @param {string} agentType - The type of agent ("Customer Service" or "Sales")
 * @param {string} conversationId - The new conversation ID
 * @returns {Promise<Object>} Object containing success status and updated data
 */
async function updateConversationId(phone, agentType, conversationId) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/conversation_states?phone=eq.${phone}`;

  const fieldName =
    agentType === "Customer Service"
      ? "cs_conversation_id"
      : "sales_conversation_id";

  const payload = {
    [fieldName]: conversationId,
    last_activity_timestamp: new Date().toISOString(),
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

    console.log(`${agentType} conversation ID updated:`, response.data);
    return { success: true, data: response.data[0] };
  } catch (error) {
    console.error(
      `Error updating ${agentType} conversation ID:`,
      error.response?.data || error.message
    );
    return { success: false, error: true };
  }
}

/**
 * Checks if the user has been inactive beyond the threshold
 *
 * @param {string} lastActivityTimestamp - ISO timestamp of the user's last activity
 * @returns {boolean} True if the user is considered inactive, false otherwise
 */
function isUserInactive(lastActivityTimestamp) {
  if (!lastActivityTimestamp) return true;

  const lastActivity = new Date(lastActivityTimestamp).getTime();
  const now = new Date().getTime();
  const timeDiff = now - lastActivity;

  console.log("Time since last activity (ms):", timeDiff);
  console.log("Inactivity threshold (ms):", INACTIVITY_THRESHOLD_MS);
  console.log("Is user inactive: ", timeDiff > INACTIVITY_THRESHOLD_MS);

  return timeDiff > INACTIVITY_THRESHOLD_MS;
}

/**
 * Gets or creates a conversation ID for a specific agent type
 *
 * @param {string} phone - The user's phone number
 * @param {string} agentType - The agent type ("Customer Service" or "Sales")
 * @param {Object} userData - The user's data from the database
 * @param {boolean} forceNewConversation - Force creation of new conversation ID
 * @returns {Promise<string|null>} The conversation ID or null if failed
 */
async function getOrCreateConversationId(
  phone,
  agentType,
  userData,
  forceNewConversation = false
) {
  const fieldName =
    agentType === "Customer Service"
      ? "cs_conversation_id"
      : "sales_conversation_id";
  const existingConversationId = userData[fieldName];

  // If there's no existing ID or we're forcing a new conversation, create a new one
  if (!existingConversationId || forceNewConversation) {
    console.log(`Creating new conversation ID for ${phone} with ${agentType}`);
    const newConversationId = await createConversationId(agentType);
    if (newConversationId) {
      await updateConversationId(phone, agentType, newConversationId);
      return newConversationId;
    }
    return null;
  }

  return existingConversationId;
}

/**
 * Updates the user's last activity timestamp
 *
 * @param {string} phone - The user's phone number
 * @returns {Promise<Object>} Object containing success status and updated data
 */
async function updateLastActivityTimestamp(phone) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/conversation_states?phone=eq.${phone}`;

  const payload = {
    last_activity_timestamp: new Date().toISOString(),
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

    console.log("Last activity timestamp updated:", response.data);
    return { success: true, data: response.data[0] };
  } catch (error) {
    console.error(
      "Error updating last activity timestamp:",
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
 * @param {Object} userData - The user's data from the database
 * @param {boolean} isInactive - Whether the user is considered inactive
 * @returns {Promise<Object>} Object containing the selected agent and reply message
 */
async function handleAgentSelection(
  phone,
  currentState,
  message,
  userData,
  isInactive
) {
  // Get current agent from userData
  const currentAgent = userData.agent;

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
          // Get or create a conversation ID for this user-agent combination
          // Force new conversation if user was inactive
          const conversationId = await getOrCreateConversationId(
            phone,
            currentAgent,
            userData,
            isInactive
          );

          if (conversationId) {
            const chatResponse = await chatWithAgent(
              currentAgent,
              message,
              conversationId
            );
            replyMessage = chatResponse.reply;
            choice = currentAgent; // Maintain current agent

            // Update last activity timestamp AFTER checking inactivity
            await updateLastActivityTimestamp(phone);
          } else {
            replyMessage =
              "Maaf, terjadi kesalahan sistem. Silahkan coba lagi nanti.";
            choice = currentAgent;
          }
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

      // If we're setting a new agent, also update the activity timestamp
      await updateLastActivityTimestamp(phone);
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
 * @param {string} conversationId - The unique conversation ID for this user-agent combination
 * @returns {Promise<Object>} Object containing the AI agent's reply
 */
async function chatWithAgent(agent, message, conversationId) {
  try {
    console.log(
      `Chatting with ${agent} using conversation ID: ${conversationId}`
    );

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
    // Intentionally NOT updating last_activity_timestamp here
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
    return { success: true, data: response.data[0] };
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
  let replyMessage = "";
  let choice = "";

  if (!rawPhone) {
    return res.status(400).json({ error: "Phone number is missing" });
  }

  const phone = rawPhone.replace(/[\s+-]/g, "");

  // Check if user exists and get current data
  const userCheck = await checkUserExists(phone);

  if (!userCheck.exists) {
    // Create new user
    const createResult = await createUser(phone, lastMessage);
    if (createResult.success) {
      replyMessage =
        "Selamat datang! Silahkan pilih agent kami untuk keperluan anda. 1) Customer Service 2) Sales Team";
    } else {
      replyMessage =
        "Terjadi kesalahan saat memproses permintaan Anda. Silahkan coba lagi nanti.";
    }
  } else {
    // Get user data and check inactivity BEFORE updating any timestamps
    const userData = userCheck.data;
    console.log("This is the userData:", userData);

    // Check if user is inactive
    const userInactive = isUserInactive(userData.last_activity_timestamp);

    // Update user's last message without updating timestamp
    await updateUserMessage(phone, lastMessage);

    // Handle agent selection and get response
    const result = await handleAgentSelection(
      phone,
      userData.state,
      lastMessage,
      userData,
      userInactive
    );

    if (result) {
      replyMessage = result.reply;
      choice = result.choice;
    } else {
      replyMessage =
        "Silahkan pilih agent kami untuk keperluan anda. 1) Customer Service 2) Sales Team";
    }
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
