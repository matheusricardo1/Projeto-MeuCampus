import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { AuthenticateAcademicRequestUseCase } from '@auth/application/use-cases/authenticate-academic-request.usecase';
import {
    ACADEMIC_AUTH_REJECTED_EVENT,
    ACADEMIC_BOOTSTRAP_FAILED_EVENT,
    ACADEMIC_BOOTSTRAP_READY_EVENT,
    ACADEMIC_LOGIN_FAILED_EVENT,
    ACADEMIC_LOGIN_READY_EVENT,
    ACADEMIC_RESOURCE_FAILED_EVENT,
    ACADEMIC_RESOURCE_READY_EVENT,
    AcademicNotificationService,
    type AcademicBootstrapNotification,
    type AcademicLoginFailedNotification,
    type AcademicLoginReadyNotification,
    type AcademicResourceFailedNotification,
    type AcademicResourceNotification
} from '@academic/application/ports/academic-notification-service';
import { AcademicBootstrapTracker } from '@academic/application/ports/academic-bootstrap-tracker';
import { toBootstrapNotification } from '@academic/application/services/to-bootstrap-notification';
import {
    AI_CHAT_FAILED_EVENT,
    AI_CHAT_REPLY_EVENT,
    AI_CHAT_TOOL_EVENT,
    AiNotificationService,
    type AiChatFailedNotification,
    type AiChatReplyNotification,
    type AiChatToolNotification
} from '@ai/application/ports/ai-notification-service';
import { LiveUserCounter } from '@admin/application/ports/live-user-counter';
import { WebPushService } from '@push/infrastructure/web-push/web-push.service';
import { AdminGateway } from '@composition/realtime/admin.gateway';
import { appLogger } from '@/shared/logging/app-logger';
import { pseudonymousUserId } from '@/shared/security/pseudonymous-user-id';
import { getAllowedOrigins } from '@/shared/realtime/allowed-origins';

type WebSocketLogLevel = 'info' | 'warning';
const USER_ROOM_PREFIX = 'ecampus-user-';
// Env-tunable so the owner can adjust it without a redeploy; defaults to 3
// (i.e. an alert fires once a 4th concurrent student connects).
const LIVE_USER_ALERT_THRESHOLD = Number(process.env.LIVE_USER_ALERT_THRESHOLD || 3);

@WebSocketGateway({
    namespace: '/ecampus',
    cors: {
        origin: getAllowedOrigins(),
        credentials: false
    }
})
export class AcademicGateway extends AcademicNotificationService implements AiNotificationService, LiveUserCounter {
    @WebSocketServer()
    private server!: Namespace;

    // Tracks the last broadcast count so the owner alert fires once per
    // crossing (3 -> 4), not on every connect while already above the
    // threshold, and re-arms once the count drops back down.
    private lastLiveUserCount = 0;

    constructor(
        private readonly authenticateRequest: AuthenticateAcademicRequestUseCase,
        private readonly adminGateway: AdminGateway,
        private readonly webPush: WebPushService,
        private readonly bootstrapTracker: AcademicBootstrapTracker
    ) {
        super();
    }

    /** Distinct authenticated students with at least one open socket right now. */
    countLiveUsers(): number {
        let count = 0;
        for (const room of this.server.adapter.rooms.keys()) {
            if (room.startsWith(USER_ROOM_PREFIX)) count += 1;
        }
        return count;
    }

    // Deliberately swallows its own errors — this is a side-channel
    // notification to the owner's dashboard, and must never be able to
    // affect whether a student's academic connection is accepted. It used
    // to run inside handleConnection's auth try/catch, so any failure here
    // (a socket.io/adapter hiccup, unrelated to auth at all) got misread as
    // "token invalid" and disconnected an otherwise successfully
    // authenticated client — silently dropping it before it could receive
    // any job-completion event on its room.
    private broadcastLiveUserCount(): void {
        try {
            const count = this.countLiveUsers();
            this.adminGateway.broadcastLiveUsers(count);
            this.notifyOwnerIfLiveUsersSpiked(count);
        } catch (error) {
            appLogger.warning('Failed to broadcast live user count to the admin dashboard.', {
                errorName: error instanceof Error ? error.name : 'UnknownError',
                message: error instanceof Error ? error.message : String(error)
            });
        }
    }

    // Same "must never affect a student connection" rule as
    // broadcastLiveUserCount above: fire-and-forget, own try/catch, never
    // awaited from handleConnection/handleDisconnect.
    private notifyOwnerIfLiveUsersSpiked(count: number): void {
        const crossedThreshold = count > LIVE_USER_ALERT_THRESHOLD && this.lastLiveUserCount <= LIVE_USER_ALERT_THRESHOLD;
        this.lastLiveUserCount = count;

        if (!crossedThreshold) {
            return;
        }

        this.webPush
            .notifyOwner('Meu Campus', `${count} usuarios usando o app ao vivo agora.`)
            .catch((error: unknown) => {
                appLogger.warning('Failed to send the owner push notification for a live user spike.', {
                    errorName: error instanceof Error ? error.name : 'UnknownError',
                    message: error instanceof Error ? error.message : String(error)
                });
            });
    }

