import { amsterdamDay, amsterdamInstant } from './amsterdam-time';
import { AccessLock, accessLocks, AccessRequest } from './access-request';

const SPEC = /^(-?\d+) (\d{2}):(\d{2})$/;

/**
 * Example requests until the API exists. Every moment is a day offset from today plus an Amsterdam
 * clock time ("5 19:00"), so the examples never end up in the past.
 */
export function sampleAccessRequests(now: Date = new Date()): AccessRequest[] {
  const today = amsterdamDay(now);

  const at = (spec: string): string => {
    const [, offset, hour, minute] = SPEC.exec(spec)!;
    return amsterdamInstant(
      today.year,
      today.month,
      today.day + Number(offset),
      Number(hour),
      Number(minute),
    ).toISOString();
  };

  const pending = (
    id: string,
    name: string | null,
    email: string,
    locks: readonly AccessLock[],
    start: string,
    end: string,
    reason: string,
    submitted: string,
  ): AccessRequest => ({
    id,
    name,
    email,
    locks,
    start: at(start),
    end: at(end),
    reason,
    submittedAt: at(submitted),
    status: 'pending',
    history: [{ event: 'submitted', at: at(submitted), revised: false }],
  });

  const decided = (
    base: AccessRequest,
    status: 'approved' | 'rejected',
    by: string,
    decidedAt: string,
    comment: string,
    notified: boolean,
  ): AccessRequest => ({
    ...base,
    status,
    decidedBy: by,
    decidedAt: at(decidedAt),
    comment,
    notified,
    history: [
      ...base.history,
      { event: status, at: at(decidedAt), revised: false, by, notified },
    ],
  });

  return [
    pending(
      'd1',
      'Daan Smit',
      'daan@scpp.nl',
      ['Magazijn binnendeur', 'Magazijn buitendeur'],
      '5 19:00',
      '5 21:30',
      'Tenten drogen en opbergen na het najaarskamp.',
      '-1 16:40',
    ),
    pending(
      'd2',
      'Fenna de Wit',
      'fenna@scpp.nl',
      ['Voordeur grote gebouw', 'Magazijn binnendeur'],
      '8 08:30',
      '8 13:00',
      'Sinterklaasopkomst welpen, verkleedkist uit het magazijn halen.',
      '-1 21:28',
    ),
    pending(
      'd3',
      null,
      'materiaalmeester@scpp.nl',
      ['Magazijn buitendeur'],
      '12 19:00',
      '12 20:30',
      'Inventarisatie kampmateriaal.',
      '0 08:12',
    ),
    pending('m1', 'Mila Koster', 'mila@scpp.nl', accessLocks, '28 17:00', '28 23:00', 'Winterkamp welpen: opbouw.', '-2 19:10'),
    pending('m2', 'Mila Koster', 'mila@scpp.nl', accessLocks, '29 08:00', '29 23:00', 'Winterkamp welpen.', '-2 19:10'),
    pending('m3', 'Mila Koster', 'mila@scpp.nl', accessLocks, '30 08:00', '30 16:00', 'Winterkamp welpen: opruimen.', '-2 19:11'),
    decided(
      pending(
        'a1',
        'Lotte Jansen',
        'lotte@scpp.nl',
        ['Voordeur kleine gebouw'],
        '4 19:30',
        '4 22:30',
        'Bestuursvergadering van de vereniging.',
        '-8 20:05',
      ),
      'approved',
      'Karin Willems',
      '-7 10:22',
      'Akkoord. Wil je na afloop de verwarming terugzetten op 15 graden?',
      true,
    ),
    decided(
      pending(
        'a2',
        'Wouter Bos',
        'wouter@scpp.nl',
        ['Voordeur kleine gebouw', 'Magazijn buitendeur'],
        '29 09:00',
        '29 17:00',
        'Klusdag: washok schilderen, verf en ladders uit het magazijn.',
        '-10 19:48',
      ),
      'approved',
      'Ruud Hermans',
      '-9 08:40',
      'Top, dank jullie wel! Ruud is er om 09:00.',
      true,
    ),
    decided(
      pending(
        'a3',
        'Emma Visser',
        'emma@scpp.nl',
        ['Magazijn buitendeur'],
        '-4 18:30',
        '-4 20:00',
        'Kampmateriaal terugbrengen.',
        '-11 12:10',
      ),
      'approved',
      'Ruud Hermans',
      '-11 13:02',
      '',
      false,
    ),
    decided(
      pending(
        'x1',
        'Noah Peeters',
        'noah@scpp.nl',
        ['Voordeur grote gebouw'],
        '22 10:00',
        '22 18:00',
        'Oefenen voor de kerstviering met de gidsen.',
        '-6 17:31',
      ),
      'rejected',
      'Karin Willems',
      '-5 09:15',
      'Het grote gebouw is die dag de hele dag verhuurd. Het kleine gebouw is vrij: dien gerust een nieuwe aanvraag in voor de voordeur van het kleine gebouw.',
      true,
    ),
  ];
}
