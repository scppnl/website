export type LockId =
  | 'voordeur-grote-gebouw'
  | 'voordeur-kleine-gebouw'
  | 'magazijn-binnendeur'
  | 'magazijn-buitendeur';

/** What the lock access API will receive. `start` and `end` are local `YYYY-MM-DDTHH:mm`, without offset. */
export interface LockAccessRequest {
  readonly locks: readonly LockId[];
  readonly start: string;
  readonly end: string;
  readonly reason: string;
}
