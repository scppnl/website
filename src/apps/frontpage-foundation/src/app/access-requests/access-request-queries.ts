import {
  AccessLock,
  accessLocks,
  AccessRequest,
  AccessRequestStatus,
  StatusTab,
} from './access-request';

export interface AccessRequestFilter {
  readonly tab: StatusTab;
  readonly query: string;
  readonly lock: AccessLock | 'all';
}

const time = (instant: string) => new Date(instant).getTime();

export function displayName(request: AccessRequest): string {
  return request.name ?? request.email;
}

/** Used in sentences such as "Stuur Mila een e-mail". */
export function firstName(request: AccessRequest): string {
  return request.name ? request.name.split(' ')[0] : 'de aanvrager';
}

export function hasAllLocks(request: AccessRequest): boolean {
  return accessLocks.every((lock) => request.locks.includes(lock));
}

/** Status tab, search text (name, e-mail address and reason) and lock, sorted for the list. */
export function filterRequests(
  requests: readonly AccessRequest[],
  { tab, query, lock }: AccessRequestFilter,
): AccessRequest[] {
  const needle = query.trim().toLowerCase();
  const matches = (request: AccessRequest) =>
    (tab === 'all' || request.status === tab) &&
    (lock === 'all' || request.locks.includes(lock)) &&
    (!needle ||
      `${request.name ?? ''} ${request.email} ${request.reason}`.toLowerCase().includes(needle));
  return sortRequests(requests.filter(matches), tab);
}

/** Open requests by the soonest start; decided requests, most recent start first. */
export function sortRequests(requests: readonly AccessRequest[], tab: StatusTab): AccessRequest[] {
  const direction = tab === 'pending' || tab === 'all' ? 1 : -1;
  return [...requests].sort((a, b) => direction * (time(a.start) - time(b.start)));
}

export function countByStatus(
  requests: readonly AccessRequest[],
): Record<StatusTab, number> {
  const count = (status: AccessRequestStatus) => requests.filter((r) => r.status === status).length;
  return {
    pending: count('pending'),
    approved: count('approved'),
    rejected: count('rejected'),
    all: requests.length,
  };
}

/** The other open requests from the same e-mail address, soonest first. Empty once decided. */
export function seriesOf(
  request: AccessRequest,
  requests: readonly AccessRequest[],
): AccessRequest[] {
  if (request.status !== 'pending') return [];
  return sortRequests(
    requests.filter((r) => r.id !== request.id && r.email === request.email && r.status === 'pending'),
    'pending',
  );
}

export interface AccessOverlap {
  readonly request: AccessRequest;
  /** The locks both requests share. */
  readonly locks: readonly AccessLock[];
}

/** Approved requests from other people that overlap in time and share a lock with an open one. */
export function overlapsOf(
  request: AccessRequest,
  requests: readonly AccessRequest[],
): AccessOverlap[] {
  if (request.status !== 'pending') return [];
  const start = time(request.start);
  const end = time(request.end);
  return requests
    .filter(
      (other) =>
        other.id !== request.id &&
        other.email !== request.email &&
        other.status === 'approved' &&
        time(other.start) < end &&
        time(other.end) > start,
    )
    .map((other) => ({
      request: other,
      locks: other.locks.filter((lock) => request.locks.includes(lock)),
    }))
    .filter((overlap) => overlap.locks.length > 0)
    .sort((a, b) => time(a.request.start) - time(b.request.start));
}

/** A request a series decision would also apply to, with the access it overlaps. */
export interface SeriesMember {
  readonly request: AccessRequest;
  readonly overlaps: readonly AccessOverlap[];
}

/**
 * The other open requests of the same person, each with its own overlaps, so that deciding the
 * whole series never approves an overlap the admin has not seen.
 */
export function seriesMembers(
  request: AccessRequest,
  requests: readonly AccessRequest[],
): SeriesMember[] {
  return seriesOf(request, requests).map((member) => ({
    request: member,
    overlaps: overlapsOf(member, requests),
  }));
}

/** The open request that starts first, leaving out the one being looked at. */
export function nextPending(
  requests: readonly AccessRequest[],
  exceptId?: string,
): AccessRequest | undefined {
  return sortRequests(
    requests.filter((r) => r.status === 'pending' && r.id !== exceptId),
    'pending',
  )[0];
}
