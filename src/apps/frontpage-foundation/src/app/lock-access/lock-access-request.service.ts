import { LockAccessRequest } from './lock-access-request';

/**
 * Sends a lock access request to the board. It is only a token: the route provides an
 * implementation, which is the one place the backend stage swaps for an HTTP version.
 */
export abstract class LockAccessRequestService {
  /** Resolves when the request is accepted and rejects when it is not. */
  abstract submit(request: LockAccessRequest): Promise<void>;
}
