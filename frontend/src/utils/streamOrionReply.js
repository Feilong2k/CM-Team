/**
 * Stream Orion's reply via Server-Sent Events (SSE).
 * 
 * @param {string} endpoint - The API endpoint (default: /api/chat/messages)
 * @param {object} payload - The request body (must include external_id, sender, content, metadata)
 * @param {object} callbacks - Callback functions:
 *   - onChunk: (chunk: string) => void
 *   - onDone: (fullContent: string) => void
 *   - onError: (errorMessage: string) => void
 * @returns {Promise<void>} Resolves when the stream finishes (or rejects on network error)
 */
export async function streamOrionReply(endpoint, payload, { onChunk, onDone, onError }) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    // If the response is not OK, try to parse error or use status text
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  // Ensure we have a readable stream
  if (!response.body) {
    throw new Error('Response body is not readable');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulatedText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      
      const lines = buffer.split('\n');
      // Keep the last line in the buffer as it might be incomplete
      // If the buffer ended with \n, the last element is "" which is fine to keep (or empty buffer)
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6).trim();
          if (data === '') continue;

          try {
            const event = JSON.parse(data);
            // Handle different event types
            if (event.chunk !== undefined) {
              accumulatedText += event.chunk;
              onChunk?.(event.chunk);
            } else if (event.error !== undefined) {
              onError?.(event.error);
              return; // Stop processing on error
            } else if (event.done !== undefined) {
              const finalContent = event.fullContent || accumulatedText;
              onDone?.(finalContent);
              return; // Stream finished
            }
          } catch (e) {
            console.error('Failed to parse SSE event:', e, 'data:', data);
          }
        }
      }
    }

    // Process any remaining buffer if it looks like a complete line (unlikely for valid SSE but good safety)
    if (buffer.startsWith('data: ')) {
       try {
         const data = buffer.substring(6).trim();
         if (data) {
           const event = JSON.parse(data);
           if (event.chunk !== undefined) {
              accumulatedText += event.chunk;
              onChunk?.(event.chunk);
           } else if (event.done !== undefined) {
              const finalContent = event.fullContent || accumulatedText;
              onDone?.(finalContent);
              return;
           }
         }
       } catch (e) {
         // ignore
       }
    }

    // If we exit the loop without a done event, assume completion
    onDone?.(accumulatedText);
  } catch (error) {
    console.error('Stream reading error:', error);
    onError?.(error.message || 'Stream reading failed');
  } finally {
    reader.releaseLock();
  }
}
