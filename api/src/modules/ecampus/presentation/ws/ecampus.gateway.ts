import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { JwtAccessTokenService } from '@ecampus/infrastructure/security/jwt-access-token-service';
import { ECAMPUS_RESOURCE_READY_EVENT, type EcampusResourceReadyEvent } from '@/shared/ecampus-scrape-events';
import { appLogger } from '@/shared/logging/app-logger';

const ECAMPUS_AUTH_REJECTED_EVENT = 'ecampus:auth-rejected';

@WebSocketGateway({
    namespace: '/ecampus',
    cors: {
        origin: getAllowedOrigins(),
        credentials: false
    }
})
export class EcampusGateway {
    @WebSocketServer()
    private server!: Namespace;

    constructor(private readonly accessTokenService: JwtAccessTokenService) {}

    handleConnection(client: Socket): void {
        const token = client.handshake.auth?.token;
        if (typeof token !== 'string') {
            appLogger.warning('Rejected eCampus WebSocket connection without token.', {
                socketId: client.id
            });
            client.emit(ECAMPUS_AUTH_REJECTED_EVENT);
            client.disconnect(true);
            return;
        }

        try {
            const credentials = this.accessTokenService.verify(token);
            const room = this.roomFor(credentials.cpf);
            client.join(room);
            appLogger.info('Accepted eCampus WebSocket connection.', {
                socketId: client.id,
                transport: client.conn.transport.name,
                roomClients: this.getRoomClientCount(room)
            });
        } catch (error) {
            appLogger.warning('Rejected eCampus WebSocket connection with invalid token.', {
                socketId: client.id,
                errorName: error instanceof Error ? error.name : 'UnknownError',
                message: error instanceof Error ? error.message : String(error),
                tokenParts: token.split('.').length,
                tokenLength: token.length
            });
            client.emit(ECAMPUS_AUTH_REJECTED_EVENT);
            client.disconnect(true);
        }
    }

    handleDisconnect(client: Socket): void {
        appLogger.info('Closed eCampus WebSocket connection.', {
            socketId: client.id,
            reason: client.disconnected ? 'disconnected' : 'unknown'
        });
    }

    emitResourceReady(event: EcampusResourceReadyEvent): void {
        const { cpf: _cpf, ...payload } = event;
        const room = this.roomFor(event.cpf);
        const roomClients = this.getRoomClientCount(room);
        this.server.to(room).emit(ECAMPUS_RESOURCE_READY_EVENT, payload);
        appLogger.info('Sent eCampus resource notification through WebSocket.', {
            event: ECAMPUS_RESOURCE_READY_EVENT,
            resource: event.resource,
            year: event.year,
            period: event.period,
            planId: event.planId,
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
