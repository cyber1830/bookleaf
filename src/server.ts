import { createApp } from './app.js';
import { recoverPendingTriage } from './ai/triage.js';
import { config } from './config.js';
import { seedIfEmpty } from './seed.js';

seedIfEmpty();
createApp().listen(config.port, () => {
  console.log(`BookLeaf portal on http://localhost:${config.port} (AI: ${config.ai.apiKey ? `${config.ai.provider}/${config.ai.model}` : 'disabled - heuristic fallback'})`);
  recoverPendingTriage();
});
