import type { BuildingChoice } from '../content/site-content';

export type { BuildingChoice };
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
  /** 24-hour time (HH:mm). */
  readonly startTime: string;
  /** 24-hour time (HH:mm). */
  readonly endTime: string;
  readonly guests: number;
  readonly remarks: string;
}
