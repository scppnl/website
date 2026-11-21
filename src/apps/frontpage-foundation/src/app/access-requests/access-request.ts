/** The locks a member can ask access to. */
export const accessLocks = [
  'Voordeur grote gebouw',
  'Voordeur kleine gebouw',
  'Magazijn binnendeur',
  'Magazijn buitendeur',
] as const;

export type AccessLock = (typeof accessLocks)[number];

export type AccessRequestStatus = 'pending' | 'approved' | 'rejected';

/** What an admin can decide. */
export type AccessOutcome = Exclude<AccessRequestStatus, 'pending'>;

/** The status filter on the page: one status, or every request. */
export type StatusTab = AccessRequestStatus | 'all';

export interface AccessRequestHistoryEntry {
  readonly event: 'submitted' | AccessOutcome;
  /** ISO 8601 instant. */
  readonly at: string;
  /** True when an earlier decision was changed. */
  readonly revised: boolean;
  readonly by?: string;
  readonly notified?: boolean;
  /** The e-mail was asked for but not sent, because no real API is connected yet. */
  readonly simulated?: boolean;
}

export interface AccessRequest {
  readonly id: string;
  /** Null when the e-mail address has no known name. */
  readonly name: string | null;
  readonly email: string;
  readonly locks: readonly AccessLock[];
  /** ISO 8601 instants. */
  readonly start: string;
  readonly end: string;
  readonly submittedAt: string;
  readonly reason: string;
  readonly status: AccessRequestStatus;
  readonly decidedBy?: string;
  readonly decidedAt?: string;
  /** The explanation for the requester. Empty when none was given. */
  readonly comment?: string;
  /** Whether the requester was e-mailed the decision. */
  readonly notified?: boolean;
  readonly history: readonly AccessRequestHistoryEntry[];
}

/** One decision, applied to a request and optionally to the rest of its series. */
export interface AccessRequestDecision {
  readonly ids: readonly string[];
  readonly outcome: AccessOutcome;
  readonly comment: string;
  readonly notify: boolean;
}

/** What the decision form hands to the page. */
export interface AccessDecisionDraft {
  readonly outcome: AccessOutcome;
  readonly comment: string;
  readonly notify: boolean;
  readonly applyAll: boolean;
}
