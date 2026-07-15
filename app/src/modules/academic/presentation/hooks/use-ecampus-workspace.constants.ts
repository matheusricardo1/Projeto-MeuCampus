import type { EcampusResourceReadyEvent } from '@/modules/academic/infrastructure/realtime/ecampus-realtime-client';

export type WorkspaceTab = 'home' | 'profile' | 'schedule' | 'grades' | 'lessonPlan' | 'ai';
export type ResourceKey = 'profile' | 'schedule' | 'grades' | 'lessonPlanSubjects' | 'lessonPlan' | 'prefetch' | 'restore' | 'login' | 'logout' | 'aiChat';
export type InitialResourceKey = 'profile' | 'schedule' | 'grades' | 'lessonPlanSubjects' | 'lessonPlan';
export type BootstrapResourceKey = 'profile' | 'schedule' | 'grades' | 'lessonPlanSubjects';

// The resources whose skeletons gate the home screen. lessonPlan is loaded
// alongside them but deliberately NOT part of this set: eCampus doesn't always
// publish a teaching plan, and scraping one is a separate lazy job that only
// starts once the subject list is in — blocking the home skeleton on it just
// adds a whole extra scrape round trip to every first load.
export const BOOTSTRAP_RESOURCES: BootstrapResourceKey[] = ['profile', 'schedule', 'grades', 'lessonPlanSubjects'];

// The sync engine re-pulls any resource the backend still reports as pending
// (HTTP 202) every SYNC_POLL_INTERVAL_MS, giving up after SYNC_DEADLINE_MS.
// Because each pull is a cache-aside GET that returns the data the instant the
// worker finishes, this poll is what makes loading correct even if every
// realtime event is dropped (the WebSocket only ever accelerates it).
export const SYNC_POLL_INTERVAL_MS = 2500;
export const SYNC_DEADLINE_MS = 40000;

// Backend realtime events carry hyphenated resource strings; the hook keys its
// state by camelCase. This maps one to the other.
export function toInitialResourceKey(resource: EcampusResourceReadyEvent['resource']): InitialResourceKey {
    switch (resource) {
        case 'lesson-plan-subjects':
            return 'lessonPlanSubjects';
        case 'lesson-plan':
            return 'lessonPlan';
        default:
            return resource;
    }
}
