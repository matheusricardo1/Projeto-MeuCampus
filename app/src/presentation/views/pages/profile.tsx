import { Pressable, Text, View } from 'react-native';
import { Badge, Cake, CalendarDays, Clock3, Fingerprint, Lock, LogOut, Mail, Phone, UserRound } from 'lucide-react-native';
import type { Workspace } from '@/presentation/views/workspace.types';
import { EmptyState, SkeletonBlock } from '@/presentation/views/components';
import { getInitials, toTitleName } from '@/presentation/views/workspace.utils';
import { styles } from '@/presentation/views/workspace.styles';

export function ProfilePage({
    loading,
    onLogout,
    onRefresh,
    profile
}: {
    loading: boolean;
    onLogout: () => Promise<void>;
    onRefresh: () => Promise<void>;
    profile: Workspace['profile'];
}) {
    if (loading && !profile) return <ProfileSkeleton />;
    if (!profile) return <EmptyState label="Carregar perfil" loading={loading} onRefresh={onRefresh} />;

    const studentName = toTitleName(profile.personal.full_name);
    const motherName = toTitleName(profile.personal.mother_name);

    return (
        <View style={styles.profilePage}>
            <View style={styles.profileCover}>
                <View style={styles.profileCoverContent}>
                    <View style={styles.profileLargeAvatarWrap}>
                        <View style={styles.profileLargeAvatar}>
                            <Text style={styles.profileLargeAvatarText}>{getInitials(studentName)}</Text>
                        </View>
                        <View style={styles.profileStatusDot} />
                    </View>
                    <Text style={styles.profileName}>{studentName || '-'}</Text>
                    <Text style={styles.profileCourse}>{profile.academic.course || '-'}</Text>
                    <View style={styles.profilePillRow}>
                        <View style={styles.profileHeroPill}><Text style={styles.profileHeroPillText}>Ativo</Text></View>
                        <View style={styles.profileHeroPill}><Text style={styles.profileHeroPillText}>Graduação</Text></View>
                    </View>
                </View>
            </View>

            <View style={styles.profileContentStack}>
                <View style={styles.profileGlassCard}>
                    <View style={styles.profileSectionHeader}>
                        <View style={styles.profileSectionIcon}>
                            <UserRound color="#001b08" size={20} />
                        </View>
                        <Text style={styles.profileSectionTitle}>Dados Acadêmicos</Text>
                    </View>
                    <View style={styles.profileAcademicGrid}>
                        <ProfileInfoBlock icon={Fingerprint} label="Matrícula" value={profile.academic.enrollment_number} />
                        <ProfileInfoBlock icon={CalendarDays} label="Ingresso" value={profile.academic.admission_term} />
                        <ProfileInfoBlock icon={Clock3} label="Turno" value={profile.academic.shift} />
                    </View>
                </View>

                <View style={styles.profileGlassCard}>
                    <View style={styles.profileCardHeader}>
                        <View style={styles.profileSectionHeader}>
                            <View style={styles.profileSectionIcon}>
                                <Mail color="#001b08" size={20} />
                            </View>
                            <Text style={styles.profileSectionTitle}>Informações de Contato</Text>
                        </View>
                    </View>
                    <ProfileListRow icon={Mail} label="E-mail Institucional" value={profile.contact.email} />
                    <ProfileListRow icon={Phone} label="Telefone" value={profile.contact.cellphone || profile.contact.home_phone} />
                </View>

                <View style={styles.profileGlassCard}>
                    <View style={styles.profileCardHeader}>
                        <View style={styles.profileSectionHeader}>
                            <View style={styles.profileSectionIcon}>
                                <UserRound color="#001b08" size={20} />
                            </View>
                            <Text style={styles.profileSectionTitle}>Dados Pessoais</Text>
                        </View>
                    </View>
                    <ProfileListRow icon={Badge} label="Nome da mãe" trailingIcon={Lock} value={motherName} />
                    <ProfileListRow icon={Cake} label="Data de Nascimento" value={profile.personal.birth_date} />
                </View>

                <View style={styles.profileActions}>
                    <Pressable onPress={() => void onLogout()} style={styles.profileDangerAction}>
                        <LogOut color="#ba1a1a" size={20} />
                        <Text style={styles.profileDangerActionText}>Sair da Conta</Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

function ProfileInfoBlock({ icon: Icon, label, value }: { icon: typeof Fingerprint; label: string; value: string }) {
    return (
        <View style={styles.profileInfoBlock}>
            <View style={styles.profileInfoLabelRow}>
                <Icon color="#22502f" size={16} />
                <Text style={styles.profileInfoLabel}>{label}</Text>
            </View>
            <Text style={styles.profileInfoValue}>{value || '-'}</Text>
        </View>
    );
}

function ProfileListRow({ icon: Icon, label, trailingIcon: TrailingIcon, value }: { icon: typeof Mail; label: string; trailingIcon?: typeof Lock; value: string }) {
    return (
        <View style={styles.profileListRow}>
            <View style={styles.profileListRowBody}>
                <View style={styles.profileListIcon}>
                    <Icon color="#001b08" size={21} />
                </View>
                <View style={styles.profileListText}>
                    <Text style={styles.profileListLabel}>{label}</Text>
                    <Text style={styles.profileListValue}>{value || '-'}</Text>
                </View>
            </View>
            {TrailingIcon ? <TrailingIcon color="#8a948b" size={21} /> : null}
        </View>
    );
}

function ProfileSkeleton() {
    return (
        <View style={styles.sectionStack}>
            <SkeletonBlock height={260} />
            <SkeletonBlock height={180} />
            <SkeletonBlock height={220} />
        </View>
    );
}
