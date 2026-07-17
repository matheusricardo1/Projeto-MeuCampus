import type { EcampusRepository } from '@/domain/repositories/ecampus.repository';
import type { EcampusSessionStore } from '@/application/ports/ecampus-session-store';
import type { EcampusCredentials } from '@/domain/value-objects/ecampus-credentials';
import type { MatrizCurricular } from '@/domain/entities/matriz-curricular';
import { ResourceNotFoundError } from '@/domain/exceptions/resource-not-found.error';
import { CacheAndPublishScrapedResource } from '@/application/services/cache-and-publish-scraped-resource.service';
import { appLogger as logger } from '@/infrastructure/logging/app-logger';

/** Ensino Superior - Graduação Regular. */
const DEFAULT_NIVEL_CURSO = '3';

/**
 * Fetches the curriculum matrix (matriz curricular) for the STUDENT'S OWN
 * course. The report endpoint is generic (any course/version), so we first
 * resolve the student's course by matching their profile course name against
 * the report's course list, then pick the current curriculum version.
 */
export class GetMatrizCurricularUseCase {
    constructor(
        private readonly repository: EcampusRepository,
        private readonly sessions: EcampusSessionStore,
        private readonly cacheAndPublish: CacheAndPublishScrapedResource
    ) {}

    async execute(credentials: EcampusCredentials): Promise<MatrizCurricular> {
        await this.sessions.assertActive(credentials.cpf);
        const { cursoId, versaoId } = await this.resolveStudentCourse(credentials);
        return this.cacheAndPublish.run(
            'matriz',
            credentials.cpf,
            this.repository.getMatrizCurricular(credentials, { nivelCurso: DEFAULT_NIVEL_CURSO, cursoId, versaoId })
        );
    }

    private async resolveStudentCourse(credentials: EcampusCredentials): Promise<{ cursoId: number; versaoId: number }> {
        const profile = await this.repository.getStudentProfile(credentials);
        const courseName = profile.academic?.course ?? '';
        if (!courseName) {
            throw new ResourceNotFoundError('Não foi possível identificar seu curso para buscar a matriz curricular.');
        }

        const cursos = await this.repository.listMatrizCursos(credentials, DEFAULT_NIVEL_CURSO);

        // Match by course CODE first (e.g. "IE17") — the profile course string
        // carries it (código + nome, like "IE17 - Engenharia de Software"), and
        // matching the código is exact/reliable. Only fall back to fuzzy name
        // matching when there's no code (or it isn't in the list).
        const courseCode = extractCourseCode(courseName);
        const byCode = courseCode
            ? cursos.find((c) => normalizeCode(c.codCurso) === courseCode)
            : undefined;
        const match = byCode ?? pickBestCourse(cursos, courseName);
        if (!match) {
            throw new ResourceNotFoundError(`Não encontrei seu curso (${courseCode ?? courseName}) na lista de cursos da matriz curricular.`);
        }

        const versoes = await this.repository.listMatrizVersoes(credentials, match.id);
        // Prefer the "CORRENTE" version; fall back to the admission-year match,
        // then to the first listed.
        const admissionYear = profile.academic?.admission_term?.match(/\b(19|20)\d{2}\b/)?.[0] ?? null;
        const corrente = versoes.find((v) => v.situacao.toUpperCase() === 'CORRENTE');
        const byAdmission = admissionYear ? versoes.find((v) => v.numVersao.startsWith(admissionYear)) : undefined;
        const versao = corrente ?? byAdmission ?? versoes[0];
        if (!versao) {
            throw new ResourceNotFoundError('Nenhuma versão de currículo encontrada para o seu curso.');
        }

        logger.info('Resolved student course for matriz curricular.', {
            courseName,
            matchedBy: byCode ? 'code' : 'name',
            codCurso: match.codCurso,
            cursoId: match.id,
            versaoId: versao.id,
            versao: versao.numVersao
        });
        return { cursoId: match.id, versaoId: versao.id };
    }
}

function normalizeCode(value: string): string {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Pulls the course code (e.g. "IE17") out of the profile course string. eCampus
 * shows it as "CODE - Nome" (e.g. "IE17 - Engenharia de Software"); we take the
 * leading token when it looks like a code, otherwise the first code-shaped token
 * anywhere. Returns null when there's no code to match on.
 */
function extractCourseCode(courseName: string): string | null {
    const head = courseName.split(/\s*[-–—]\s*/)[0]?.trim() ?? '';
    if (/^[A-Z]{2,3}\d{2,3}[A-Z]?$/i.test(head)) {
        return normalizeCode(head);
    }
    const match = courseName.match(/\b([A-Z]{2,3}\d{2,3}[A-Z]?)\b/i);
    return match ? normalizeCode(match[1]!) : null;
}

/** Normalizes for accent-insensitive, case-insensitive comparison. */
function normalize(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function pickBestCourse<T extends { id: number; codCurso: string; nome: string }>(cursos: T[], courseName: string): T | null {
    const target = normalize(courseName);
    const targetWords = new Set(target.split(' ').filter((w) => w.length > 2));

    let best: { curso: T; score: number } | null = null;
    for (const curso of cursos) {
        const name = normalize(curso.nome);
        let score = 0;
        if (name === target) score = 1000;
        else if (name.includes(target) || target.includes(name)) score = 500;
        else {
            const words = name.split(' ').filter((w) => w.length > 2);
            const shared = words.filter((w) => targetWords.has(w)).length;
            score = shared === 0 ? 0 : (shared / Math.max(words.length, targetWords.size)) * 100;
        }
        if (score > 0 && (!best || score > best.score)) {
            best = { curso, score };
        }
    }

    // Require a meaningful overlap to avoid returning an unrelated course.
    return best && best.score >= 40 ? best.curso : null;
}
