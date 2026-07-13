/**
 * How many distinct authenticated students currently have an open WebSocket
 * connection. Implemented by AcademicGateway (api/src/composition/realtime),
 * which already tracks per-user rooms — this port keeps the admin module
 * from depending on the realtime/composition layer directly.
 */
export abstract class LiveUserCounter {
    abstract countLiveUsers(): number;
}
