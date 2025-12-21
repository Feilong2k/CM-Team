const { query } = require('../db/connection');

class StreamingService {
  /**
   * Stream content from an LLM adapter.
   * @param {AsyncGenerator} adapterStream - Stream from adapter's sendMessagesStreaming
   * @returns {AsyncGenerator<{chunk: string, error?: string, done?: boolean, fullContent?: string}>} Stream of events
   */
  async *streamFromAdapter(adapterStream) {
    let fullContent = '';
    
    try {
      for await (const event of adapterStream) {
        // Adapter stream yields objects with 'chunk' or 'error' or 'done' properties
        if (event.chunk) {
          fullContent += event.chunk;
          yield { chunk: event.chunk };
        } else if (event.error) {
          yield { error: event.error };
          break;
        } else if (event.done) {
          // The adapter may send a done event with the full content
          const finalContent = event.fullContent || fullContent;
          yield { done: true, fullContent: finalContent };
          return;
        }
      }
      
      // If we exit the loop without a done event, send one
      yield { done: true, fullContent };
    } catch (error) {
      console.error('Stream from adapter error:', error);
      yield { error: error.message };
    }
  }

  /**
   * Simulate streaming by splitting content into chunks.
   * This is a temporary implementation that should be replaced with real adapter streaming.
   * @param {string} content - The full content to stream
   * @param {Object} metadata - Request metadata for error simulation
   * @returns {AsyncGenerator<{chunk: string, error?: string, done?: boolean}>} Stream of events
   */
  async *streamContent(content, metadata = {}) {
    const forceError = metadata.forceError === true;
    const forceDbError = metadata.forceDbError === true;
    
    const words = content.split(/\s+/);
    let fullContent = '';
    let chunkCount = 0;
    
    for (const word of words) {
      if (word.trim()) {
        const chunk = word + ' ';
        fullContent += chunk;
        chunkCount++;
        
        yield { chunk };
        
        // Simulate adapter error mid-stream if forceError is true
        if (forceError && chunkCount >= 2) {
          yield { error: 'Simulated adapter error' };
          return;
        }
        
        // Small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    // Send final chunk if any remaining
    if (fullContent.trim() !== content.trim()) {
      const remaining = content.substring(fullContent.length);
      if (remaining.trim()) {
        yield { chunk: remaining };
        fullContent = content;
      }
    }
    
    // Yield final event with full content for persistence
    yield { done: true, fullContent: fullContent.trim() };
  }

  /**
   * Persist a streamed message to the database.
   * @param {string} externalId - External ID for the message
   * @param {string} content - The full message content
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} The inserted message
   */
  async persistStreamedMessage(externalId, content, metadata = {}) {
    const forceDbError = metadata.forceDbError === true;
    
    if (forceDbError) {
      throw new Error('Simulated database error');
    }
    
    const result = await query(
      `INSERT INTO chat_messages (external_id, sender, content, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING id, external_id, sender, content, metadata, created_at, updated_at`,
      [externalId, 'orion', content, metadata || null]
    );
    
    return result.rows[0];
  }

  /**
   * Handle SSE response for a streaming request.
   * @param {AsyncGenerator} stream - Stream generator
   * @param {Object} res - Express response object
   * @param {Function} onComplete - Callback when stream completes, receives fullContent
   */
  async handleSSE(stream, res, onComplete = null) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    let fullContent = null;
    
    try {
      for await (const event of stream) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        
        // If error event, stop streaming
        if (event.error) {
          break;
        }
        
        // Capture full content from done event
        if (event.done && event.fullContent) {
          fullContent = event.fullContent;
        }
      }
      
      // If we have a completion callback, call it with fullContent
      if (onComplete && fullContent) {
        await onComplete(fullContent);
      }
    } catch (error) {
      console.error('Streaming error:', error);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    } finally {
      res.end();
    }
  }
}

module.exports = StreamingService;
