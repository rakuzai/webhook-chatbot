# WhatsAuto Webhook API Specification

## Overview

This document describes the webhook integration between WhatsAuto messaging service and the Elwyn AI system. The webhook handles user management, agent selection, and conversation routing for a customer support system.

## Endpoint

- **URL**: `/` (root endpoint)
- **Method**: `POST`
- **Content-Type**: `application/json`

## Request Format

### Request Body

```json
{
  "phone": "string", // User's phone number (may include formatting characters)
  "message": "string" // User's message content
}
```

### Example Request

```json
{
  "phone": "+62812345678",
  "message": "1"
}
```

## Response Format

### Response Body

```json
{
  "exists": boolean, // Whether the user already exists in the system
  "reply": "string",  // The message to send back to the user
  "choice": "string"  // The selected agent (if applicable)
}
```

### Example Response

```json
{
  "exists": true,
  "reply": "Anda telah terhubung dengan Customer Service. Ketik 3, untuk memutuskan koneksi.",
  "choice": "Customer Service"
}
```

## Business Logic Flow

1. When a user sends a message:

   - If this is a new user (first interaction):

     - Create user record in database
     - Set initial state
     - Return welcome message with agent options

   - If this is an existing user:
     - Update user's last message
     - Process message based on current state and agent selection

2. Agent Selection Logic:
   - Message "1": Connect to Customer Service
   - Message "2": Connect to Sales Team
   - Message "3": Disconnect current agent
   - Other messages:
     - If agent is already selected: Send to AI chatbot
     - If no agent is selected: Prompt to select an agent

## Integration with Elwyn API

When a message needs to be sent to an AI agent, the webhook makes a request to the Elwyn API:

- **URL**: `https://ai-dashboard-api.primeskills.space/gateway/ai/conversational/chat-agent-stream-v2`
- **Method**: `POST`
- **Parameters**: `?model=GPT-4o-Mini`
- **Headers**:
  - `accept`: `application/json`
  - `X-AI_TOKEN`: API authentication token
  - `X-REQUEST_FROM`: `AI_TOKEN`
  - `Content-Type`: `application/json`
- **Body**:
  ```json
  {
    "conversation_id": "string", // Conversation ID based on agent type
    "message": "string" // User's message
  }
  ```

The Elwyn API response is then forwarded back to the user through WhatsAuto.
