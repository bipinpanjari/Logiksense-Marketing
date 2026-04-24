import { bootWorker } from './worker.bootstrap';

bootWorker('linkedin').catch((err) => {
  console.error('linkedin worker failed to boot:', err);
  process.exit(1);
});
