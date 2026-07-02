import type { AcademicResource } from '@academic/domain/value-objects/academic-resource.value-object';

export const ACADEMIC_AUTH_REJECTED_EVENT = 'ecampus:auth-rejected';
export const ACADEMIC_RESOURCE_READY_EVENT = 'ecampus:resource-ready';
export const ACADEMIC_RESOURCE_FAILED_EVENT = 'ecampus:resource-failed';
export const ACADEMIC_BOOTSTRAP_READY_EVENT = 'ecampus:bootstrap-ready';
export const ACADEMIC_BOOTSTRAP_FAILED_EVENT = 'ecampus:bootstrap-failed';
export const ACADEMIC_LOGIN_READY_EVENT = 'ecampus:login-ready';
export const ACADEMIC_LOGIN_FAILED_EVENT = 'ecampus:login-failed';

export interface AcademicResourceNotification {
    cpf: string;
    resource: AcademicResource;
    year?: string;
    period?: string;
    planId?: string;
}

export interface AcademicResourceFailedNotification extends AcademicResourceNotification {
    status: 'failed';
    errorName: string;
    message: string;
}

export interface AcademicBootstrapNotification {
    cpf: string;
    requiredResources: AcademicResource[];
    readyResources: AcademicResource[];
    failedResources: AcademicResource[];
}

export interface AcademicLoginReadyNotification {
    jobId: string;
    accessToken: string;
}

export interface AcademicLoginFailedNotification {
    jobId: string;
    message: string;
}

export const ACADEMIC_AI_REPLY_EVENT = 'ecampus:ai-reply';
export const ACADEMIC_AI_FAILED_EVENT = 'ecampus:ai-failed';

export interface AcademicAiChatReplyNotification {
    userId: string;
    jobId: string;
    conversationId: string;
    message: { id: string; role: string; content: string; createdAt: string };
}

export interface AcademicAiChatFailedNotification {
    userId: string;
    jobId: string;
    message: string;
}

export abstract class AcademicNotificationService {
    abstract emitResourceReady(event: AcademicResourceNotification): void;
    abstract emitResourceFailed(event: AcademicResourceFailedNotification): void;
    abstract emitBootstrapReady(event: AcademicBootstrapNotification): void;
    abstract emitBootstrapFailed(event: AcademicBootstrapNotification): void;
    abstract emitLoginReady(event: AcademicLoginReadyNotification): void;
    abstract emitLoginFailed(event: AcademicLoginFailedNotification): void;
    abstract emitAiChatReply(event: AcademicAiChatReplyNotification): void;
    abstract emitAiChatFailed(event: AcademicAiChatFailedNotification): void;
}
