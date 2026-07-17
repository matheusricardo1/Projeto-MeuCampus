import zlib from 'node:zlib';
import type {
    MatrizCargaHoraria,
    MatrizCategoria,
    MatrizCurricular,
    MatrizDisciplina
} from '@/domain/entities/matriz-curricular';

/**
 * Parses the "Matriz Curricular de Curso" PDF emitted by eCampus
 * (/reportMatrizCurso/index) into structured JSON.
 *
 * The report is a JasperReports/iText table. Its numeric columns are
 * right-aligned and blank cells are simply omitted, so the plain text stream
 * concatenates values ambiguously ("6" + "90" + "90"). To parse it reliably we
 * recover each cell's X position from the PDF text operators and map X to a
 * fixed column band — the only robust way to tell an empty TEOR from a filled
 * one. Column bands were derived from the header row anchors (see docs/report.pdf).
 */
export function parseMatrizCurricularPdf(pdf: Buffer): MatrizCurricular {
    const tokens = extractPositionedTokens(pdf);
    const rows = groupIntoRows(tokens);

    const meta = extractMetadata(rows);
    const categorias: MatrizCategoria[] = [];
    let current: MatrizCategoria | null = null;
    let lastDisciplina: MatrizDisciplina | null = null;

    for (const row of rows) {
        if (isHeaderOrMetaRow(row)) continue;

        const category = detectCategory(row);
        if (category) {
            current = { nome: category, disciplinas: [] };
            categorias.push(current);
            lastDisciplina = null;
            continue;
        }

        const cells = row.cells;
        const codeCell = cells.find((c) => inBand(c.x, 'COD') && isDisciplineCode(c.text));

        if (codeCell) {
            const disciplina = buildDisciplina(cells);
            if (!current) {
                current = { nome: 'DISCIPLINAS', disciplinas: [] };
                categorias.push(current);
            }
            current.disciplinas.push(disciplina);
            lastDisciplina = disciplina;
            continue;
        }

        // Continuation row: extra pre-requisitos for the previous disciplina
        // (a course with several pre-reqs lists each on its own line).
        if (lastDisciplina) {
            const extraPreReqs = cells
                .filter((c) => inBand(c.x, 'PRE_REQ') && isDisciplineCode(c.text))
                .map((c) => c.text);
            for (const code of extraPreReqs) {
                if (!lastDisciplina.preRequisitos.includes(code)) {
                    lastDisciplina.preRequisitos.push(code);
                }
            }
        }
    }

    const totalDisciplinas = categorias.reduce((sum, cat) => sum + cat.disciplinas.length, 0);
    return { ...meta, categorias, totalDisciplinas };
}

// ------------------------------------------------------------------ columns

// X bands (left edge of each right-aligned column). Derived from the report's
// header/data anchors; the gaps between numeric columns are wide enough that
// 2- to 4-digit right-aligned values never cross a boundary.
const BANDS = {
    PERIODO: [0, 60],
    COD: [60, 110],
    NOME: [110, 360],
    CRED: [360, 389],
    TEOR: [389, 417],
    PRAT: [417, 445],
    EXTE: [445, 473],
    TOTAL: [473, 506],
    PRE_REQ: [506, Infinity]
} as const;

function inBand(x: number, band: keyof typeof BANDS): boolean {
    const [min, max] = BANDS[band];
    return x >= min && x < max;
}

const CODE_RE = /^(?:[A-Z]{2,5}\d{2,4}|ENADE\d+)$/;

function isDisciplineCode(text: string): boolean {
    return CODE_RE.test(text.trim());
}

const CATEGORY_NAMES = new Set([
    'ATIVIDADE CURRICULAR DE EXTENSÃO',
    'ELETIVAS',
    'OBRIGATÓRIAS',
    'OPTATIVAS',
    'COMPLEMENTARES',
    'ATIVIDADES COMPLEMENTARES'
]);

function detectCategory(row: Row): string | null {
    const texts = row.cells.map((c) => c.text.trim()).filter(Boolean);
    if (texts.length === 1 && CATEGORY_NAMES.has(texts[0]!.toUpperCase())) {
        return texts[0]!.toUpperCase();
    }
    return null;
}

function isHeaderOrMetaRow(row: Row): boolean {
    const joined = row.cells.map((c) => c.text).join(' ');
    return /PERÍODO|CARGA HORÁRIA|NOME DA DISCIPLINA|Curso:|Grau de Curso:|Turno:|Vers[ãa]o:|Situa[çc][ãa]o:|Currículo de Curso|UNIVERSIDADE FEDERAL|autenticidade|Código de Autenticidade|Documento emitido|MÍNIMO DE|MÁXIMO DE|LIMITES NO|TOTAL DE CRÉDITOS|CRÉDITOS DE|^TOTAL$/i.test(joined)
        || /^TOTAL$/i.test(row.cells[0]?.text.trim() ?? '');
}

