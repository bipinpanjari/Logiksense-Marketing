import { bootWorker } from './worker.bootstrap';

bootWorker('scraper').catch((err) => {
  console.error('scraper worker failed to boot:', err);
  process.exit(1);
});
