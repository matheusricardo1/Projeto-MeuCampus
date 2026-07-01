import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { AccessTokenService } from '@auth/application/ports/access-token-service';
import { AcademicSessionRegistry } from '@auth/application/ports/academic-session-registry';
import {
    ACADEMIC_AUTH_REJECTED_EVENT,
    ACADEMIC_BOOTSTRAP_FAILED_EVENT,
    ACADEMIC_BOOTSTRAP_READY_EVENT,
    ACADEMIC_RESOURCE_FAILED_EVENT,
    ACADEMIC_RESOURCE_READY_EVENT,
    AcademicNotificationService,
    type AcademicBootstrapNotification,
    type AcademicResourceFailedNotification,
    type AcademicResourceNotification
} from '@realtime/application/ports/academic-notification-service';
import { appLogger } from '@/shared/logging/app-logger';

type WebSocketLogLevel = 'info' | 'warning';

@WebSocketGateway({
    namespace: '/ecampus',
    cors: {
        origin: getAllowedOrigins(),
        credentials: false
    }
})
export class AcademicGateway extends AcademicNotificationService {
    @WebSocketServer()
    private server!: Namespace;

    constructor(
        private readonly accessTokenService: AccessTokenService,
        private readonly sessionRegistry: AcademicSessionRegistry
    ) {
        super();
    }

    async handleConnection(client: Socket): Promise<void> {
        const token = client.handshake.auth?.token;
        if (typeof token !== 'string') {
            appLogger.warning('Rejected academic WebSocket connection without token.', {
                socketId: client.id
            });
            client.emit(ACADEMIC_AUTH_REJECTED_EVENT);
            client.disconnect(true);
            return;
        }

        try {
            const credentials = this.accessTokenService.verify(token);
            const isActive = await this.sessionRegistry.isActive(credentials);
            if (!isActive) {
                throw new Error('Academic session is not active.');
            }

            const room = this.roomFor(credentials.cpf);
            client.join(room);
            appLogger.info('Accepted academic WebSocket connection.', {
                socketId: client.id,
                transport: client.conn.transport.name,
                roomClients: this.getRoomClientCount(room)
            });
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
        }
    }

    handleDisconnect(client: Socket): void {
        appLogger.info('Closed academic WebSocket connection.', {
            socketId: client.id,
            reason: client.disconnected ? 'disconnected' : 'unknown'
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

    private roomFor(cpf: string): string {
        return `ecampus-user-${cpf}`;
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

function getAllowedOrigins(): string[] {
    const configuredOrigins = process.env.FRONTEND_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean) || [];
    const defaults = process.env.NODE_ENV === 'production'
        ? ['https://meucampus.vercel.app']
        : ['https://meucampus.vercel.app', 'http://localhost:3000', 'http://localhost:8081', 'http://127.0.0.1:8081'];

    return [...new Set([...defaults, ...configuredOrigins])];
}
