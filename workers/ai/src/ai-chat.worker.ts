import { Worker, type Job } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import { VercelAiChatProvider } from '@/providers/vercel-ai-chat.provider';
import { appLogger } from '@/logging/app-logger';
import { createRedisConnectionOptions } from '@/redis-connection';
import { AI_CHAT_QUEUE_NAME, type AiChatJobData } from '@/ai-chat-job';
import type { AiChatReply } from '@/models/ai-chat-reply';

export class AiChatWorker {
    private readonly provider = new VercelAiChatProvider();
    private readonly worker: Worker<AiChatJobData, AiChatReply>;

    constructor() {
        this.worker = new Worker<AiChatJobData, AiChatReply>(
            AI_CHAT_QUEUE_NAME,
            (job) => this.process(job),
            {
                connection: createRedisConnectionOptions() as ConnectionOptions,
                concurrency: Number(process.env.AI_CHAT_WORKER_CONCURRENCY || 2)
            }
        );

        this.worker.on('completed', (job) => {
            appLogger.info('AI chat job completed.', {
                jobId: job.id,
                jobName: job.name
            });
        });

        this.worker.on('failed', (job, error) => {
            appLogger.error('AI chat job failed.', {
                jobId: job?.id,
                jobName: job?.name,
                errorName: error.name,
                message: error.message
            });
        });
    }

    async run(): Promise<void> {
        appLogger.info('AI chat worker started.', {
            queue: AI_CHAT_QUEUE_NAME,
            concurrency: Number(process.env.AI_CHAT_WORKER_CONCURRENCY || 2),
            ...this.provider.getProviderInfo()
        });
    }

    async close(): Promise<void> {
        await this.worker.close();
    }

    private async process(job: Job<AiChatJobData>): Promise<AiChatReply> {
        appLogger.info('Processing AI chat job.', {
            jobId: job.id,
            jobName: job.name,
            historyLength: job.data.history.length
        });

        return this.provider.generateReply(job.data);
    }
}
