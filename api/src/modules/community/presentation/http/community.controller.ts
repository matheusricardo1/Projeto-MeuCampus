import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AcademicAuthGuard } from '@auth/presentation/http/guards/academic-auth.guard';
import type { AcademicCredentials } from '@auth/domain/entities/academic-session.entity';
import { pseudonymousUserId } from '@/shared/security/pseudonymous-user-id';
import { CommunityPostRepository } from '@community/infrastructure/prisma/community-post.repository';
import { isCommunityCategory, type CommunityCategory, type CommunityPost } from '@community/domain/community-post.entity';

const MAX_BODY_LENGTH = 500;
const MAX_NAME_LENGTH = 120;
const MAX_PAYLOAD_JSON_LENGTH = 2000;

interface RequestWithAcademicCredentials extends Request {
    academicCredentials?: AcademicCredentials;
}

interface CreatePostRequest {
    category?: string;
    body?: string;
    authorName?: string;
    payload?: Record<string, unknown> | null;
}

/**
 * The Comunidade board. Reports are authored under a server-authenticated
 * pseudonym (pseudonymousUserId of the session CPF, same scheme as User.id), so
 * ownership, dedup and moderation are trustworthy; only the display name is a
 * client-provided snapshot (see the identity note in the plan).
 */
@Controller('community')
@UseGuards(AcademicAuthGuard)
export class CommunityController {
    constructor(private readonly posts: CommunityPostRepository) {}

    @Get('posts')
    async listPosts(@Query('category') category?: string) {
        const parsed = this.parseOptionalCategory(category);
        const posts = await this.posts.listByCategory(parsed);
        return posts.map((post) => this.toResponse(post));
    }

    @Post('posts')
    @HttpCode(201)
    async createPost(@Req() request: RequestWithAcademicCredentials, @Body() body: CreatePostRequest) {
        const authorId = pseudonymousUserId(this.requireCpf(request));

        if (!isCommunityCategory(body?.category)) {
            throw new BadRequestException('Categoria invalida.');
        }

        const text = (body?.body ?? '').trim();
        if (!text) {
            throw new BadRequestException('O relato nao pode estar vazio.');
        }
        if (text.length > MAX_BODY_LENGTH) {
            throw new BadRequestException(`O relato deve ter no maximo ${MAX_BODY_LENGTH} caracteres.`);
        }

        const authorName = (body?.authorName ?? '').trim().slice(0, MAX_NAME_LENGTH) || 'Aluno(a) UFAM';
        const payload = this.sanitizePayload(body?.payload);

        const post = await this.posts.create({
            authorId,
            authorName,
            category: body.category,
            body: text,
            payload
        });

        return this.toResponse(post);
    }

    @Post('posts/:id/confirm')
    @HttpCode(200)
    async confirmPost(@Req() request: RequestWithAcademicCredentials, @Param('id') id: string) {
        const userId = pseudonymousUserId(this.requireCpf(request));
        return this.posts.confirm(id, userId);
    }

    @Delete('posts/:id')
    @HttpCode(200)
    async deletePost(@Req() request: RequestWithAcademicCredentials, @Param('id') id: string) {
        const authorId = pseudonymousUserId(this.requireCpf(request));
        const deleted = await this.posts.deleteOwnedBy(id, authorId);
        if (!deleted) {
            throw new ForbiddenException('Voce so pode apagar os proprios relatos.');
        }
        return { status: 'ok' };
    }

    private parseOptionalCategory(category?: string): CommunityCategory | undefined {
        if (!category) {
            return undefined;
        }
        if (!isCommunityCategory(category)) {
            throw new BadRequestException('Categoria invalida.');
        }
        return category;
    }

    // payload is category-specific structured JSON built by the client. We don't
    // enforce a per-category schema server-side (MVP), but we do reject anything
    // that isn't a plain object or is unreasonably large, to keep the column sane.
    private sanitizePayload(payload: unknown): Record<string, unknown> | null {
        if (payload === null || payload === undefined) {
            return null;
        }
        if (typeof payload !== 'object' || Array.isArray(payload)) {
            throw new BadRequestException('Dados do post invalidos.');
        }
        if (JSON.stringify(payload).length > MAX_PAYLOAD_JSON_LENGTH) {
            throw new BadRequestException('Dados do post muito longos.');
        }
        return payload as Record<string, unknown>;
    }

    private requireCpf(request: RequestWithAcademicCredentials): string {
        const cpf = request.academicCredentials?.cpf;
        if (!cpf) {
            throw new BadRequestException('Sessao invalida.');
        }
        return cpf;
    }

    // Never expose authorId (the pseudonym) to clients — only the display name.
    private toResponse(post: CommunityPost) {
        return {
            id: post.id,
            authorName: post.authorName,
            category: post.category,
            body: post.body,
            payload: post.payload,
            confirmCount: post.confirmCount,
            createdAt: post.createdAt.toISOString()
        };
    }
}
