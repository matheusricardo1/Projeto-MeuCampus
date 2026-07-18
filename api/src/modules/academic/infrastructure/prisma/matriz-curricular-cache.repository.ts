import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/shared/prisma/prisma.service';
import type { MatrizCurricular } from '@academic/domain/entities/matriz-curricular.entity';

/**
 * Persistent cache-aside for the curriculum matrix, keyed by course code
 * (not by student) — see MatrizCurricularCache in schema.prisma for why.
 */
@Injectable()
export class MatrizCurricularCacheRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findByCodCurso(codCurso: string): Promise<MatrizCurricular | null> {
        const row = await this.prisma.matrizCurricularCache.findUnique({ where: { codCurso } });
        return row ? (row.payload as unknown as MatrizCurricular) : null;
    }

    async upsert(codCurso: string, matriz: MatrizCurricular): Promise<void> {
        const payload = matriz as unknown as Prisma.InputJsonValue;
        await this.prisma.matrizCurricularCache.upsert({
            where: { codCurso },
            create: { codCurso, payload },
            update: { payload }
        });
    }
}
