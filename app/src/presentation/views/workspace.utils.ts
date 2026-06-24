import { Platform, useWindowDimensions } from 'react-native';
import type { Workspace } from '@/presentation/views/workspace.types';
import { styles } from '@/presentation/views/workspace.styles';

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

export function buildWeekMap(groupedSchedule: Array<{ weekday: string; items: Workspace['schedule'] }>) {
    const weekdays = [
        { weekday: 'Monday', label: 'Segunda', short: 'Seg' },
        { weekday: 'Tuesday', label: 'Terca', short: 'Ter' },
        { weekday: 'Wednesday', label: 'Quarta', short: 'Qua' },
        { weekday: 'Thursday', label: 'Quinta', short: 'Qui' },
        { weekday: 'Friday', label: 'Sexta', short: 'Sex' },
        { weekday: 'Saturday', label: 'Sabado', short: 'Sab' },
        { weekday: 'Sunday', label: 'Domingo', short: 'Dom' }
    ];
    return weekdays.map((day) => ({ ...day, items: groupedSchedule.find((group) => group.weekday === day.weekday)?.items || [] }));
}

export function getNextScheduleClass(schedule: Workspace['schedule']) {
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

            return { item, isHappening, label: translateWeekday(item.weekday), timestamp: isHappening ? now.getTime() : nextDate.getTime() };
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

export function translateWeekday(weekday: string): string {
    const map: Record<string, string> = { Monday: 'Segunda', Tuesday: 'Terca', Wednesday: 'Quarta', Thursday: 'Quinta', Friday: 'Sexta', Saturday: 'Sabado', Sunday: 'Domingo' };
    return map[weekday] || weekday;
}

export function parseGrade(value: string): number | null {
    const normalized = value.replace(',', '.').trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

export function parseAbsences(value: string): number {
    const parsed = Number(value.replace(/\D/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
}

export function isApprovedStatus(status: string): boolean {
    const normalized = status.toLowerCase();
    return normalized.includes('aprov') || normalized === 'ap';
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
    const isTablet = false;
    const isDesktop = false;
    const isCompactPhone = safeWidth < 380;
    const pagePadding = isCompactPhone ? 12 : 18;
    const isMobileWeb = Platform.OS === 'web' && safeWidth <= 768;
    return { width: safeWidth, isTablet, isDesktop, isCompactPhone, pagePadding, showBottomNav: true, contentMaxWidth: 640, loginMaxWidth: 460, isMobileWeb };
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
