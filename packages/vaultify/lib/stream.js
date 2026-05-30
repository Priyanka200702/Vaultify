/**
 * SSE (Server-Sent Events) stream parser.
 *
 * Converts a `ReadableStream<Uint8Array>` from a `fetch` response into
 * an async iterable of parsed event objects.
 *
 * Handles the standard SSE wire format:
 *   - `event: <type>\n`
 *   - `data: <json>\n`
 *   - blank lines delimit events
 *   - lines starting with `:` are comments (ignored)
 *   - `data: [DONE]` is treated as end-of-stream
 */

/**
 * Parse an SSE response body into an async iterable of event objects.
 *
 * @param {ReadableStream<Uint8Array>} body — The response body stream
 * @returns {AsyncIterable<{ event: string|null, data: object|string }>}
 */
async function* parseSSEStream(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = null;
  let currentData = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        // Comment line — ignore
        if (line.startsWith(':')) {
          continue;
        }

        // Empty line — flush the current event
        if (line.trim() === '') {
          if (currentData) {
            // Check for [DONE] sentinel
            const trimmedData = currentData.trim();
            if (trimmedData === '[DONE]') {
              return;
            }

            // Try to parse as JSON, fall back to raw string
            let parsed;
            try {
              parsed = JSON.parse(trimmedData);
            } catch {
              parsed = trimmedData;
            }

            yield { event: currentEvent, data: parsed };
            currentEvent = null;
            currentData = '';
          }
          continue;
        }

        // Parse field: value
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          // Accumulate data lines (SSE spec allows multi-line data)
          const dataValue = line.slice(5);
          if (currentData) {
            currentData += '\n' + dataValue;
          } else {
            currentData = dataValue;
          }
        }
        // Other fields (id:, retry:) are ignored for now
      }
    }

    // Flush any remaining data in buffer
    if (buffer.trim()) {
      const remaining = buffer.trim();
      if (remaining.startsWith('data:')) {
        const dataValue = remaining.slice(5).trim();
        if (dataValue && dataValue !== '[DONE]') {
          let parsed;
          try {
            parsed = JSON.parse(dataValue);
          } catch {
            parsed = dataValue;
          }
          yield { event: currentEvent, data: parsed };
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

module.exports = { parseSSEStream };
