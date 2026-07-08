export class AiChatCancellationRegistry {
    private readonly controllers = new Map<string, AbortController>();

    create(jobId: string): AbortController {
        const controller = new AbortController();
        this.controllers.set(jobId, controller);
        return controller;
    }

    release(jobId: string): void {
        this.controllers.delete(jobId);
    }

    abort(jobId: string): boolean {
        const controller = this.controllers.get(jobId);
        if (!controller) return false;

        controller.abort();
        return true;
    }
}
