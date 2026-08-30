import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { decryptAccountSecret, encryptAccountSecret } from '@/shared/security/moodle-account-cipher';
import { MoodleAccountLinkRepository } from '@moodle/domain/repositories/moodle-account-link.repository';
import type { MoodleAccountLink } from '@moodle/domain/entities/moodle-account-link.entity';
import { isMoodleInstanceId, type MoodleInstanceId } from '@moodle/domain/value-objects/moodle-instance.value-object';

@Injectable()
export class PrismaMoodleAccountLinkRepository extends MoodleAccountLinkRepository {
    constructor(private readonly prisma: PrismaService) {
        super();
    }

    async link(userId: string, instanceId: MoodleInstanceId, username: string, password: string): Promise<void> {
        const encryptedPassword = encryptAccountSecret(password);
        await this.prisma.moodleAccountLink.upsert({
            where: { userId_instanceId: { userId, instanceId } },
            create: { userId, instanceId, username, encryptedPassword },
            update: { username, encryptedPassword }
        });
    }

    async unlink(userId: string, instanceId: MoodleInstanceId): Promise<boolean> {
        const result = await this.prisma.moodleAccountLink.deleteMany({ where: { userId, instanceId } });
        return result.count > 0;
    }

    async listByUser(userId: string): Promise<MoodleAccountLink[]> {
        const rows = await this.prisma.moodleAccountLink.findMany({
            where: { userId },
            orderBy: { linkedAt: 'asc' }
        });

        return rows.filter((row) => isMoodleInstanceId(row.instanceId)).map((row) => ({
            instanceId: row.instanceId as MoodleInstanceId,
            username: row.username,
            linkedAt: row.linkedAt,
            lastSyncAt: row.lastSyncAt
        }));
    }

    async findCredentials(userId: string, instanceId: MoodleInstanceId): Promise<{ username: string; password: string } | null> {
        const row = await this.prisma.moodleAccountLink.findUnique({ where: { userId_instanceId: { userId, instanceId } } });
        if (!row) return null;
        return { username: row.username, password: decryptAccountSecret(row.encryptedPassword) };
    }

    async findFirstCredentials(userId: string): Promise<{ instanceId: MoodleInstanceId; username: string; password: string } | null> {
        const row = await this.prisma.moodleAccountLink.findFirst({ where: { userId }, orderBy: { linkedAt: 'asc' } });
        if (!row || !isMoodleInstanceId(row.instanceId)) return null;
        return { instanceId: row.instanceId, username: row.username, password: decryptAccountSecret(row.encryptedPassword) };
    }
}
