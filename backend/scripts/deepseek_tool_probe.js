// Simple DeepSeek + tools probe script
// 1. Makes a chat.completions call with tools enabled
// 2. Lets the model choose a tool
// 3. Executes the tool locally using DatabaseTool
// 4. Sends the tool result back as a `tool` message
// 5. Prints the final model response

const path = require('path');
const fs = require('fs');

// Load backend .env so DEEPSEEK_API_KEY is available
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const functionDefinitions = require('../tools/functionDefinitions');
const { DatabaseTool } = require('../tools/DatabaseTool');

const API_KEY = process.env.DEEPSEEK_API_KEY;
const BASE_URL = 'https://api.deepseek.com';
const MODEL = 'deepseek-chat';

if (!API_KEY) {
  console.error('Missing DEEPSEEK_API_KEY in backend/.env');
  process.exit(1);
}

async function sendMessages(messages, { tools = null } = {}) {
  const url = `${BASE_URL}/chat/completions`;

  const body = {
    model: MODEL,
    messages,
  };

  if (tools && Array.isArray(tools) && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek API error: ${res.status} ${res.statusText} - ${text}`);
  }

  const data = await res.json();
  const choice = data.choices && data.choices[0];
  if (!choice || !choice.message) {
    throw new Error('No message in DeepSeek response');
  }

  return choice.message;
}

async function main() {
  const dbTool = new DatabaseTool('Orion');

  // 1) Ask DeepSeek a question that should trigger a DB tool call
  const initialMessages = [
    {
      role: 'user',
      content:
        "You have a tool called DatabaseTool_get_subtask_full_context(subtask_id). " +
        "can you summarize subtask 2-1-1?",
    },
  ];

  console.log('User> ', initialMessages[0].content);

  const firstMessage = await sendMessages(initialMessages, {
    tools: functionDefinitions,
  });

  console.log('\n[First model message]');
  console.log('content:', firstMessage.content || '(no content)');
  console.log('tool_calls:', JSON.stringify(firstMessage.tool_calls || [], null, 2));

  const toolCall = firstMessage.tool_calls && firstMessage.tool_calls[0];
  if (!toolCall) {
    console.log('\nModel did not emit any tool_calls in the first turn.');
    return;
  }

  // 2) Execute the tool call locally using DatabaseTool
  const toolName = toolCall.function?.name || toolCall.name;
  const rawArgs = toolCall.function?.arguments ?? toolCall.arguments ?? '{}';
  let args;
  try {
    args = typeof rawArgs === 'string' ? JSON.parse(rawArgs || '{}') : rawArgs;
  } catch (e) {
    console.error('Failed to parse tool arguments:', rawArgs);
    throw e;
  }

  console.log('\nExecuting tool locally:', toolName, 'with args:', args);

  let toolResult;
  if (toolName === 'DatabaseTool_get_subtask_full_context') {
    const subtaskId = args.subtask_id || '2-1-1';
    toolResult = await dbTool.get_subtask_full_context(subtaskId);
  } else {
    console.error('Unexpected tool name, this probe only supports DatabaseTool_get_subtask_full_context');
    return;
  }

  console.log('\nLocal tool result (truncated):');
  console.log(JSON.stringify(toolResult, null, 2).slice(0, 2000));

  // 3) Send the tool result back to the model as a tool message
  const followupMessages = [
    ...initialMessages,
    firstMessage,
    {
      role: 'tool',
      tool_call_id: toolCall.id,
      name: toolName,
      content: JSON.stringify(toolResult),
    },
  ];

  const secondMessage = await sendMessages(followupMessages, {
    tools: functionDefinitions,
  });

  console.log('\n[Second model message]');
  console.log('content:', secondMessage.content || '(no content)');
  console.log('tool_calls:', JSON.stringify(secondMessage.tool_calls || [], null, 2));
}

main().catch((err) => {
  console.error('Probe failed:', err);
  process.exit(1);
});
