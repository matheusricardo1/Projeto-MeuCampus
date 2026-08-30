import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { MoodleCredentials } from '@moodle/domain/entities/moodle-credentials.entity';

interface RequestWithMoodleCredentials {
    moodleCredentials?: MoodleCredentials;
}

export const CurrentMoodleCredentials = createParamDecorator(
    (_data: unknown, context: ExecutionContext): MoodleCredentials => {
        const request = context.switchToHttp().getRequest<RequestWithMoodleCredentials>();
        if (!request.moodleCredentials) {
            throw new Error('Attempted to access protected route without auth.');
        }

        return request.moodleCredentials;
    }
);
