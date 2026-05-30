const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseSSEStream } = require('../lib/stream');

// ─────────────────────────── Helpers ───────────────────────────

/**
 * Creates a ReadableStream from an array of string chunks.
 * Simulates how a fetch response body would deliver SSE data.
 */
function createMockStream(chunks) {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

/**
 * Collect all events from an async iterable into an array.
 */
async function collectEvents(iterable) {
  const events = [];
  for await (const event of iterable) {
    events.push(event);
  }
  return events;
}

// ─────────────────────────── Tests ───────────────────────────

describe('parseSSEStream()', () => {
  it('parses single data-only event', async () => {
    const stream = createMockStream([
      'data: {"type":"message","id":"msg_1"}\n\n',
    ]);

    const events = await collectEvents(parseSSEStream(stream));

    assert.equal(events.length, 1);
    assert.equal(events[0].event, null);
    assert.deepEqual(events[0].data, { type: 'message', id: 'msg_1' });
  });

  it('parses multiple events', async () => {
    const stream = createMockStream([
      'data: {"type":"start"}\n\n',
      'data: {"type":"delta","text":"Hello"}\n\n',
      'data: {"type":"stop"}\n\n',
    ]);

    const events = await collectEvents(parseSSEStream(stream));

    assert.equal(events.length, 3);
    assert.equal(events[0].data.type, 'start');
    assert.equal(events[1].data.type, 'delta');
    assert.equal(events[1].data.text, 'Hello');
    assert.equal(events[2].data.type, 'stop');
  });

  it('handles event: + data: pairs', async () => {
    const stream = createMockStream([
      'event: message_start\ndata: {"type":"message_start"}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":"Hi"}}\n\n',
    ]);

    const events = await collectEvents(parseSSEStream(stream));

    assert.equal(events.length, 2);
    assert.equal(events[0].event, 'message_start');
    assert.deepEqual(events[0].data, { type: 'message_start' });
    assert.equal(events[1].event, 'content_block_delta');
    assert.equal(events[1].data.delta.text, 'Hi');
  });

  it('skips comment lines', async () => {
    const stream = createMockStream([
      ': this is a comment\n',
      'data: {"id":"1"}\n\n',
      ': another comment\n',
      'data: {"id":"2"}\n\n',
    ]);

    const events = await collectEvents(parseSSEStream(stream));

    assert.equal(events.length, 2);
    assert.equal(events[0].data.id, '1');
    assert.equal(events[1].data.id, '2');
  });

  it('skips empty lines between events', async () => {
    const stream = createMockStream([
      '\n\n\ndata: {"id":"1"}\n\n\n\ndata: {"id":"2"}\n\n',
    ]);

    const events = await collectEvents(parseSSEStream(stream));

    assert.equal(events.length, 2);
  });

  it('handles [DONE] sentinel', async () => {
    const stream = createMockStream([
      'data: {"type":"delta"}\n\n',
      'data: [DONE]\n\n',
      'data: {"type":"should_not_appear"}\n\n',
    ]);

    const events = await collectEvents(parseSSEStream(stream));

    assert.equal(events.length, 1);
    assert.equal(events[0].data.type, 'delta');
  });

  it('handles data split across chunks', async () => {
    // Simulate data arriving in fragments (realistic network behavior)
    const stream = createMockStream([
      'data: {"typ',
      'e":"mess',
      'age"}\n\n',
    ]);

    const events = await collectEvents(parseSSEStream(stream));

    assert.equal(events.length, 1);
    assert.equal(events[0].data.type, 'message');
  });

  it('handles non-JSON data as raw string', async () => {
    const stream = createMockStream([
      'data: plain text response\n\n',
    ]);

    const events = await collectEvents(parseSSEStream(stream));

    assert.equal(events.length, 1);
    assert.equal(events[0].data, 'plain text response');
  });

  it('handles empty stream', async () => {
    const stream = createMockStream([]);

    const events = await collectEvents(parseSSEStream(stream));

    assert.equal(events.length, 0);
  });

  it('handles stream with only comments', async () => {
    const stream = createMockStream([
      ': keep-alive\n\n',
      ': ping\n\n',
    ]);

    const events = await collectEvents(parseSSEStream(stream));

    assert.equal(events.length, 0);
  });

  it('handles Anthropic-style streaming response', async () => {
    // Realistic Anthropic streaming format
    const stream = createMockStream([
      'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_01","type":"message","role":"assistant","content":[],"model":"claude-sonnet-4-20250514"}}\n\n',
      'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}}\n\n',
      'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    ]);

    const events = await collectEvents(parseSSEStream(stream));

    assert.equal(events.length, 6);
    assert.equal(events[0].event, 'message_start');
    assert.equal(events[0].data.message.id, 'msg_01');
    assert.equal(events[2].event, 'content_block_delta');
    assert.equal(events[2].data.delta.text, 'Hello');
    assert.equal(events[3].data.delta.text, ' world');
    assert.equal(events[5].event, 'message_stop');
  });
});
