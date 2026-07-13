import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { AdminJwtService } from '@admin/infrastructure/security/admin-jwt.service';
import { appLogger } from '@/shared/logging/app-logger';
import { getAllowedOrigins } from '@/shared/realtime/allowed-origins';

// Note: this gateway does not push an initial count on connect — the
// dashboard's own GET /admin/metrics fetch on mount supplies the starting
// snapshot, this only pushes updates after that (avoids a circular DI
// dependency with AcademicGateway, which owns the live-user count and is
// the one pushing to this gateway, not the other way around).

const ADMIN_DASHBOARD_ROOM = 'admin-dashboard';

/**
 * Separate namespace from AcademicGateway's `/ecampus` — different auth
 * (admin JWT, not a student's academic session token) and a different
 * audience (the owner's dashboard, not students).
 */
@WebSocketGateway({
    namespace: '/admin',
    cors: {
        origin: getAllowedOrigins(),
        credentials: false
    }
})
export class AdminGateway {
    @WebSocketServer()
    private server!: Namespace;

    constructor(private readonly adminJwtService: AdminJwtService) {}

    handleConnection(client: Socket): void {
        const token = client.handshake.auth?.token;
        if (typeof token !== 'string') {
            client.disconnect(true);
            return;
        }

        try {
            this.adminJwtService.verify(token);
        } catch {
            appLogger.warning('Rejected admin WebSocket connection with invalid token.', { socketId: client.id });
            client.disconnect(true);
            return;
        }

        client.join(ADMIN_DASHBOARD_ROOM);
        appLogger.info('Accepted admin WebSocket connection.', { socketId: client.id });
    }

    broadcastLiveUsers(count: number): void {
        this.server?.to(ADMIN_DASHBOARD_ROOM).emit('live-users', { count });
    }
}
