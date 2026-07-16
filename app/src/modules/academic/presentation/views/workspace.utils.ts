import { useEffect, useRef, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import type { Translate, TranslationKey } from '@/shared/i18n/languages';
import type { Workspace } from '@/modules/academic/presentation/views/workspace.types';
import { styles } from '@/modules/academic/presentation/views/workspace.styles';

export type ResponsiveLayout = {
    width: number;
    isTablet: boolean;
    isDesktop: boolean;
    isCompactPhone: boolean;
    pagePadding: number;
    showBottomNav: boolean;
    contentMaxWidth: number;
    loginMaxWidth: number;
    isMobileWeb: boolean;
};

// Counts a number up from 0 to its target whenever the target changes (e.g. a
// stat swapping in from the skeleton, or refreshing after a pull-to-refresh).
// Driven by requestAnimationFrame with manual timing rather than Animated,
// since the output here is a plain number consumed in text/width — there's no
// native-driver value to hand off to, so RAF is the more direct tool.
export function useCountUp(target: number | null, duration = 1000): number | null {
    // Starts at 0 (not the target) so the very first render doesn't flash the
    // final value before the animation below takes over on the next tick.
    const [value, setValue] = useState<number | null>(() => (target === null ? null : 0));
    const previousTargetRef = useRef<number | null>(null);

    useEffect(() => {
        if (target === null) {
            setValue(null);
            previousTargetRef.current = null;
            return undefined;
        }

        const startValue = previousTargetRef.current ?? 0;
        previousTargetRef.current = target;

        if (startValue === target) {
            setValue(target);
            return undefined;
        }

        let frameId: number;
        const startTime = Date.now();

        const tick = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(1, elapsed / duration);
            const eased = 1 - (1 - progress) ** 3;
            setValue(startValue + (target - startValue) * eased);

            if (progress < 1) frameId = requestAnimationFrame(tick);
        };

        frameId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frameId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [target, duration]);

    return value;
}

export function getInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    return `${words[0]?.[0] || 'U'}${words[1]?.[0] || 'A'}`.toUpperCase();
}