function buildDisciplina(cells: Cell[]): MatrizDisciplina {
    const pick = (band: keyof typeof BANDS): string | null => {
        const cell = cells.find((c) => inBand(c.x, band));
        return cell ? cell.text.trim() : null;
    };
    const num = (band: keyof typeof BANDS): number => {
        const raw = pick(band);
        const parsed = raw ? parseInt(raw.replace(/\D/g, ''), 10) : NaN;
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const cargaHoraria: MatrizCargaHoraria = {
        teorica: num('TEOR'),
        pratica: num('PRAT'),
        extensao: num('EXTE'),
        total: num('TOTAL')
    };

    const periodoRaw = pick('PERIODO');
    const periodo = periodoRaw && /^\d+$/.test(periodoRaw) ? parseInt(periodoRaw, 10) : null;
    const creditosRaw = pick('CRED');
    const creditos = creditosRaw && /^\d+$/.test(creditosRaw) ? parseInt(creditosRaw, 10) : null;

    // NOME can rarely arrive as more than one positioned fragment on the same
    // line — join them left-to-right.
    const nome = cells
        .filter((c) => inBand(c.x, 'NOME'))
        .map((c) => c.text.trim())
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    const preRequisitos = cells
        .filter((c) => inBand(c.x, 'PRE_REQ') && isDisciplineCode(c.text))
        .map((c) => c.text.trim());

    return {
        periodo,
        codigo: (pick('COD') ?? '').trim(),
        nome,
        creditos,
        cargaHoraria,
        preRequisitos
    };
}

function extractMetadata(rows: Row[]): Omit<MatrizCurricular, 'categorias' | 'totalDisciplinas'> {
    const meta = { curso: '', grau: '', turno: '', versao: '', situacao: '' };
    const after = (row: Row, label: string): string => {
        const cells = row.cells;
        const i = cells.findIndex((c) => c.text.trim().toUpperCase().startsWith(label.toUpperCase()));
        return i >= 0 && cells[i + 1] ? cells[i + 1]!.text.trim() : '';
    };

    for (const row of rows) {
        const joined = row.cells.map((c) => c.text).join(' ');
        if (/Curso:/i.test(joined) && !meta.curso) meta.curso = after(row, 'Curso:');
        if (/Versão:|Versao:/i.test(joined) && !meta.versao) meta.versao = after(row, 'Versão:') || after(row, 'Versao:');
        if (/Grau de Curso:/i.test(joined) && !meta.grau) meta.grau = after(row, 'Grau de Curso:');
        if (/Turno:/i.test(joined) && !meta.turno) meta.turno = after(row, 'Turno:');
        if (/Situação:|Situacao:/i.test(joined) && !meta.situacao) meta.situacao = after(row, 'Situação:') || after(row, 'Situacao:');
    }
    return meta;
}

// -------------------------------------------------------------- pdf plumbing

interface Cell { x: number; text: string; }
interface Row { page: number; y: number; cells: Cell[]; }

function groupIntoRows(tokens: Array<{ page: number; x: number; y: number; text: string }>): Row[] {
    const rows: Row[] = [];
    for (const t of tokens) {
        let row = rows.find((r) => r.page === t.page && Math.abs(r.y - t.y) < 4);
        if (!row) { row = { page: t.page, y: t.y, cells: [] }; rows.push(row); }
        row.cells.push({ x: t.x, text: t.text });
    }
    rows.sort((a, b) => (a.page - b.page) || (b.y - a.y));
    for (const row of rows) row.cells.sort((a, b) => a.x - b.x);
    return rows;
}

/** Recovers positioned text tokens ({page,x,y,text}) from the PDF's FlateDecode
 *  content streams by walking BT..ET text objects. */
function extractPositionedTokens(pdf: Buffer): Array<{ page: number; x: number; y: number; text: string }> {
    const tokens: Array<{ page: number; x: number; y: number; text: string }> = [];
    let page = 0;
    let idx = 0;

    while (true) {
        const s = pdf.indexOf('stream', idx);
        if (s === -1) break;
        let start = s + 6;
        if (pdf[start] === 0x0d) start++;
        if (pdf[start] === 0x0a) start++;
        const e = pdf.indexOf('endstream', start);
        if (e === -1) break;
        idx = e + 9;

        const raw = pdf.subarray(start, e);
        let data: Buffer;
        try { data = zlib.inflateSync(raw); }
        catch { try { data = zlib.inflateRawSync(raw); } catch { continue; } }

        const content = data.toString('latin1');
        if (!/(Tj|TJ)\b/.test(content)) continue;

        for (const block of content.split(/\bBT\b/).slice(1)) {
            const body = block.split(/\bET\b/)[0] ?? '';
            const tm = body.match(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Tm/);
            const x = tm ? parseFloat(tm[5]!) : 0;
            const y = tm ? parseFloat(tm[6]!) : 0;

            let text = '';
            const re = /\(((?:[^()\\]|\\.)*)\)\s*Tj|\[((?:[^\]\\]|\\.)*)\]\s*TJ/g;
            let m: RegExpExecArray | null;
            while ((m = re.exec(body)) !== null) {
                if (m[1] !== undefined) text += decodePdfString(m[1]);
                else {
                    const parts = m[2]!.match(/\(((?:[^()\\]|\\.)*)\)/g) ?? [];
                    for (const p of parts) text += decodePdfString(p.slice(1, -1));
                }
            }
            text = text.trim();
            if (text) tokens.push({ page, x, y, text });
        }
        page++;
    }

    return tokens;
}

function decodePdfString(s: string): string {
    return s
        .replace(/\\([0-7]{1,3})/g, (_, o: string) => String.fromCharCode(parseInt(o, 8)))
        .replace(/\\n/g, ' ')
        .replace(/\\r/g, '')
        .replace(/\\t/g, ' ')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\\\/g, '\\');
}
