import { Injectable } from '@angular/core';
import { LockAccessRequest } from './lock-access-request';
import { LockAccessRequestService } from './lock-access-request.service';

/** Placeholder until the API exists: nothing is sent anywhere, the request just "succeeds". */
@Injectable()
export class SimulatedLockAccessRequestService extends LockAccessRequestService {
  async submit(_request: LockAccessRequest): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 600));
  }
}