export function toTitleName(value: string): string {
    return value
        .toLocaleLowerCase('pt-BR')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/(^|[\s'-])([\p{L}])/gu, (_, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase('pt-BR')}`);
}

// Course/subject codes from eCampus end in a Roman numeral revision ("... II",
// "... III") — plain title-casing lowercases every letter but the first, so
// "II" becomes "Ii". This whitelist is intentionally capped at XX: course
// numbering never goes higher, and matching a generic Roman-numeral regex
// against arbitrary Portuguese words produces false positives (e.g. "MIL").
const ROMAN_NUMERALS = new Set([
    'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
    'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'
]);
// Portuguese minor words that stay lowercase mid-title (but not at the edges).
const LOWERCASE_CONNECTORS = new Set(['a', 'ao', 'aos', 'as', 'com', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'o', 'os', 'para', 'um', 'uma']);

// eCampus subject names are sometimes scraped without diacritics ("INTRODUCAO A
// ORGANIZACAO DE COMPUTADORES"). This is a curated (not exhaustive) dictionary
// of common Brazilian academic vocabulary, keyed by the accent-stripped
// uppercase form, so the correct pt-BR accents can be restored automatically.
const ACCENTED_WORDS: Record<string, string> = {
    ADMINISTRACAO: 'administração', ALGEBRA: 'álgebra', ANALISE: 'análise', ANALISES: 'análises',
    ANALITICA: 'analítica', ANALITICO: 'analítico', ARQUEOLOGICA: 'arqueológica', ARTISTICA: 'artística',
    ARTISTICO: 'artístico', ATOMICA: 'atômica', ATOMICO: 'atômico', AUTOMATICA: 'automática',
    AUTOMATICO: 'automático', AUTOMATOS: 'autômatos', BASICA: 'básica', BASICO: 'básico',
    BIOLOGICA: 'biológica', BIOLOGICO: 'biológico', BIOQUIMICA: 'bioquímica', CALCULO: 'cálculo',
    CARDIOLOGICA: 'cardiológica', CERAMICA: 'cerâmica', CIENCIA: 'ciência', CIENCIAS: 'ciências',
    CINETICA: 'cinética', CIRURGICA: 'cirúrgica', CLASSICA: 'clássica', CLASSICO: 'clássico',
    CLINICA: 'clínica', CLINICO: 'clínico', COMUNICACAO: 'comunicação', CONTEMPORANEA: 'contemporânea',
    CRITICA: 'crítica', CRITICO: 'crítico', DEMOGRAFICA: 'demográfica', DIAGNOSTICO: 'diagnóstico',
    DIDATICA: 'didática', DIDATICO: 'didático', DINAMICA: 'dinâmica', DINAMICO: 'dinâmico',
    DISTRIBUIDA: 'distribuída', DISTRIBUIDOS: 'distribuídos', ECONOMICA: 'econômica', ECONOMICO: 'econômico',
    EDUCACAO: 'educação', ELETRICA: 'elétrica', ELETRICO: 'elétrico', ELETROMAGNETICA: 'eletromagnética',
    ELETROMAGNETICO: 'eletromagnético', ELETRONICA: 'eletrônica', ELETRONICO: 'eletrônico',
    ENERGETICA: 'energética', EPIDEMIOLOGICA: 'epidemiológica', EQUACOES: 'equações', ESPECIFICA: 'específica',
    ESPECIFICO: 'específico', ESTATISTICA: 'estatística', ESTATISTICO: 'estatístico', ESTRATEGICA: 'estratégica',
    ESTRATEGICO: 'estratégico', ETICA: 'ética', ETICO: 'ético', FILOSOFICA: 'filosófica', FISICA: 'física',
    FISICO: 'físico', FONETICA: 'fonética', FUNCOES: 'funções', GENETICA: 'genética', GENETICO: 'genético',
    GEOGRAFICA: 'geográfica', GEOMETRICA: 'geométrica', GEOMETRICO: 'geométrico', GESTAO: 'gestão',
    GRAFICA: 'gráfica', GRAFICO: 'gráfico', GRAFICOS: 'gráficos', HERANCA: 'herança', HIDRAULICA: 'hidráulica',
    HISTOLOGICA: 'histológica', HISTORIA: 'história', HISTORICA: 'histórica', HISTORICO: 'histórico',
    HOLISTICA: 'holística', HUMANISTICA: 'humanística', INDUSTRIA: 'indústria', INFORMATICA: 'informática',
    INTEGRACAO: 'integração', INTELIGENCIA: 'inteligência', INTRODUCAO: 'introdução', JURIDICA: 'jurídica',
    JURIDICO: 'jurídico', LEGISLACAO: 'legislação', LINGUISTICA: 'linguística', LOGICA: 'lógica',
    LOGICO: 'lógico', MAGNETICA: 'magnética', MAGNETICO: 'magnético', MATEMATICA: 'matemática',
    MATEMATICO: 'matemático', MECANICA: 'mecânica', MECANICO: 'mecânico', MEDICA: 'médica', MEDICO: 'médico',
    NUCLEAR: 'nuclear', NUMERICA: 'numérica', NUMERICO: 'numérico', NUTRICAO: 'nutrição', OPERACAO: 'operação',
    OPERACOES: 'operações', OPTICA: 'óptica', ORGANICA: 'orgânica', ORGANICO: 'orgânico',
    ORGANIZACAO: 'organização', OTICA: 'ótica', OTIMIZACAO: 'otimização', PEDAGOGICA: 'pedagógica',
    PEDIATRICA: 'pediátrica', POLIMEROS: 'polímeros', POLITICA: 'política', POLITICAS: 'políticas',
    PRATICA: 'prática', PRATICO: 'prático', PROBABILISTICA: 'probabilística', PSICOLOGICA: 'psicológica',
    PSIQUIATRICA: 'psiquiátrica', PUBLICA: 'pública', PUBLICO: 'público', QUANTICA: 'quântica',
    QUANTICO: 'quântico', QUIMICA: 'química', QUIMICO: 'químico', RADIOLOGICA: 'radiológica', SAUDE: 'saúde',
    SANITARIA: 'sanitária', SEGURANCA: 'segurança', SIMULACAO: 'simulação', SISMICA: 'sísmica',
    SISTEMATICA: 'sistemática', SOCIOECONOMICA: 'socioeconômica', SOCIOLOGICA: 'sociológica',
    TECNICA: 'técnica', TECNICAS: 'técnicas', TECNICO: 'técnico', TECNICOS: 'técnicos',
    TECNOLOGICA: 'tecnológica', TECNOLOGICO: 'tecnológico', TELECOMUNICACOES: 'telecomunicações',
    TEORICA: 'teórica', TEORICO: 'teórico', TERAPEUTICA: 'terapêutica', TERMICA: 'térmica', TERMICO: 'térmico',
    TERMODINAMICA: 'termodinâmica', TOPICOS: 'tópicos', TRANSICAO: 'transição', URBANISTICA: 'urbanística',
    VARIAVEIS: 'variáveis', VARIAVEL: 'variável'
};

function stripAccentsUpper(word: string): string {
    return word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

export function toSubjectTitle(value: string): string {
    const words = value.toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim().split(' ');
    return words
        .map((word, index) => {
            if (!word) return word;

            const upperWord = word.toUpperCase();
            if (ROMAN_NUMERALS.has(upperWord)) return upperWord;

            const resolvedWord = ACCENTED_WORDS[stripAccentsUpper(word)] ?? word;

            const isEdgeWord = index === 0 || index === words.length - 1;
            if (!isEdgeWord && LOWERCASE_CONNECTORS.has(resolvedWord)) return resolvedWord;

            return resolvedWord.charAt(0).toLocaleUpperCase('pt-BR') + resolvedWord.slice(1);
        })
        .join(' ');
}

export function onlyDigits(value: string): string {
    return value.replace(/\D/g, '');
}

export function formatCpf(value: string): string {
    const digits = onlyDigits(value).slice(0, 11);
    const firstPart = digits.slice(0, 3);
    const secondPart = digits.slice(3, 6);
    const thirdPart = digits.slice(6, 9);
    const verifier = digits.slice(9, 11);

    if (digits.length > 9) return `${firstPart}.${secondPart}.${thirdPart}-${verifier}`;
    if (digits.length > 6) return `${firstPart}.${secondPart}.${thirdPart}`;
    if (digits.length > 3) return `${firstPart}.${secondPart}`;
    return firstPart;
}

export function groupScheduleByDay(schedule: Workspace['schedule']) {
    const groups = new Map<string, Workspace['schedule']>();
    for (const item of schedule) {
        groups.set(item.weekday, [...(groups.get(item.weekday) || []), item]);
    }
    return Array.from(groups.entries()).map(([weekday, items]) => ({ weekday, items }));
}

export function buildWeekMap(groupedSchedule: Array<{ weekday: string; items: Workspace['schedule'] }>, t?: Translate) {
    const weekdays = [
        { weekday: 'Monday', labelKey: 'weekday.monday', shortKey: 'weekday.mondayShort' },
        { weekday: 'Tuesday', labelKey: 'weekday.tuesday', shortKey: 'weekday.tuesdayShort' },
        { weekday: 'Wednesday', labelKey: 'weekday.wednesday', shortKey: 'weekday.wednesdayShort' },
        { weekday: 'Thursday', labelKey: 'weekday.thursday', shortKey: 'weekday.thursdayShort' },
        { weekday: 'Friday', labelKey: 'weekday.friday', shortKey: 'weekday.fridayShort' },
        { weekday: 'Saturday', labelKey: 'weekday.saturday', shortKey: 'weekday.saturdayShort' },
        { weekday: 'Sunday', labelKey: 'weekday.sunday', shortKey: 'weekday.sundayShort' }
    ];
    return weekdays.map((day) => ({
        weekday: day.weekday,
        label: t ? t(day.labelKey as TranslationKey) : defaultWeekdayLabel(day.weekday),
        short: t ? t(day.shortKey as TranslationKey) : defaultWeekdayShort(day.weekday),
        items: groupedSchedule.find((group) => group.weekday === day.weekday)?.items || []
    }));
}

export function getNextScheduleClass(schedule: Workspace['schedule'], t?: Translate) {
    const now = new Date();
    const currentDay = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const candidates = schedule
        .map((item) => {
            const dayIndex = getWeekdayIndex(item.weekday);
            if (dayIndex === null) return null;

            const startMinutes = parseTimeToMinutes(item.start_time);
            const endMinutes = parseTimeToMinutes(item.end_time);
            if (startMinutes === null || endMinutes === null) return null;

            const isToday = dayIndex === currentDay;
            const isHappening = isToday && currentMinutes >= startMinutes && currentMinutes < endMinutes;
            let daysUntil = (dayIndex - currentDay + 7) % 7;
            if (isToday && currentMinutes >= endMinutes) daysUntil = 7;

            const nextDate = new Date(now);
            nextDate.setDate(now.getDate() + daysUntil);
            nextDate.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);

            return { item, isHappening, label: translateWeekday(item.weekday, t), timestamp: isHappening ? now.getTime() : nextDate.getTime() };
        })
        .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
        .sort((a, b) => a.timestamp - b.timestamp);

    return candidates[0] || null;
}

export function getWeekdayIndex(weekday: string): number | null {
    const map: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
    return map[weekday] ?? null;
}

export function parseTimeToMinutes(value: string): number | null {
    const match = value.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return hours * 60 + minutes;
}

export function translateWeekday(weekday: string, t?: Translate): string {
    if (!t) return defaultWeekdayLabel(weekday);

    const map: Record<string, TranslationKey> = {
        Monday: 'weekday.monday',
        Tuesday: 'weekday.tuesday',
        Wednesday: 'weekday.wednesday',
        Thursday: 'weekday.thursday',
        Friday: 'weekday.friday',
        Saturday: 'weekday.saturday',
        Sunday: 'weekday.sunday'
    };
    return map[weekday] ? t(map[weekday]) : weekday;
}

function defaultWeekdayLabel(weekday: string): string {
    const map: Record<string, string> = { Monday: 'Segunda', Tuesday: 'Terça', Wednesday: 'Quarta', Thursday: 'Quinta', Friday: 'Sexta', Saturday: 'Sábado', Sunday: 'Domingo' };
    return map[weekday] || weekday;
}

function defaultWeekdayShort(weekday: string): string {
    const map: Record<string, string> = { Monday: 'Seg', Tuesday: 'Ter', Wednesday: 'Qua', Thursday: 'Qui', Friday: 'Sex', Saturday: 'Sáb', Sunday: 'Dom' };
    return map[weekday] || weekday;
}

export function parseGrade(value: string): number | null {
    const normalized = value.replace(',', '.').trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

// Truncates (does not round) to `decimals` places, matching how eCampus shows
// grades: 6.995 stays "6.99", never "7.00". The tiny relative nudge only
// counters binary FP under-representation — so a true 7.00 stored as
// 6.9999999… isn't chopped down to 6.99 — without being large enough to lift a
// genuine 6.995 up to 7.00.
export function truncateToDecimals(value: number, decimals = 2): number {
    if (!Number.isFinite(value)) return value;
    const factor = 10 ** decimals;
    const scaled = Math.abs(value) * factor;
    const truncated = Math.floor(scaled + scaled * Number.EPSILON * 4);
    return (Math.sign(value) * truncated) / factor;
}

// Fixed-decimal string for grades, truncated like eCampus so the app never
// shows a value a hundredth off from the portal.
export function formatGrade(value: number, decimals = 2): string {
    return truncateToDecimals(value, decimals).toFixed(decimals);
}

export function parseAbsences(value: string): number {
    const parsed = Number(value.replace(/\D/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
}

export function isApprovedStatus(status: string): boolean {
    const normalized = status.toLowerCase();
    return normalized.includes('aprov') || normalized === 'ap';
}

export function isFinalExamWaived(mee: number | null, pf: number | null, hasEnoughPresence: boolean): boolean {
    return mee !== null && mee >= 8 && hasEnoughPresence && (pf === null || pf === mee);
}

export function formatWorkload(workload: string | number): string {
    if (typeof workload === 'number') return `${workload}h`;
    if (!workload) return '-';
    return workload.endsWith('h') ? workload : `${workload}h`;
}

export function useResponsiveLayout(): ResponsiveLayout {
    const { width } = useWindowDimensions();
    return getResponsiveLayout(width);
}

export function getResponsiveLayout(width: number): ResponsiveLayout {
    const safeWidth = Number.isFinite(width) ? width : 390;
    const isTablet = safeWidth >= 768;
    const isDesktop = safeWidth >= 1024;
    const isCompactPhone = safeWidth < 380;
    const pagePadding = isDesktop ? 32 : isTablet ? 24 : isCompactPhone ? 12 : 18;
    const isMobileWeb = Platform.OS === 'web' && safeWidth <= 768;
    return {
        width: safeWidth,
        isTablet,
        isDesktop,
        isCompactPhone,
        pagePadding,
        showBottomNav: !isTablet,
        contentMaxWidth: isDesktop ? 960 : isTablet ? 760 : 640,
        loginMaxWidth: isTablet ? 920 : 460,
        isMobileWeb
    };
}

export function getResponsiveCardStyle(layout: ResponsiveLayout, columns: number) {
    if (!layout.isTablet) return { flexBasis: columns >= 4 ? '47%' : '100%' } as const;
    if (columns === 2) return { flexBasis: '48%' } as const;
    if (columns === 3) return { flexBasis: layout.isDesktop ? '31.5%' : '48%' } as const;
    return { flexBasis: layout.isDesktop ? '23.4%' : '31.5%' } as const;
}

export function eventTone(index: number) {
    const tones = [styles.eventToneGreen, styles.eventToneBlue, styles.eventToneAmber, styles.eventToneCoral];
    return tones[index % tones.length];
}

export function gradeToneStyle(status: string) {
    const normalized = status.toLowerCase();
    if (normalized.includes('aprov')) return styles.statusOk;
    if (normalized.includes('reprov')) return styles.statusDanger;
    return styles.statusWarn;
}
