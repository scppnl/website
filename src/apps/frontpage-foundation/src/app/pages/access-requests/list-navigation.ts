import { Location } from '@angular/common';

/** History state a row link stores, so the details know they were opened from the list. */
export const FROM_LIST_STATE = { fromList: true } as const;

/** Whether the current history entry was opened from the list. */
export function openedFromList(location: Location): boolean {
  return (location.getState() as { fromList?: boolean } | null)?.fromList === true;
}
