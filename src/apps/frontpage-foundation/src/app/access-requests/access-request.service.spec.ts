import { TestBed } from '@angular/core/testing';
import { AccessRequest } from './access-request';
import { AccessRequestService, PLACEHOLDER_ADMIN } from './access-request.service';

describe('AccessRequestService', () => {
  let service: AccessRequestService;
  const find = (list: readonly AccessRequest[], id: string) =>
    list.find((request) => request.id === id)!;

  beforeEach(() => {
    service = TestBed.inject(AccessRequestService);
  });

  it('starts with the example requests', async () => {
    const list = await service.list();
    expect(list).toHaveLength(10);
    expect(list.filter((request) => request.status === 'pending')).toHaveLength(6);
  });

  it('decides every request in the decision and leaves the others', async () => {
    const list = await service.decide({
      ids: ['m1', 'm2', 'm3'],
      outcome: 'rejected',
      comment: '  Het gebouw is verhuurd.  ',
      notify: true,
    });

    for (const id of ['m1', 'm2', 'm3']) {
      expect(find(list, id)).toMatchObject({
        status: 'rejected',
        comment: 'Het gebouw is verhuurd.',
        decidedBy: PLACEHOLDER_ADMIN,
        notified: true,
      });
    }
    expect(find(list, 'd1').status).toBe('pending');
  });

  it('adds a history entry, and calls a later change a revision', async () => {
    await service.decide({ ids: ['d1'], outcome: 'approved', comment: '', notify: false });
    const list = await service.decide({ ids: ['d1'], outcome: 'rejected', comment: 'Toch niet.', notify: true });

    expect(find(list, 'd1').history.map((entry) => [entry.event, entry.revised])).toEqual([
      ['submitted', false],
      ['approved', false],
      ['rejected', true],
    ]);
  });

  it('records an asked-for e-mail as simulated, because it sends none', async () => {
    expect(service.sendsEmail).toBe(false);
    const list = await service.decide({ ids: ['d1', 'd2'], outcome: 'approved', comment: '', notify: true });
    expect(find(list, 'd1').history.at(-1)).toMatchObject({ notified: true, simulated: true });

    const quiet = await service.decide({ ids: ['d3'], outcome: 'approved', comment: '', notify: false });
    expect(find(quiet, 'd3').history.at(-1)).toMatchObject({ notified: false, simulated: false });
  });

  it('does not change the lists it handed out earlier', async () => {
    const before = await service.list();
    await service.decide({ ids: ['d1'], outcome: 'approved', comment: '', notify: false });
    expect(find(before, 'd1').status).toBe('pending');
  });

  it('puts back the requests as they were before the last decision', async () => {
    await service.decide({ ids: ['m1', 'm2'], outcome: 'approved', comment: 'Prima.', notify: true });
    const list = await service.revert(['m1', 'm2']);

    expect(find(list, 'm1')).toMatchObject({ status: 'pending', history: [{ event: 'submitted' }] });
    expect(find(list, 'm2').status).toBe('pending');
  });
});
