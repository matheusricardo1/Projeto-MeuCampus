import type { MoodleCredentials } from '@/domain/value-objects/moodle-credentials';
import type { Course } from '@/domain/entities/course';
import type { TimelineEvent } from '@/domain/entities/timeline-event';
import type { MoodleRepository } from '@/domain/repositories/moodle.repository';
import { MoodleAuthService } from '@/infrastructure/moodle-portal/moodle-auth-service';
import { appLogger as logger } from '@/infrastructure/logging/app-logger';

type UnknownRecord = Record<string, unknown>;

/**
 * Implements the domain repository against Moodle's real web service wire
 * shapes and maps them into the domain entities — the raw external contract
 * never leaks past this file.
 */
export class MoodleHttpRepository implements MoodleRepository {
    constructor(private readonly authService: MoodleAuthService) {}

    async logout(credentials: MoodleCredentials): Promise<void> {
        await this.authService.logout(credentials);
    }

    async getCourses(credentials: MoodleCredentials): Promise<Course[]> {
        const client = this.authService.getAuthenticatedClient(credentials);
        const userId = this.readUserId(credentials);
        logger.info('Fetching Moodle courses...', { instanceId: credentials.instanceId });

        const raw = await client.call<UnknownRecord[]>('core_enrol_get_users_courses', { userid: userId });

        return raw.map((item) => ({
            id: this.readNumber(item, 'id'),
            shortName: this.readString(item, 'shortname'),
            fullName: this.readString(item, 'fullname'),
            displayName: this.readString(item, 'displayname') || this.readString(item, 'fullname'),
            imageUrl: this.readNullableString(item, 'courseimage'),
            progress: this.readNullableNumber(item, 'progress'),
            startDate: this.readNumber(item, 'startdate'),
            endDate: this.readNullableNumber(item, 'enddate'),
            visible: item.visible === 1 || item.visible === true
        }));
    }

    async getTimeline(credentials: MoodleCredentials): Promise<TimelineEvent[]> {
        const client = this.authService.getAuthenticatedClient(credentials);
        logger.info('Fetching Moodle timeline...', { instanceId: credentials.instanceId });

        const raw = await client.call<UnknownRecord>('core_calendar_get_action_events_by_timesort', {
            // Wide window: 90 days back through a year ahead. The API/app
            // decide what to actually surface — this just avoids the worker
            // silently missing something reasonable.
            timesortfrom: Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60,
            limitnum: 50
        });

        const events = Array.isArray(raw.events) ? raw.events as UnknownRecord[] : [];

        return events.map((event) => {
            const course = (event.course && typeof event.course === 'object' ? event.course : {}) as UnknownRecord;
            const action = (event.action && typeof event.action === 'object' ? event.action : {}) as UnknownRecord;

            return {
                id: this.readNumber(event, 'id'),
                name: this.readString(event, 'name'),
                description: this.readNullableString(event, 'description'),
                courseId: this.readNullableNumber(course, 'id'),
                courseName: this.readNullableString(course, 'fullname'),
                activityType: this.readNullableString(event, 'modulename'),
                url: this.readNullableString(action, 'url') || this.readNullableString(event, 'url'),
                dueAt: this.readNullableNumber(event, 'timesort')
            };
        });
    }

    private readUserId(credentials: MoodleCredentials): number {
        const userId = credentials.session?.userId;
        if (typeof userId !== 'number') {
            throw new Error('Missing Moodle userId in session.');
        }
        return userId;
    }

    private readString(record: UnknownRecord, key: string): string {
        const value = record[key];
        if (typeof value === 'string') return value.trim();
        if (typeof value === 'number') return String(value);
        return '';
    }

    private readNullableString(record: UnknownRecord, key: string): string | null {
        const value = this.readString(record, key);
        return value ? value : null;
    }

    private readNumber(record: UnknownRecord, key: string): number {
        const value = record[key];
        return typeof value === 'number' && Number.isFinite(value) ? value : 0;
    }

    private readNullableNumber(record: UnknownRecord, key: string): number | null {
        const value = record[key];
        return typeof value === 'number' && Number.isFinite(value) ? value : null;
    }
}
