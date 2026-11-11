import type { BuildingChoice, DaypartId } from '../content/site-content';

export type { BuildingChoice, DaypartId };
export type GroupType = 'family' | 'school' | 'business' | 'other';

export interface BookingRequest {
  readonly name: string;
  readonly organisation: string;
  readonly email: string;
  readonly phone: string;
  readonly building: BuildingChoice;
  readonly groupType: GroupType;
  /** ISO date (yyyy-MM-dd). */
  readonly date: string;
  /** The rented dagdelen, in day order. The price is per dagdeel. */
  readonly dayparts: readonly DaypartId[];
  readonly guests: number;
  readonly remarks: string;
}