    async handleConnection(client: Socket): Promise<void> {
        const loginJobId = client.handshake.auth?.loginJobId;
        if (typeof loginJobId === 'string' && loginJobId) {
            client.join(this.loginRoomFor(loginJobId));
            appLogger.info('Accepted temporary login WebSocket connection.', {
                socketId: client.id,
                loginJobId
            });
            return;
        }

        const token = client.handshake.auth?.token;
        if (typeof token !== 'string') {
            appLogger.warning('Rejected academic WebSocket connection without token.', {
                socketId: client.id
            });
            client.emit(ACADEMIC_AUTH_REJECTED_EVENT);
            client.disconnect(true);
            return;
        }

        // Only auth/session concerns belong in this try — anything else
        // (like the admin live-count broadcast below) must run after it
        // succeeds, never inside it, so an unrelated failure can't get
        // misread as "token invalid" and disconnect an authenticated client.
        try {
            const credentials = await this.authenticateRequest.execute(token);
            const room = this.roomFor(credentials.cpf);
            client.join(room);
            appLogger.info('Accepted academic WebSocket connection.', {
                socketId: client.id,
                transport: client.conn.transport.name,
                roomClients: this.getRoomClientCount(room)
            });
            // A resource can finish scraping (and its bootstrap-ready fire) in
            // the window between the worker publishing it and this socket
            // finishing its room join - the client would then never hear that
            // the data is ready. Replaying the already-settled bootstrap state
            // straight to this socket closes that race. Fire-and-forget with
            // its own error handling, exactly like broadcastLiveUserCount: a
            // hiccup here must never affect an otherwise-accepted connection.
            this.replayBootstrapState(client, credentials.cpf);
        } catch (error) {
            appLogger.warning('Rejected academic WebSocket connection with invalid token.', {
                socketId: client.id,
                errorName: error instanceof Error ? error.name : 'UnknownError',
                message: error instanceof Error ? error.message : String(error),
                tokenParts: token.split('.').length,
                tokenLength: token.length
            });
            client.emit(ACADEMIC_AUTH_REJECTED_EVENT);
            client.disconnect(true);
            return;
        }

        this.broadcastLiveUserCount();
    }

    handleDisconnect(client: Socket): void {
        appLogger.info('Closed academic WebSocket connection.', {
            socketId: client.id,
            reason: client.disconnected ? 'disconnected' : 'unknown'
        });
        // Socket.io has already removed this socket from its rooms by the
        // time this fires, so the count below already excludes it.
        this.broadcastLiveUserCount();
    }

    // Fire-and-forget replay of an already-settled bootstrap to a single
    // socket that joined after the original room broadcast. Only emits when
    // the bootstrap has actually finished (ready/failed); a still-pending or
    // absent state means the normal live events will reach this socket now
    // that it's in the room, so there's nothing to replay.
    private replayBootstrapState(client: Socket, cpf: string): void {
        void this.bootstrapTracker
            .get(cpf)
            .then((state) => {
                if (!state || state.status === 'pending') {
                    return;
                }

                const { cpf: _cpf, ...payload } = toBootstrapNotification(state);
                const event = state.status === 'ready' ? ACADEMIC_BOOTSTRAP_READY_EVENT : ACADEMIC_BOOTSTRAP_FAILED_EVENT;
                client.emit(event, payload);
                appLogger.info('Replayed settled academic bootstrap state to a newly joined socket.', {
                    socketId: client.id,
                    status: state.status,
                    readyResources: state.readyResources,
                    failedResources: state.failedResources
                });
            })
            .catch((error: unknown) => {
                appLogger.warning('Failed to replay academic bootstrap state to a newly joined socket.', {
                    socketId: client.id,
                    errorName: error instanceof Error ? error.name : 'UnknownError',
                    message: error instanceof Error ? error.message : String(error)
                });
            });
    }

    emitResourceReady(event: AcademicResourceNotification): void {
        const { cpf: _cpf, ...payload } = event;
        const room = this.roomFor(event.cpf);
        const roomClients = this.emitToRoomClients(ACADEMIC_RESOURCE_READY_EVENT, payload, room, {
            level: 'info',
            context: {
                resource: event.resource,
                year: event.year,
                period: event.period,
                planId: event.planId
            }
        });
        appLogger.info('Sent academic resource notification through WebSocket.', {
            event: ACADEMIC_RESOURCE_READY_EVENT,
            resource: event.resource,
            year: event.year,
            period: event.period,
            planId: event.planId,
            roomClients
        });
    }

