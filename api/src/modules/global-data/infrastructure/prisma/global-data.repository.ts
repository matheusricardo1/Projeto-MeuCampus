import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/shared/prisma/prisma.service';
import type { CreateGlobalDataInput, GlobalData, GlobalDataType } from '@global-data/domain/global-data.entity';

interface GlobalDataRow {
    id: string;
    type: GlobalDataType;
    title: string;
    payload: Prisma.JsonValue | null;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const MAX_ITEMS = 200;

@Injectable()
export class GlobalDataRepository {
    constructor(private readonly prisma: PrismaService) {}

    async create(input: CreateGlobalDataInput): Promise<GlobalData> {
        const row = await this.prisma.globalData.create({
            data: {
                type: input.type,
                title: input.title,
                // Only set payload when present — exactOptionalPropertyTypes rejects
                // an explicit `undefined`, and null would clobber the JSON column.
                ...(input.payload ? { payload: input.payload as Prisma.InputJsonValue } : {})
            }
        });

        return toDomain(row);
    }

    /** Admin listing: every entry (active and inactive), newest first per type. */
    async listAll(): Promise<GlobalData[]> {
        const rows = await this.prisma.globalData.findMany({
            orderBy: [{ type: 'asc' }, { updatedAt: 'desc' }],
            take: MAX_ITEMS
        });
        return rows.map(toDomain);
    }

    /** Toggles/sets an entry's visibility. Returns false if it no longer exists. */
    async setActive(id: string, active: boolean): Promise<boolean> {
        const result = await this.prisma.globalData.updateMany({ where: { id }, data: { active } });
        return result.count > 0;
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.prisma.globalData.deleteMany({ where: { id } });
        return result.count > 0;
    }

    /**
     * Official data the AI may treat as authoritative fact. Active entries only,
     * optionally filtered by type. Internal ids/flags are stripped — the model
     * only needs the type, title, fields and when it was last updated.
     */
    async listActiveForAi(type?: GlobalDataType): Promise<Array<Pick<GlobalData, 'type' | 'title' | 'payload'> & { updatedAt: string }>> {
        const rows = await this.prisma.globalData.findMany({
            where: { active: true, ...(type ? { type } : {}) },
            orderBy: [{ type: 'asc' }, { updatedAt: 'desc' }],
            take: MAX_ITEMS
        });
        return rows.map((row) => ({
            type: row.type as GlobalDataType,
            title: row.title,
            payload: (row.payload as GlobalData['payload']) ?? null,
            updatedAt: row.updatedAt.toISOString()
        }));
    }
}

function toDomain(row: GlobalDataRow): GlobalData {
    return {
        id: row.id,
        type: row.type,
        title: row.title,
        payload: (row.payload as GlobalData['payload']) ?? null,
        active: row.active,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}
