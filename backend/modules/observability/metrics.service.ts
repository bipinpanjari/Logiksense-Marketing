import { Injectable } from '@nestjs/common';
import * as client from 'prom-client';

/**
 * MetricsService exposes a process-wide Prometheus registry.
 *
 * - Default Node.js process metrics (event loop lag, GC, heap) are collected
 *   automatically once at bootstrap.
 * - Custom counters/histograms can be registered via `incCounter` / `observe`
 *   without the caller having to import prom-client.
 *
 * The `/metrics` endpoint in `MetricsController` serialises this registry in
 * the Prometheus text format.
 */
@Injectable()
export class MetricsService {
  readonly registry: client.Registry;
  readonly httpRequests: client.Counter<string>;
  readonly httpDuration: client.Histogram<string>;
  readonly queueJobs: client.Counter<string>;
  readonly emailSends: client.Counter<string>;

  constructor() {
    this.registry = new client.Registry();
    client.collectDefaultMetrics({ register: this.registry });

    this.httpRequests = new client.Counter({
      name: 'logikmarket_http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.httpDuration = new client.Histogram({
      name: 'logikmarket_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.queueJobs = new client.Counter({
      name: 'logikmarket_queue_jobs_total',
      help: 'Total BullMQ jobs by outcome',
      labelNames: ['queue', 'outcome'],
      registers: [this.registry],
    });

    this.emailSends = new client.Counter({
      name: 'logikmarket_email_sends_total',
      help: 'Total email send attempts',
      labelNames: ['status'],
      registers: [this.registry],
    });
  }

  export(): Promise<string> {
    return this.registry.metrics();
  }
}
