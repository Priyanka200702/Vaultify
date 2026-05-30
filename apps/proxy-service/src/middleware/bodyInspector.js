const MAX_SNIPPET_LENGTH = 4096;

const PROMPT_INJECTION_PATTERNS = [
  { pattern: /ignore all previous instructions/i, label: 'IGNORE_PREVIOUS' },
  { pattern: /forget (all )?(previous |prior )?(instructions|rules|directions)/i, label: 'FORGET_INSTRUCTIONS' },
  { pattern: /system.?prompt/i, label: 'SYSTEM_PROMPT_REF' },
  { pattern: /you are (now |not )?(an? )?(AI|assistant|GPT|model|chatbot)/i, label: 'IDENTITY_OVERRIDE' },
  { pattern: /\$\{.*\}/, label: 'TEMPLATE_INJECTION' },
  { pattern: /\\\\.*\\\\(?:execute|run|cmd|bash|powershell|sh|exec)/i, label: 'COMMAND_INJECTION' },
  { pattern: /data:.*base64,/i, label: 'BASE64_DATA_URI' },
  { pattern: /<script[^>]*>/i, label: 'XSS_SCRIPT' },
  { pattern: /onerror|onload|onclick|onmouseover/i, label: 'EVENT_HANDLER' },
  { pattern: /(?:role.*system|system.*role).*(?:content|message)/i, label: 'ROLE_OVERRIDE' },
];

function inspectBody(req) {
  const result = { snippet: null, format: null, patterns: [] };
  const contentType = req.headers['content-type'] || '';

  if (contentType.includes('application/json') && req.body) {
    result.format = 'json';
    try {
      const raw = JSON.stringify(req.body);
      result.snippet = raw.slice(0, MAX_SNIPPET_LENGTH + 1);
      if (raw.length > MAX_SNIPPET_LENGTH) {
        result.snippet = result.snippet.slice(0, MAX_SNIPPET_LENGTH) + '... [truncated]';
      }
      const messages = req.body.messages || [];
      const content = messages.map((m) => m.content || '').join(' ');
      for (const { pattern, label } of PROMPT_INJECTION_PATTERNS) {
        if (pattern.test(content)) result.patterns.push(label);
      }
      if (req.body.system) {
        const systemStr = typeof req.body.system === 'string' ? req.body.system : JSON.stringify(req.body.system);
        for (const { pattern, label } of PROMPT_INJECTION_PATTERNS) {
          if (pattern.test(systemStr)) {
            const labelWithContext = `SYSTEM_${label}`;
            if (!result.patterns.includes(labelWithContext)) result.patterns.push(labelWithContext);
          }
        }
      }
    } catch (e) {
      result.snippet = '[unable to serialize body]';
    }
  } else if (contentType.includes('text/') && req.body) {
    result.format = 'text';
    const raw = typeof req.body === 'string' ? req.body : String(req.body);
    result.snippet = raw.slice(0, MAX_SNIPPET_LENGTH);
  } else if (req.body) {
    result.format = 'binary';
    result.snippet = `[binary content, content-type: ${contentType}]`;
  }
  return result;
}

module.exports = { inspectBody, PROMPT_INJECTION_PATTERNS };
