import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GraduationCap, Mail } from 'lucide-react-native';
import { colors, gradients } from '@/presentation/design-system';
import type { Workspace } from '@/presentation/views/workspace.types';
import { EmptyState, PanelHeader, SkeletonBlock } from '@/presentation/views/components';
import { getInitials, getResponsiveCardStyle, useResponsiveLayout } from '@/presentation/views/workspace.utils';
import { styles } from '@/presentation/views/workspace.styles';

export function ProfilePage({
    loading,
    onRefresh,
    profile
}: {
    loading: boolean;
    onRefresh: () => Promise<void>;
    profile: Workspace['profile'];
}) {
    const layout = useResponsiveLayout();
    if (loading && !profile) return <ProfileSkeleton />;
    if (!profile) return <EmptyState label="Carregar perfil" loading={loading} onRefresh={onRefresh} />;

    const contactRows = [
        { icon: GraduationCap, label: 'Matricula', value: profile.academic.enrollment_number },
        { icon: Mail, label: 'Email', value: profile.contact.email }
    ];
    const rows = [
        ['Curso', profile.academic.course],
        ['Turno', profile.academic.shift],
        ['Ingresso', profile.academic.admission_term]
    ];

    return (
        <View style={styles.sectionStack}>
            <LinearGradient colors={gradients.surface} style={styles.profileHero}>
                <View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{getInitials(profile.personal.full_name)}</Text></View>
                <View style={styles.profileHeroText}>
                    <Text style={styles.sectionKicker}>Aluno</Text>
                    <Text style={styles.panelTitle}>{profile.personal.full_name || '-'}</Text>
                    <Text style={styles.panelDescription}>{profile.academic.course || '-'}</Text>
                </View>
            </LinearGradient>

            <View style={[styles.metricGrid, layout.isTablet ? styles.metricGridWide : null]}>
                {contactRows.map((row) => {
                    const Icon = row.icon;
                    return (
                        <View key={row.label} style={[styles.infoTile, getResponsiveCardStyle(layout, 2)]}>
                            <Icon color={colors.brand} size={18} />
                            <Text style={styles.tileLabel}>{row.label}</Text>
                            <Text style={styles.tileValue}>{row.value || '-'}</Text>
                        </View>
                    );
                })}
            </View>

            <View style={styles.panel}>
                <PanelHeader loading={loading} onRefresh={onRefresh} title="Dados academicos" />
                <View style={[styles.detailsGrid, layout.isTablet ? styles.metricGridWide : null]}>
                    {rows.map(([label, value]) => (
                        <View key={label} style={[styles.detailCard, getResponsiveCardStyle(layout, 3)]}>
                            <Text style={styles.tileLabel}>{label}</Text>
                            <Text style={styles.detailValue}>{value || '-'}</Text>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}

function ProfileSkeleton() {
    return (
        <View style={styles.sectionStack}>
            <SkeletonBlock height={136} />
            <View style={styles.metricGrid}><SkeletonBlock height={92} /><SkeletonBlock height={92} /></View>
            <SkeletonBlock height={260} />
        </View>
    );
}
