import type { AiChatMessage } from '@/domain/entities/ai-chat-message';
import type { AiChatReply } from '@/domain/entities/ai-chat-reply';
import type { Grade } from '@/domain/entities/grade';
import type { LessonPlanItem } from '@/domain/entities/lesson-plan-item';
import type { LessonPlanSubject } from '@/domain/entities/lesson-plan-subject';
import type { ScheduleClass } from '@/domain/entities/schedule-class';
import type { StudentProfile } from '@/domain/entities/student-profile';

export interface LoginCredentials {
    user: string;
    password: string;
}

export interface SendAiChatMessageRequest {
    conversationId?: string;
    message: string;
    history?: AiChatMessage[];
}

export type EcampusScrapeJobType = 'profile' | 'schedule' | 'grades' | 'lesson-plan-subjects' | 'lesson-plan';

export interface EcampusRepository {
    login(credentials: LoginCredentials): Promise<{ jobId: string }>;
    validateSession(accessToken: string): Promise<void>;
    logout(accessToken: string): Promise<void>;
    enqueueScrapeJob(accessToken: string, type: EcampusScrapeJobType, data?: Record<string, unknown>): Promise<void>;
    getProfile(accessToken: string): Promise<StudentProfile>;
    getGrades(accessToken: string, year?: string, period?: string): Promise<Grade[]>;
    getSchedule(accessToken: string): Promise<ScheduleClass[]>;
    getAcademicSubjects(accessToken: string, year?: string, period?: string): Promise<LessonPlanSubject[]>;
    getLessonPlanSubjects(accessToken: string): Promise<LessonPlanSubject[]>;
    getLessonPlan(accessToken: string, planId: string): Promise<LessonPlanItem[]>;
    sendAiChatMessage(accessToken: string, input: SendAiChatMessageRequest): Promise<AiChatReply>;
}
