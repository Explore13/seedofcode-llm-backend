# SeedOfCode LLM API - Integration Guide

![alt text](image.png)
## Introduction
Welcome to the SeedOfCode LLM Platform! This guide provides everything you need to integrate our managed, scalable LLM inference API into your own applications. Our platform handles model routing, queueing, and credit management behind the scenes, providing a seamless developer experience.

## Prerequisites & Getting Started

Before you can make API requests, you will need an active account and a valid API key.

1. **Register**: Navigate to [ai.seedofcode.dev](https://ai.seedofcode.dev) (Note: The frontend UI is currently in development).
2. **Verify**: Complete the email verification process to activate your account.
3. **Generate API Key**: Create a new API Key in your dashboard. Keep this key secure; you will only be able to view the full secret key once.
4. **Credits**: New accounts receive a signup bonus of credits. Inference costs are calculated dynamically based on input/output token counts.

---

## Authentication

The API uses standard Bearer Token authentication. All inference endpoints require your secret API key to be sent in the `Authorization` HTTP header.

```http
Authorization: Bearer <YOUR_API_KEY>
```

---

## Base URL

All API requests should be prefixed with the following base URL:

```text
https://api.ai.seedofcode.dev/api
```
*(For local testing, use `http://localhost:3000/api`)*

---

## Core Endpoints

### 1. Chat Completion
**`POST /chat`**
Generates a response for a given chat conversation. The request blocks until the full response is generated.

**Request Body:**
```json
{
  "model": "gemma4:latest",
  "messages": [
    { "role": "system", "content": "You are a helpful AI assistant." },
    { "role": "user", "content": "What is 2+2?" }
  ]
}
```

### 2. Streaming Chat Completion (Recommended)
**`POST /chat/stream`**
Streams the response back in real-time via Server-Sent Events (SSE). This is highly recommended for UX to prevent long loading states.

**Request Body:** (Same as `/chat`)

**Response:**
Returns a continuous stream of JSON chunks:
```json
data: {"model":"gemma4:latest","message":{"role":"assistant","content":"4"},"done":false}
```

### 3. Generate (Raw Prompt)
**`POST /generate`** and **`POST /generate/stream`**
Used for raw text completion without chat conversational formatting.

**Request Body:**
```json
{
  "model": "gemma4:latest",
  "prompt": "The capital of France is"
}
```

### 4. List Available Models
**`GET /models`**
Retrieves a list of all currently available models.

---

## Code Example: Node.js Streaming Chat

Here is a complete, end-to-end example of how to securely consume the streaming chat endpoint using Node.js's native `fetch` API.

```javascript
async function streamChat() {
  const API_KEY = 'sk_live_your_api_key_here';
  
  const response = await fetch('https://api.ai.seedofcode.dev/api/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: 'gemma4:latest', 
      messages: [{ role: 'user', content: 'Say hello in 5 words.' }]
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Request failed:', errorData);
    return;
  }

  // Parse the SSE stream
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const text = decoder.decode(value);
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const payload = JSON.parse(line.replace('data: ', ''));
        
        // Output the streamed tokens to the console continuously
        if (payload.message?.content) {
          process.stdout.write(payload.message.content);
        }
      }
    }
  }
}

streamChat();
```

---

## Error Codes

Our API uses standard HTTP response codes to indicate the success or failure of an API request.

| Status Code | Description |
| :--- | :--- |
| **`400 Bad Request`** | Malformed request body, missing parameters, or the requested model does not exist. |
| **`401 Unauthorized`** | Authentication token is missing, invalid, or has been revoked. Ensure you are passing `Bearer <YOUR_API_KEY>`. |
| **`402 Payment Required`** | Insufficient credits in your wallet to cover the estimated reservation cost of the request. |
| **`429 Too Many Requests`** | You have exceeded the rate limit for your current plan. Please slow down or upgrade your plan. |
| **`500 Internal Server Error`** | An unexpected error occurred during generation or the model timed out. *(Note: No credits are deducted for failed generations).* |
