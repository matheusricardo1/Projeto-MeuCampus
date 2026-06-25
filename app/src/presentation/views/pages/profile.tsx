import { Pressable, Text, View } from 'react-native';
import { CalendarDays, Clock3, Fingerprint, LogOut, Mail, Phone, UserRound } from 'lucide-react-native';
import type { Workspace } from '@/presentation/views/workspace.types';
import { EmptyState, SkeletonBlock } from '@/presentation/views/components';
import { LanguageSelector } from '@/presentation/views/components/language-selector';
import { useLanguage } from '@/presentation/i18n/language-provider';
import { getInitials, toTitleName, useResponsiveLayout } from '@/presentation/views/workspace.utils';
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
    const { t } = useLanguage();
    const layout = useResponsiveLayout();

    if (loading && !profile) return <ProfileSkeleton />;
    if (!profile) return <EmptyState label={t('profile.load')} loading={loading} onRefresh={onRefresh} />;

    const studentName = toTitleName(profile.personal?.full_name || '');

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
                    <Text style={styles.profileCourse}>{profile.academic?.course || '-'}</Text>
                    <View style={styles.profilePillRow}>
                        <View style={styles.profileHeroPill}><Text style={styles.profileHeroPillText}>{t('profile.active')}</Text></View>
                        <View style={styles.profileHeroPill}><Text style={styles.profileHeroPillText}>{t('profile.degree')}</Text></View>
                    </View>
                </View>
            </View>

            <View style={styles.profileContentStack}>
                <View style={styles.profileGlassCard}>
                    <View style={styles.profileSectionHeader}>
                        <View style={styles.profileSectionIcon}>
                            <UserRound color="#001b08" size={20} />
                        </View>
                        <Text style={styles.profileSectionTitle}>{t('profile.academicData')}</Text>
                    </View>
                    <View style={styles.profileAcademicGrid}>
                        <ProfileInfoBlock icon={Fingerprint} label={t('profile.enrollment')} value={profile.academic?.enrollment_number || ''} />
                        <ProfileInfoBlock icon={CalendarDays} label={t('profile.admission')} value={profile.academic?.admission_term || ''} />
                        <ProfileInfoBlock icon={Clock3} label={t('profile.shift')} value={profile.academic?.shift || ''} />
                    </View>
                </View>

                <View style={styles.profileGlassCard}>
                    <View style={styles.profileCardHeader}>
                        <View style={styles.profileSectionHeader}>
                            <View style={styles.profileSectionIcon}>
                                <Mail color="#001b08" size={20} />
                            </View>
                            <Text style={styles.profileSectionTitle}>{t('profile.contactInfo')}</Text>
                        </View>
                    </View>
                    <ProfileListRow icon={Mail} label={t('profile.email')} value={profile.contact?.email || ''} />
                    <ProfileListRow icon={Phone} label={t('profile.phone')} value={profile.contact?.cellphone || profile.contact?.home_phone || ''} />
                </View>

                <View style={[styles.profileLanguageCard, !layout.isTablet ? styles.profileLanguageCardMobile : null]}>
                    <View style={styles.profileLanguageText}>
                        <Text style={styles.profileSectionTitle}>{t('profile.languageTitle')}</Text>
                        <Text style={styles.profileListValue}>{t('profile.languageDescription')}</Text>
                    </View>
                    <View style={!layout.isTablet ? styles.profileLanguageSelectorMobile : null}>
                        <LanguageSelector />
                    </View>
                </View>

                <View style={styles.profileActions}>
                    <Pressable onPress={() => void onLogout()} style={styles.profileDangerAction}>
                        <LogOut color="#ba1a1a" size={20} />
                        <Text style={styles.profileDangerActionText}>{t('profile.logout')}</Text>
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

function ProfileListRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
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
        </View>
    );
}

function ProfileSkeleton() {
    return (
        <View style={styles.sectionStack}>
            <SkeletonBlock height={260} />
            <SkeletonBlock height={180} />
            <SkeletonBlock height={140} />
        </View>
    );
}