    emitResourceFailed(event: AcademicResourceFailedNotification): void {
        const { cpf: _cpf, ...payload } = event;
        const room = this.roomFor(event.cpf);
        const roomClients = this.emitToRoomClients(ACADEMIC_RESOURCE_FAILED_EVENT, payload, room, {
            level: 'warning',
            context: {
                resource: event.resource,
                year: event.year,
                period: event.period,
                planId: event.planId,
                errorName: event.errorName
            }
        });
        if (event.errorName === 'AuthenticationError') {
            this.emitToRoomClients(ACADEMIC_AUTH_REJECTED_EVENT, {
                message: event.message
            }, room, {
                level: 'warning',
                context: {
                    reason: 'AuthenticationError'
                }
            });
        }
        appLogger.warning('Sent academic resource failure through WebSocket.', {
            event: ACADEMIC_RESOURCE_FAILED_EVENT,
            resource: event.resource,
            year: event.year,
            period: event.period,
            planId: event.planId,
            errorName: event.errorName,
            roomClients
        });
    }

    emitBootstrapReady(event: AcademicBootstrapNotification): void {
        const { cpf: _cpf, ...payload } = event;
        const room = this.roomFor(event.cpf);
        const roomClients = this.emitToRoomClients(ACADEMIC_BOOTSTRAP_READY_EVENT, payload, room, {
            level: 'info',
            context: {
                readyResources: event.readyResources
            }
        });
        appLogger.info('Sent academic bootstrap-ready notification through WebSocket.', {
            event: ACADEMIC_BOOTSTRAP_READY_EVENT,
            readyResources: event.readyResources,
            roomClients
        });
    }

    emitBootstrapFailed(event: AcademicBootstrapNotification): void {
        const { cpf: _cpf, ...payload } = event;
        const room = this.roomFor(event.cpf);
        const roomClients = this.emitToRoomClients(ACADEMIC_BOOTSTRAP_FAILED_EVENT, payload, room, {
            level: 'warning',
            context: {
                failedResources: event.failedResources
            }
        });
        appLogger.warning('Sent academic bootstrap-failed notification through WebSocket.', {
            event: ACADEMIC_BOOTSTRAP_FAILED_EVENT,
            failedResources: event.failedResources,
            roomClients
        });
    }

    emitLoginReady(event: AcademicLoginReadyNotification): void {
        const room = this.loginRoomFor(event.jobId);
        this.server.to(room).emit(ACADEMIC_LOGIN_READY_EVENT, { accessToken: event.accessToken });
        appLogger.info('Sent login-ready notification through WebSocket.', { jobId: event.jobId });
    }

    emitLoginFailed(event: AcademicLoginFailedNotification): void {
        const room = this.loginRoomFor(event.jobId);
        this.server.to(room).emit(ACADEMIC_LOGIN_FAILED_EVENT, { message: event.message });
        appLogger.warning('Sent login-failed notification through WebSocket.', { jobId: event.jobId });
    }

    emitChatReply(event: AiChatReplyNotification): void {
        const room = this.roomFor(event.userId);
        const { userId: _userId, ...payload } = event;
        this.server.to(room).emit(AI_CHAT_REPLY_EVENT, payload);
        appLogger.info('Sent AI chat reply through WebSocket.', { jobId: event.jobId, userId: event.userId });
    }

    emitChatFailed(event: AiChatFailedNotification): void {
        const room = this.roomFor(event.userId);
        const { userId: _userId, ...payload } = event;
        this.server.to(room).emit(AI_CHAT_FAILED_EVENT, payload);
        appLogger.warning('Sent AI chat failure through WebSocket.', { jobId: event.jobId, userId: event.userId });
    }

    emitChatTool(event: AiChatToolNotification): void {
        const room = this.roomFor(event.userId);
        const { userId: _userId, ...payload } = event;
        this.server.to(room).emit(AI_CHAT_TOOL_EVENT, payload);
    }

    revokeUserSessions(cpf: string): void {
        const room = this.roomFor(cpf);
        const roomClients = this.getRoomClientCount(room);
        if (roomClients === 0) {
            return;
        }

        void this.server.in(room).disconnectSockets(true);
        appLogger.info('Revoked stale WebSocket sessions after new login.', {
            room,
            roomClients
        });
    }

    private roomFor(cpf: string): string {
        return `ecampus-user-${pseudonymousUserId(cpf)}`;
    }

    private loginRoomFor(jobId: string): string {
        return `ecampus-login-${jobId}`;
    }

    private getRoomClientCount(room: string): number {
        return this.server.adapter.rooms.get(room)?.size ?? 0;
    }

    private emitToRoomClients(
        event: string,
        payload: unknown,
        room: string,
        options: {
            level: WebSocketLogLevel;
            context?: Record<string, unknown>;
        }
    ): number {
        const roomSocketIds = this.server.adapter.rooms.get(room);
        if (!roomSocketIds || roomSocketIds.size === 0) {
            return 0;
        }

        for (const socketId of roomSocketIds) {
            this.server.to(socketId).emit(event, payload);

            const logContext = {
                event,
                room,
                socketId,
                ...options.context
            };

            if (options.level === 'warning') {
                appLogger.warning('Dispatched academic WebSocket event to client.', logContext);
                continue;
            }

            appLogger.info('Dispatched academic WebSocket event to client.', logContext);
        }

        return roomSocketIds.size;
    }
}
