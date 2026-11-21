import { Injectable } from '@angular/core';
import { AccessRequest, AccessRequestDecision } from './access-request';
import { sampleAccessRequests } from './sample-access-requests';

/** Recorded as the decider until the page knows who is signed in. */
export const PLACEHOLDER_ADMIN = 'Beheerder';

/**
 * The access requests and the decisions on them. For now they live in memory and start from
 * example data; the methods and their promises are the shape the HTTP implementation will keep.
 */
@Injectable({ providedIn: 'root' })
export class AccessRequestService {
  /** The example data cannot e-mail anyone: the page says so instead of claiming it did. */
  readonly sendsEmail = false;

  private requests: readonly AccessRequest[] | null = null;
  /** The requests as they were before the last decision, so that it can be undone. */
  private beforeLastDecision: readonly AccessRequest[] = [];

  async list(): Promise<AccessRequest[]> {
    return [...this.current()];
  }

  /** Decides every request in `decision.ids`, and returns all requests. */
  async decide(decision: AccessRequestDecision): Promise<AccessRequest[]> {
    const at = new Date().toISOString();
    const targets = this.current().filter((request) => decision.ids.includes(request.id));
    this.beforeLastDecision = targets;
    this.requests = this.current().map((request) =>
      decision.ids.includes(request.id)
        ? {
            ...request,
            status: decision.outcome,
            decidedBy: PLACEHOLDER_ADMIN,
            decidedAt: at,
            comment: decision.comment.trim(),
            notified: decision.notify,
            history: [
              ...request.history,
              {
                event: decision.outcome,
                at,
                revised: request.status !== 'pending',
                by: PLACEHOLDER_ADMIN,
                notified: decision.notify,
                simulated: decision.notify && !this.sendsEmail,
              },
            ],
          }
        : request,
    );
    return [...this.current()];
  }

  /** Puts the given requests back as they were before the last decision. */
  async revert(ids: readonly string[]): Promise<AccessRequest[]> {
    const previous = new Map(this.beforeLastDecision.map((request) => [request.id, request]));
    this.requests = this.current().map((request) =>
      ids.includes(request.id) ? (previous.get(request.id) ?? request) : request,
    );
    this.beforeLastDecision = this.beforeLastDecision.filter((request) => !ids.includes(request.id));
    return [...this.current()];
  }

  private current(): readonly AccessRequest[] {
    return (this.requests ??= sampleAccessRequests());
  }
}
