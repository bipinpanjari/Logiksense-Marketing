import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = process.hrtime.bigint();
    const route = this.normaliseRoute(req.originalUrl || req.url || '/');
    res.on('finish', () => {
      const elapsedNs = Number(process.hrtime.bigint() - start);
      const status = String(res.statusCode);
      this.metrics.httpRequests.inc({ method: req.method, route, status });
      this.metrics.httpDuration.observe({ method: req.method, route, status }, elapsedNs / 1e9);
    });
    next();
  }

  private normaliseRoute(url: string): string {
    const [path] = url.split('?');
    if (!path) return '/';
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
      .replace(/\/\d+/g, '/:id');
  }
}
