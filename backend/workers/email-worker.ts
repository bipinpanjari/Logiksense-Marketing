import { bootWorker } from './worker.bootstrap';

bootWorker('email').catch((err) => {
  console.error('email worker failed to boot:', err);
  process.exit(1);
});
