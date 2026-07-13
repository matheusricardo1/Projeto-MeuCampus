import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BookOpen, Calculator, Clock3, GraduationCap, Lightbulb, MapPin, Terminal, Utensils } from 'lucide-react-native';
import { useLanguage } from '@/shared/i18n/language-provider';
import type { Workspace } from '@/modules/academic/presentation/views/workspace.types';
import { EmptyInline, SkeletonBlock, SkeletonCircle } from '@/modules/academic/presentation/views/components';
import { buildWeekMap, getNextScheduleClass, groupScheduleByDay, parseTimeToMinutes, toSubjectTitle } from '@/modules/academic/presentation/views/workspace.utils';
import { styles } from '@/modules/academic/presentation/views/workspace.styles';

const weekdayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;

export function SchedulePage({
    loading,
    schedule
}: {
    loading: boolean;
    onRefresh: () => Promise<void>;
    schedule: Workspace['schedule'];
}) {
    const { t } = useLanguage();
    const groupedSchedule = groupScheduleByDay(schedule);
    const weekMap = buildWeekMap(groupedSchedule, t).filter((day) => weekdayOrder.includes(day.weekday as typeof weekdayOrder[number]));
    const nextClass = getNextScheduleClass(schedule, t);
    const [selectedWeekday, setSelectedWeekday] = useState(nextClass?.item.weekday || weekMap.find((day) => day.items.length > 0)?.weekday || 'Monday');
    const weekDates = useMemo(() => buildCurrentWeekDates(), []);
    const selectedDay = weekMap.find((day) => day.weekday === selectedWeekday) || weekMap[0];
    const selectedItems = [...(selectedDay?.items || [])].sort((a, b) => (parseTimeToMinutes(a.start_time) || 0) - (parseTimeToMinutes(b.start_time) || 0));
    const beforeLunch = selectedItems.filter((item) => (parseTimeToMinutes(item.start_time) || 0) < 12 * 60);
    const afterLunch = selectedItems.filter((item) => (parseTimeToMinutes(item.start_time) || 0) >= 12 * 60);

    if (loading && schedule.length === 0) return <ScheduleSkeleton />;

    return (
        <View style={styles.schedulePage}>
            <View style={styles.scheduleDaySelector}>
                {weekMap.map((day) => {
                    const active = selectedWeekday === day.weekday;
                    return (
                        <Pressable key={day.weekday} onPress={() => setSelectedWeekday(day.weekday)} style={({ pressed }) => [styles.scheduleDayButton, active ? styles.scheduleDayButtonActive : null, pressed ? styles.pressedFeedback : null]}>
                            <Text style={styles.scheduleDayLabel}>{day.short.toUpperCase()}</Text>
                            <Text style={[styles.scheduleDayNumber, active ? styles.scheduleDayNumberActive : null]}>{weekDates[day.weekday] || '--'}</Text>
                            {active ? <View style={styles.scheduleDayIndicator} /> : null}
                        </Pressable>
                    );
                })}
            </View>

            <View style={styles.scheduleTimeline}>
                <View style={styles.scheduleTimelineLine} />
                {selectedItems.length === 0 ? <EmptyInline text={t('schedule.noClassDay')} /> : null}
                {beforeLunch.map((item, index) => (
                    <ScheduleTimelineCard
                        active={isSameClass(item, nextClass?.item)}
                        index={index}
                        item={item}
                        key={`${item.weekday}-${item.start_time}-${item.class_identifier}`}
                        t={t}
                    />
                ))}

                {beforeLunch.length > 0 && afterLunch.length > 0 ? <LunchBreak /> : null}

                {afterLunch.map((item, index) => (
                    <ScheduleTimelineCard
                        active={isSameClass(item, nextClass?.item)}
                        index={beforeLunch.length + index}
                        item={item}
                        key={`${item.weekday}-${item.start_time}-${item.class_identifier}`}
                        t={t}
                    />
                ))}

                <View style={styles.scheduleTipCard}>
                    <View style={styles.scheduleTipContent}>
                        <View style={styles.scheduleTipHeader}>
                            <Lightbulb color="#6e4f00" size={20} />
                            <Text style={styles.scheduleTipLabel}>{t('schedule.academicTip')}</Text>
                        </View>
                        <Text style={styles.scheduleTipText}>{selectedItems[0] ? t('schedule.reviewMaterials', { subject: toSubjectTitle(selectedItems[0].subject) }) : t('schedule.organizeMaterials')}</Text>
                        <Pressable style={({ pressed }) => [styles.scheduleTipButton, pressed ? styles.pressedFeedback : null]}>
                            <Text style={styles.scheduleTipButtonText}>{t('schedule.seeMaterials')}</Text>
                        </Pressable>
                    </View>
                    <GraduationCap color="rgba(38,25,0,0.12)" size={120} style={styles.scheduleTipIcon} />
                </View>
            </View>
        </View>
    );
}

