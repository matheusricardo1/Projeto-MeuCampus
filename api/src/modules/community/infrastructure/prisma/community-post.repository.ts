import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/shared/prisma/prisma.service';
import {
    COMMUNITY_FEED_WINDOW_HOURS,
    type CommunityCategory,
    type CommunityPost,
    type CreateCommunityPostInput
} from '@community/domain/community-post.entity';

interface CommunityPostRow {
    id: string;
    authorId: string;
    authorName: string;
    category: CommunityCategory;
    body: string;
    payload: Prisma.JsonValue | null;
    confirmCount: number;
    createdAt: Date;
}

const MAX_FEED_ITEMS = 50;

@Injectable()
export class CommunityPostRepository {
    constructor(private readonly prisma: PrismaService) {}

    async create(input: CreateCommunityPostInput): Promise<CommunityPost> {
        const row = await this.prisma.communityPost.create({
            data: {
                authorId: input.authorId,
                authorName: input.authorName,
                category: input.category,
                body: input.body,
                // Only set payload when present — exactOptionalPropertyTypes rejects
                // an explicit `undefined`, and null would clobber the JSON column.
                ...(input.payload ? { payload: input.payload as Prisma.InputJsonValue } : {})
            }
        });

        return toDomain(row);
    }

    /** Recent reports for a category (or all categories) within its freshness window. */
    async listByCategory(category?: CommunityCategory): Promise<CommunityPost[]> {
        const rows = await this.prisma.communityPost.findMany({
            where: this.freshnessWhere(category),
            orderBy: { createdAt: 'desc' },
            take: MAX_FEED_ITEMS
        });

        return rows.map(toDomain);
    }

    /**
     * Confirms a report, incrementing its counter at most once per user. Returns
     * the updated count. The unique (postId, userId) index makes a second
     * confirmation a no-op (P2002), so the counter stays honest.
     */
    async confirm(postId: string, userId: string): Promise<{ confirmCount: number }> {
        try {
            const [, post] = await this.prisma.$transaction([
                this.prisma.communityConfirmation.create({ data: { postId, userId } }),
                this.prisma.communityPost.update({
                    where: { id: postId },
                    data: { confirmCount: { increment: 1 } }
                })
            ]);

            return { confirmCount: post.confirmCount };
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                const post = await this.prisma.communityPost.findUnique({ where: { id: postId } });
                return { confirmCount: post?.confirmCount ?? 0 };
            }
            throw error;
        }
    }

    /** Deletes a post only if the requester is its author (minimal moderation). */
    async deleteOwnedBy(postId: string, authorId: string): Promise<boolean> {
        const result = await this.prisma.communityPost.deleteMany({ where: { id: postId, authorId } });
        return result.count > 0;
    }

    /**
     * Compact recent snapshot for the AI to reason over. Strips authorId — the
     * LLM never needs the internal pseudonym, only the public-facing fields.
     */
    async listRecentForAi(category?: CommunityCategory): Promise<Omit<CommunityPost, 'authorId'>[]> {
        const posts = await this.listByCategory(category);
        return posts.map(({ authorId: _authorId, ...rest }) => rest);
    }

    private freshnessWhere(category?: CommunityCategory): Prisma.CommunityPostWhereInput {
        if (category) {
            return { category, createdAt: { gte: windowStart(category) } };
        }

        // No category filter: apply each category's own window via an OR so a
        // stale RU report doesn't leak into the "everything" feed.
        return {
            OR: (Object.keys(COMMUNITY_FEED_WINDOW_HOURS) as CommunityCategory[]).map((cat) => ({
                category: cat,
                createdAt: { gte: windowStart(cat) }
            }))
        };
    }
}

function windowStart(category: CommunityCategory): Date {
    return new Date(Date.now() - COMMUNITY_FEED_WINDOW_HOURS[category] * 60 * 60 * 1000);
}

function toDomain(row: CommunityPostRow): CommunityPost {
    return {
        id: row.id,
        authorId: row.authorId,
        authorName: row.authorName,
        category: row.category,
        body: row.body,
        payload: (row.payload as CommunityPost['payload']) ?? null,
        confirmCount: row.confirmCount,
        createdAt: row.createdAt
    };
}
