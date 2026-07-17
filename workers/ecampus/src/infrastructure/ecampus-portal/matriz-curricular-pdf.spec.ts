import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMatrizCurricularPdf } from '@/infrastructure/ecampus-portal/matriz-curricular-pdf';

// The sample report (a real student's curriculum) lives under docs/, which is
// gitignored — so these tests only run where the fixture is present and skip
// (rather than fail) on fresh clones / CI.
const pdfPath = join(__dirname, '../../../docs/report.pdf');
const pdf = existsSync(pdfPath) ? readFileSync(pdfPath) : null;
// Non-null for ergonomics inside the blocks below — they only run (via
// describeWithFixture) when `pdf` is present, so the cast is never observed null.
const matriz = (pdf ? parseMatrizCurricularPdf(pdf) : null)!;
const describeWithFixture = pdf ? describe : describe.skip;

function findDisciplina(codigo: string) {
    for (const cat of matriz!.categorias) {
        const found = cat.disciplinas.find((d) => d.codigo === codigo);
        if (found) return { ...found, categoria: cat.nome };
    }
    return null;
}

describeWithFixture('parseMatrizCurricularPdf: header metadata', () => {
    it('extracts course, version and situation', () => {
        expect(matriz.curso).toContain('Engenharia de Software');
        expect(matriz.versao).toBe('2025/2');
        expect(matriz.situacao).toBe('Corrente');
        expect(matriz.grau).toContain('Bacharel');
    });
});

describeWithFixture('parseMatrizCurricularPdf: categorias', () => {
    it('finds the four report sections', () => {
        const names = matriz.categorias.map((c) => c.nome);
        expect(names).toContain('OBRIGATÓRIAS');
        expect(names).toContain('ELETIVAS');
        expect(names).toContain('OPTATIVAS');
        expect(names).toContain('ATIVIDADE CURRICULAR DE EXTENSÃO');
    });

    it('parses a healthy number of disciplinas', () => {
        expect(matriz.totalDisciplinas).toBeGreaterThan(100);
    });
});

describeWithFixture('parseMatrizCurricularPdf: column mapping', () => {
    it('maps an obrigatória with theory + practice hours', () => {
        const icc001 = findDisciplina('ICC001');
        expect(icc001).not.toBeNull();
        expect(icc001!.categoria).toBe('OBRIGATÓRIAS');
        expect(icc001!.periodo).toBe(1);
        expect(icc001!.nome).toBe('INTRODUÇÃO À COMPUTAÇÃO');
        expect(icc001!.creditos).toBe(5);
        expect(icc001!.cargaHoraria).toEqual({ teorica: 60, pratica: 30, extensao: 0, total: 90 });
        expect(icc001!.preRequisitos).toEqual([]);
    });

    it('maps an extension activity (extension hours only, no theory/practice)', () => {
        const icc606 = findDisciplina('ICC606');
        expect(icc606).not.toBeNull();
        expect(icc606!.cargaHoraria).toEqual({ teorica: 0, pratica: 0, extensao: 90, total: 90 });
        expect(icc606!.creditos).toBe(6);
        expect(icc606!.preRequisitos).toEqual(['ICC001']);
    });

    it('captures a disciplina with a pre-requisito', () => {
        const icc002 = findDisciplina('ICC002');
        expect(icc002).not.toBeNull();
        expect(icc002!.preRequisitos).toContain('ICC001');
    });

    it('merges multi-line pre-requisitos into the same disciplina', () => {
        // ICC041 lists two pre-reqs (ICC003 then ICC120 on a continuation line).
        const icc041 = findDisciplina('ICC041');
        expect(icc041).not.toBeNull();
        expect(icc041!.preRequisitos).toEqual(expect.arrayContaining(['ICC003', 'ICC120']));
    });
});

describeWithFixture('parseMatrizCurricularPdf: integrity', () => {
    it('every disciplina has total = teorica + pratica + extensao', () => {
        const broken: string[] = [];
        for (const cat of matriz.categorias) {
            for (const d of cat.disciplinas) {
                const { teorica, pratica, extensao, total } = d.cargaHoraria;
                if (teorica + pratica + extensao !== total) {
                    broken.push(`${d.codigo}: ${teorica}+${pratica}+${extensao} != ${total}`);
                }
            }
        }
        expect(broken).toEqual([]);
    });

    it('every disciplina has a plausible code and name', () => {
        for (const cat of matriz.categorias) {
            for (const d of cat.disciplinas) {
                expect(d.codigo).toMatch(/^(?:[A-Z]{2,5}\d{2,4}|ENADE\d+)$/);
                expect(d.nome.length).toBeGreaterThan(0);
            }
        }
    });
});
