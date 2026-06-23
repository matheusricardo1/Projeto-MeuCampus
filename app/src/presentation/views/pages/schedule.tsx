import { ScrollView, Text, View } from 'react-native';
import { Clock3 } from 'lucide-react-native';
import { colors } from '@/presentation/design-system';
import type { Workspace } from '@/presentation/views/workspace.types';
import { EmptyInline, PanelHeader, SkeletonBlock } from '@/presentation/views/components';
import { buildWeekMap, eventTone, getNextScheduleClass, groupScheduleByDay } from '@/presentation/views/workspace.utils';
import { styles } from '@/presentation/views/workspace.styles';

export function SchedulePage({
    loading,
    onRefresh,
    schedule
}: {
    loading: boolean;
    onRefresh: () => Promise<void>;
    schedule: Workspace['schedule'];
}) {
    const groupedSchedule = groupScheduleByDay(schedule);
    const weekMap = buildWeekMap(groupedSchedule);
    const nextClass = getNextScheduleClass(schedule);

    if (loading && schedule.length === 0) return <ScheduleSkeleton />;

    return (
        <View style={styles.sectionStack}>
            <View style={styles.panel}>
                <PanelHeader loading={loading} onRefresh={onRefresh} title={nextClass?.isHappening ? 'Aula agora' : 'Proxima aula'} />
                <View style={styles.scheduleHero}>
                    <View style={styles.scheduleHeroText}>
                        <Text style={styles.panelTitle}>{nextClass?.item.subject || 'Sem horario carregado'}</Text>
                        <Text style={styles.panelDescription}>{nextClass ? `${nextClass.label} - ${nextClass.item.start_time} ate ${nextClass.item.end_time}` : 'Atualize para montar seu horario semanal.'}</Text>
                    </View>
                    <View style={styles.timeBadge}><Clock3 color={colors.info} size={18} /><Text style={styles.timeBadgeText}>{nextClass?.item.start_time || '--:--'}</Text></View>
                </View>
            </View>

            <View style={styles.panel}>
                <PanelHeader loading={loading} onRefresh={onRefresh} title="Horario semanal" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
                    {weekMap.map((day) => (
                        <View key={day.weekday} style={[styles.weekChip, day.items.length ? styles.weekChipActive : null]}>
                            <Text style={[styles.weekChipText, day.items.length ? styles.weekChipTextActive : null]}>{day.short}</Text>
                            <Text style={[styles.weekChipNumber, day.items.length ? styles.weekChipTextActive : null]}>{day.items.length}</Text>
                        </View>
                    ))}
                </ScrollView>
                <View style={styles.listStack}>
                    {schedule.length === 0 ? <EmptyInline text="Nenhuma aula carregada." /> : null}
                    {weekMap.filter((day) => day.items.length > 0).map((group) => (
                        <View key={group.weekday} style={styles.laneCard}>
                            <View style={styles.laneHeader}><Text style={styles.panelTitle}>{group.label}</Text><Text style={styles.panelDescription}>{group.items.length} aula{group.items.length === 1 ? '' : 's'}</Text></View>
                            {group.items.map((item, index) => (
                                <View key={`${item.weekday}-${item.start_time}-${item.class_identifier}`} style={[styles.scheduleEvent, eventTone(index)]}>
                                    <View style={styles.eventTimeBox}><Text style={styles.eventTimePrimary}>{item.start_time}</Text><Text style={styles.eventTimeSecondary}>{item.end_time}</Text></View>
                                    <View style={styles.eventBody}><Text style={styles.smallCaps}>{item.code}</Text><Text style={styles.eventTitle}>{item.subject}</Text><Text style={styles.eventSubtitle}>{item.class_identifier}</Text></View>
                                </View>
                            ))}
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}

function ScheduleSkeleton() {
    return (
        <View style={styles.sectionStack}>
            <SkeletonBlock height={140} />
            <SkeletonBlock height={320} />
        </View>
    );
}
