import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/shared/prisma/prisma.service';
import type { EcampusAnnouncement } from '@academic/domain/value-objects/ecampus-announcement.value-object';

const SINGLETON_ID = 'singleton';

/**
 * Persistent cache-aside for eCampus's institutional announcements — a
 * single global row (not keyed by student or course), mirroring
 * MatrizCurricularCacheRepository's cache-aside shape.
 */
@Injectable()
export class EcampusAnnouncementCacheRepository {
    constructor(private readonly prisma: PrismaService) {}

    async find(): Promise<EcampusAnnouncement[] | null> {
        const row = await this.prisma.ecampusAnnouncementCache.findUnique({ where: { id: SINGLETON_ID } });
        return row ? (row.payload as unknown as EcampusAnnouncement[]) : null;
    }

    async upsert(announcements: EcampusAnnouncement[]): Promise<void> {
        const payload = announcements as unknown as Prisma.InputJsonValue;
        await this.prisma.ecampusAnnouncementCache.upsert({
            where: { id: SINGLETON_ID },
            create: { id: SINGLETON_ID, payload },
            update: { payload }
        });
    }
}
