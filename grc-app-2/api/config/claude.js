const Anthropic = require('@anthropic-ai/sdk');
const config = require('./index');

const anthropic = config.anthropicApiKey
  ? new Anthropic({ apiKey: config.anthropicApiKey })
  : null;

async function callClaude(prompt) {
  if (!anthropic) {
    throw new Error('ANTHROPIC_API_KEY not set in .env');
  }

  const message = await anthropic.messages.create({
    model: config.claudeModel,
    max_tokens: config.claudeMaxTokens,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content.map(block => block.text || '').join('');
}

function isClaudeConfigured() {
  return !!anthropic;
}

module.exports = { callClaude, isClaudeConfigured };
