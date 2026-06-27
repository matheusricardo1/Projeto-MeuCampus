import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { AccessTokenService } from '@academic/application/ports/access-token-service';
import { AcademicSessionRegistry } from '@academic/application/ports/academic-session-registry';
import {
    ACADEMIC_AUTH_REJECTED_EVENT,
    ACADEMIC_RESOURCE_FAILED_EVENT,
    ACADEMIC_RESOURCE_READY_EVENT,
    type AcademicResourceFailedEvent,
    type AcademicResourceReadyEvent
} from '@ecampus/infrastructure/redis/ecampus-scrape-events';
import { appLogger } from '@/shared/logging/app-logger';

@WebSocketGateway({
    namespace: '/ecampus',
    cors: {
        origin: getAllowedOrigins(),
        credentials: false
    }
})
export class AcademicGateway {
    @WebSocketServer()
    private server!: Namespace;

    constructor(
        private readonly accessTokenService: AccessTokenService,
        private readonly sessionRegistry: AcademicSessionRegistry
    ) {}

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

    emitResourceReady(event: AcademicResourceReadyEvent): void {
        const { cpf: _cpf, ...payload } = event;
        const room = this.roomFor(event.cpf);
        const roomClients = this.getRoomClientCount(room);
        this.server.to(room).emit(ACADEMIC_RESOURCE_READY_EVENT, payload);
        appLogger.info('Sent academic resource notification through WebSocket.', {
            event: ACADEMIC_RESOURCE_READY_EVENT,
            resource: event.resource,
            year: event.year,
            period: event.period,
            planId: event.planId,
            roomClients
        });
    }

    emitResourceFailed(event: AcademicResourceFailedEvent): void {
        const { cpf: _cpf, ...payload } = event;
        const room = this.roomFor(event.cpf);
        const roomClients = this.getRoomClientCount(room);
        this.server.to(room).emit(ACADEMIC_RESOURCE_FAILED_EVENT, payload);
        if (event.errorName === 'AuthenticationError') {
            this.server.to(room).emit(ACADEMIC_AUTH_REJECTED_EVENT, {
                message: event.message
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

    private roomFor(cpf: string): string {
        return `ecampus-user-${cpf}`;
    }

    private getRoomClientCount(room: string): number {
        return this.server.adapter.rooms.get(room)?.size ?? 0;
    }
}

function getAllowedOrigins(): string[] {
    const configuredOrigins = process.env.FRONTEND_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean) || [];
    const defaults = process.env.NODE_ENV === 'production'
        ? ['https://meucampus.vercel.app']
        : ['https://meucampus.vercel.app', 'http://localhost:3000', 'http://localhost:8081', 'http://127.0.0.1:8081'];

    return [...new Set([...defaults, ...configuredOrigins])];
}
