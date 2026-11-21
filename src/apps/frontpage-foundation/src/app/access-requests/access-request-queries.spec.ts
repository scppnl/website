import { AccessRequest } from './access-request';
import {
  countByStatus,
  displayName,
  filterRequests,
  firstName,
  hasAllLocks,
  nextPending,
  overlapsOf,
  seriesOf,
} from './access-request-queries';
import { sampleAccessRequests } from './sample-access-requests';

describe('access request queries', () => {
  const requests = sampleAccessRequests(new Date('2026-11-20T12:00:00Z'));
  const byId = (id: string) => requests.find((request) => request.id === id) as AccessRequest;
  const ids = (list: readonly AccessRequest[]) => list.map((request) => request.id);
  const all = { tab: 'all', query: '', lock: 'all' } as const;

  it('counts each status and the total', () => {
    expect(countByStatus(requests)).toEqual({ pending: 6, approved: 3, rejected: 1, all: 10 });
  });

  it('lists open requests by the soonest start', () => {
    expect(ids(filterRequests(requests, { ...all, tab: 'pending' }))).toEqual([
      'd1',
      'd2',
      'd3',
      'm1',
      'm2',
      'm3',
    ]);
  });

  it('lists decided requests with the latest start first', () => {
    expect(ids(filterRequests(requests, { ...all, tab: 'approved' }))).toEqual(['a2', 'a1', 'a3']);
  });

  it('searches name, e-mail address and reason, ignoring case', () => {
    expect(ids(filterRequests(requests, { ...all, query: ' MILA ' }))).toEqual(['m1', 'm2', 'm3']);
    expect(ids(filterRequests(requests, { ...all, query: 'materiaalmeester' }))).toEqual(['d3']);
    expect(ids(filterRequests(requests, { ...all, query: 'kerstviering' }))).toEqual(['x1']);
    expect(filterRequests(requests, { ...all, query: 'bestaat niet' })).toEqual([]);
  });

  it('filters on a lock and combines it with the status', () => {
    expect(
      ids(filterRequests(requests, { tab: 'pending', query: '', lock: 'Voordeur grote gebouw' })),
    ).toEqual(['d2', 'm1', 'm2', 'm3']);
  });

  it('finds the other open requests of the same person', () => {
    expect(ids(seriesOf(byId('m2'), requests))).toEqual(['m1', 'm3']);
    expect(seriesOf(byId('d1'), requests)).toEqual([]);
    expect(seriesOf(byId('a1'), requests)).toEqual([]);
  });

  it('finds approved access from others in the same period on a shared lock', () => {
    const overlaps = overlapsOf(byId('m2'), requests);
    expect(overlaps.map((overlap) => overlap.request.id)).toEqual(['a2']);
    expect(overlaps[0].locks).toEqual(['Voordeur kleine gebouw', 'Magazijn buitendeur']);
    expect(overlapsOf(byId('m1'), requests)).toEqual([]);
    expect(overlapsOf(byId('a2'), requests)).toEqual([]);
  });

  it('picks the next open request, not the current one', () => {
    expect(nextPending(requests)?.id).toBe('d1');
    expect(nextPending(requests, 'd1')?.id).toBe('d2');
  });

  it('names the requester by name, or by e-mail address when the name is unknown', () => {
    expect(displayName(byId('d1'))).toBe('Daan Smit');
    expect(firstName(byId('d1'))).toBe('Daan');
    expect(displayName(byId('d3'))).toBe('materiaalmeester@scpp.nl');
    expect(firstName(byId('d3'))).toBe('de aanvrager');
  });

  it('recognises a request for every lock', () => {
    expect(hasAllLocks(byId('m1'))).toBe(true);
    expect(hasAllLocks(byId('d1'))).toBe(false);
  });
});
