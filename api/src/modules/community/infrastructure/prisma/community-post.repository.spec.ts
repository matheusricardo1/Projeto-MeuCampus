import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { CommunityPostRepository } from '@community/infrastructure/prisma/community-post.repository';
import type { PrismaService } from '@/shared/prisma/prisma.service';

function buildPrisma(overrides: Record<string, unknown> = {}) {
    return {
        communityPost: {
            create: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
            update: vi.fn(),
            updateMany: vi.fn(),
            findUnique: vi.fn(),
            deleteMany: vi.fn()
        },
        communityConfirmation: {
            create: vi.fn()
        },
        $transaction: vi.fn(),
        ...overrides
    } as unknown as PrismaService;
}

const baseRow = {
    id: 'p1',
    authorId: 'author-hash',
    authorName: 'Aluno UFAM',
    category: 'FILA_RU',
    status: 'APPROVED',
    body: 'RU vazio agora',
    payload: { level: 'empty' },
    confirmCount: 0,
    createdAt: new Date('2026-07-16T12:00:00Z')
};

describe('CommunityPostRepository', () => {
    let prisma: PrismaService;
    let repo: CommunityPostRepository;

    beforeEach(() => {
        prisma = buildPrisma();
        repo = new CommunityPostRepository(prisma);
    });

    it('creates a post and never leaks authorId back through the domain shape unexpectedly', async () => {
        (prisma.communityPost.create as any).mockResolvedValue(baseRow);

        const post = await repo.create({
            authorId: 'author-hash',
            authorName: 'Aluno UFAM',
            category: 'FILA_RU',
            body: 'RU vazio agora',
            payload: { level: 'empty' }
        });

        expect(post.id).toBe('p1');
        expect(post.category).toBe('FILA_RU');
        expect(post.status).toBe('APPROVED');
        expect(post.payload).toEqual({ level: 'empty' });
    });

    it('auto-approves real-time signals but leaves announcements pending', async () => {
        (prisma.communityPost.create as any).mockResolvedValue(baseRow);

        await repo.create({ authorId: 'a', authorName: 'n', category: 'FILA_RU', body: 'RU cheio' });
        await repo.create({ authorId: 'a', authorName: 'n', category: 'COMIDAS', body: 'Brigadeiro' });

        expect((prisma.communityPost.create as any).mock.calls[0][0].data.status).toBe('APPROVED');
        expect((prisma.communityPost.create as any).mock.calls[1][0].data.status).toBe('PENDING');
    });

    it('omits payload from the create data when none is provided', async () => {
        (prisma.communityPost.create as any).mockResolvedValue({ ...baseRow, payload: null });

        await repo.create({ authorId: 'a', authorName: 'n', category: 'BOLSA', body: 'caiu' });

        const arg = (prisma.communityPost.create as any).mock.calls[0][0];
        expect('payload' in arg.data).toBe(false);
    });

    it('filters the feed by category and freshness window', async () => {
        await repo.listByCategory('FILA_RU');

        const arg = (prisma.communityPost.findMany as any).mock.calls[0][0];
        expect(arg.where.status).toBe('APPROVED');
        expect(arg.where.category).toBe('FILA_RU');
        expect(arg.where.createdAt.gte).toBeInstanceOf(Date);
        expect(arg.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('lists pending posts oldest-first for the moderation queue', async () => {
        await repo.listPending();

        const arg = (prisma.communityPost.findMany as any).mock.calls[0][0];
        expect(arg.where).toEqual({ status: 'PENDING' });
        expect(arg.orderBy).toEqual({ createdAt: 'asc' });
    });

    it('sets a post status and reports whether a row was updated', async () => {
        (prisma.communityPost.updateMany as any).mockResolvedValue({ count: 1 });
        expect(await repo.setStatus('p1', 'APPROVED')).toBe(true);
        const arg = (prisma.communityPost.updateMany as any).mock.calls[0][0];
        expect(arg).toEqual({ where: { id: 'p1' }, data: { status: 'APPROVED' } });

        (prisma.communityPost.updateMany as any).mockResolvedValue({ count: 0 });
        expect(await repo.setStatus('missing', 'REJECTED')).toBe(false);
    });

    it('confirms a report inside a transaction and returns the new count', async () => {
        (prisma.$transaction as any).mockResolvedValue([{}, { confirmCount: 3 }]);

        const result = await repo.confirm('p1', 'user-hash');

        expect(result).toEqual({ confirmCount: 3 });
        expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('treats a duplicate confirmation (P2002) as a no-op and returns the existing count', async () => {
        (prisma.$transaction as any).mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '6' })
        );
        (prisma.communityPost.findUnique as any).mockResolvedValue({ confirmCount: 5 });

        const result = await repo.confirm('p1', 'user-hash');

        expect(result).toEqual({ confirmCount: 5 });
    });

    it('deletes only posts owned by the requester', async () => {
        (prisma.communityPost.deleteMany as any).mockResolvedValue({ count: 1 });

        const deleted = await repo.deleteOwnedBy('p1', 'author-hash');

        expect(deleted).toBe(true);
        const arg = (prisma.communityPost.deleteMany as any).mock.calls[0][0];
        expect(arg.where).toEqual({ id: 'p1', authorId: 'author-hash' });
    });

    it('reports not-deleted when the requester is not the author', async () => {
        (prisma.communityPost.deleteMany as any).mockResolvedValue({ count: 0 });

        expect(await repo.deleteOwnedBy('p1', 'someone-else')).toBe(false);
    });
});
