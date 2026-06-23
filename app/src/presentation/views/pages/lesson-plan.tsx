import { Pressable, ScrollView, Text, View } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import type { Workspace } from '@/presentation/views/workspace.types';
import { EmptyInline, PanelHeader, SkeletonBlock } from '@/presentation/views/components';
import { formatWorkload } from '@/presentation/views/workspace.utils';
import { styles } from '@/presentation/views/workspace.styles';

export function LessonPlanPage({ items, loading, onChangeSubjectCode, onRefresh, onRefreshSubjects, selectedSubjectCode, subjects }: { items: Workspace['lessonPlan']; loading: boolean; onChangeSubjectCode: (value: string) => void; onRefresh: () => Promise<void>; onRefreshSubjects: () => Promise<void>; selectedSubjectCode: string; subjects: Workspace['lessonPlanSubjects']; }) {
    const selectedSubject = subjects.find((subject) => subject.code === selectedSubjectCode) || null;

    if (loading && subjects.length === 0 && items.length === 0) return <LessonPlanSkeleton />;

    return (
        <View style={styles.sectionStack}>
            <View style={styles.panel}>
                <PanelHeader loading={loading} onRefresh={onRefreshSubjects} title="Plano de ensino" />
                <View style={styles.listStack}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalList}>
                        {subjects.map((subject) => {
                            const active = subject.code === selectedSubjectCode;
                            return (
                                <Pressable key={`${subject.code}-${subject.classIdentifier}`} onPress={() => onChangeSubjectCode(subject.code)} style={[styles.subjectChip, active ? styles.subjectChipActive : null]}>
                                    <Text style={[styles.subjectChipCode, active ? styles.subjectChipCodeActive : null]}>{subject.code}</Text>
                                    <Text numberOfLines={1} style={[styles.subjectChipText, active ? styles.subjectChipTextActive : null]}>{subject.subject}</Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>

                    <Pressable onPress={() => void onRefresh()} style={styles.secondaryButton}><RefreshCw color={styles.secondaryButtonText.color as string} size={16} /><Text style={styles.secondaryButtonText}>Buscar plano</Text></Pressable>

                    {selectedSubject ? <View style={styles.selectedSubjectCard}><View style={[styles.statusPill, selectedSubject.available ? styles.statusOk : styles.statusWarn]}><Text style={styles.statusPillText}>{selectedSubject.available ? 'Disponivel' : 'Indisponivel'}</Text></View><Text style={styles.eventTitle}>{selectedSubject.subject}</Text><Text style={styles.panelDescription}>{selectedSubject.code} - {selectedSubject.classIdentifier || 'Turma nao informada'}</Text><Text style={styles.panelDescription}>{selectedSubject.professor || 'Docente nao informado'}</Text></View> : null}

                    {items.length === 0 ? <EmptyInline text="Nenhum item carregado." /> : null}
                    {items.map((item, index) => (
                        <View key={`${item.date}-${item.content}-${index}`} style={styles.lessonCard}>
                            <View style={styles.lessonDateBox}><Text style={styles.lessonDate}>{item.date || '-'}</Text><Text style={styles.lessonWorkload}>{formatWorkload(item.workload)}</Text></View>
                            <View style={styles.lessonBody}><Text style={styles.smallCaps}>{item.type || 'Aula'}</Text><Text style={styles.eventTitle}>{item.content || '-'}</Text></View>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}

function LessonPlanSkeleton() {
    return <View style={styles.sectionStack}><SkeletonBlock height={360} /></View>;
}