function ScheduleTimelineCard({ active, index, item, t }: { active: boolean; index: number; item: Workspace['schedule'][number]; t: ReturnType<typeof useLanguage>['t'] }) {
    const Icon = index % 3 === 0 ? BookOpen : index % 3 === 1 ? Calculator : Terminal;

    return (
        <View style={styles.scheduleTimelineItem}>
            <View style={styles.scheduleTimelineMarkerColumn}>
                <View style={[styles.scheduleTimelineMarker, active ? styles.scheduleTimelineMarkerActive : null]}>
                    <Icon color={active ? '#ffffff' : '#003215'} size={18} />
                </View>
            </View>

            <View style={styles.scheduleClassCard}>
                <View style={styles.scheduleClassHeader}>
                    <View style={styles.scheduleClassTitleBlock}>
                        <View style={styles.scheduleClassCodeBadge}>
                            <Text style={styles.scheduleClassCodeText}>{item.code}</Text>
                        </View>
                        <Text style={styles.scheduleClassTitle}>{toSubjectTitle(item.subject)}</Text>
                    </View>
                    {active ? (
                        <View style={styles.scheduleActiveBadge}>
                            <Text style={styles.scheduleActiveBadgeText}>{t('schedule.active')}</Text>
                        </View>
                    ) : null}
                </View>

                <View style={styles.scheduleClassMeta}>
                    <View style={styles.scheduleMetaRow}>
                        <Clock3 color="#404941" size={16} />
                        <Text style={styles.scheduleMetaText}>{item.start_time} - {item.end_time}</Text>
                    </View>
                    <View style={styles.scheduleMetaRow}>
                        <MapPin color="#404941" size={16} />
                        <Text style={styles.scheduleMetaText}>{item.class_identifier || t('schedule.roomUnknown')}</Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

function LunchBreak() {
    const { t } = useLanguage();

    return (
        <View style={styles.scheduleTimelineItem}>
            <View style={[styles.scheduleTimelineMarkerColumn, styles.scheduleLunchMarkerColumn]}>
                <View style={styles.scheduleLunchMarker}>
                    <Utensils color="#404941" size={18} />
                </View>
            </View>
            <View style={styles.scheduleLunchContent}>
                <View style={styles.scheduleLunchLine} />
                <Text style={styles.scheduleLunchText}>{t('schedule.lunchBreak')}</Text>
                <View style={styles.scheduleLunchLine} />
            </View>
        </View>
    );
}

function buildCurrentWeekDates() {
    const now = new Date();
    const monday = new Date(now);
    const day = monday.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    monday.setDate(now.getDate() + diff);

    return weekdayOrder.reduce<Record<string, string>>((map, weekday, index) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + index);
        map[weekday] = String(date.getDate()).padStart(2, '0');
        return map;
    }, {});
}

function isSameClass(a: Workspace['schedule'][number] | undefined, b: Workspace['schedule'][number] | undefined) {
    if (!a || !b) return false;
    return a.weekday === b.weekday && a.start_time === b.start_time && a.code === b.code && a.class_identifier === b.class_identifier;
}

function ScheduleSkeleton() {
    return (
        <View style={styles.schedulePage}>
            <View style={styles.scheduleDaySelector}>
                {[0, 1, 2, 3, 4].map((index) => (
                    <View key={index} style={styles.scheduleDayButton}>
                        <SkeletonBlock height={10} style={{ width: 22 }} />
                        <SkeletonBlock height={16} style={{ marginTop: 6, width: 18 }} />
                    </View>
                ))}
            </View>

            <View style={styles.scheduleTimeline}>
                {[0, 1, 2].map((index) => (
                    <View key={index} style={styles.scheduleTimelineItem}>
                        <View style={styles.scheduleTimelineMarkerColumn}>
                            <SkeletonCircle size={40} />
                        </View>
                        <View style={styles.scheduleClassCard}>
                            <View style={styles.scheduleClassHeader}>
                                <View style={[styles.scheduleClassTitleBlock, { gap: 6 }]}>
                                    <SkeletonBlock height={16} style={{ width: 60 }} />
                                    <SkeletonBlock height={15} style={{ width: '75%' }} />
                                </View>
                            </View>
                            <View style={styles.scheduleClassMeta}>
                                <SkeletonBlock height={12} style={{ width: '50%' }} />
                                <SkeletonBlock height={12} style={{ width: '40%' }} />
                            </View>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
}
