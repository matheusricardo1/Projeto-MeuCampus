import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CalendarDays, ChevronRight, Clock3, Crown, FileText, Fingerprint, Globe, GraduationCap, LogOut, Mail, Phone, ShieldCheck, UserRound } from 'lucide-react-native';
import { colors, gradients } from '@/shared/design-system';
import type { Workspace } from '@/modules/academic/presentation/views/workspace.types';
import { DeclarationsModal, EmptyState, LanguageSettingsModal, PlanModal, SkeletonBlock, SkeletonCircle } from '@/modules/academic/presentation/views/components';
import type { CreateCardCheckoutRequest } from '@/modules/academic/domain/repositories/ecampus-repository';
import type { CardCheckoutResult, CheckoutStatus, PixCheckout } from '@/modules/academic/presentation/views/components/plan-checkout';
import { useLanguage } from '@/shared/i18n/language-provider';
import { getInitials, toTitleName } from '@/modules/academic/presentation/views/workspace.utils';
import { styles } from '@/modules/academic/presentation/views/workspace.styles';

export function ProfilePage({
    loading,
    onCreateCardCheckout,
    onCreatePixCheckout,
    onGetBillingPlan,
    onGetCheckoutStatus,
    onGetMercadoPagoPublicKey,
    onLogout,
    onRefresh,
    profile
}: {
    loading: boolean;
    onCreateCardCheckout?: (input: CreateCardCheckoutRequest) => Promise<CardCheckoutResult>;
    onCreatePixCheckout?: () => Promise<PixCheckout>;
    onGetBillingPlan?: () => Promise<{ plan: 'FREE' | 'PAID'; planExpiresAt: string | null }>;
    onGetCheckoutStatus?: (paymentId: string) => Promise<CheckoutStatus>;
    onGetMercadoPagoPublicKey?: () => Promise<{ publicKey: string; amount: number }>;
    onLogout: () => Promise<void>;
    onRefresh: () => Promise<void>;
    profile: Workspace['profile'];
}) {
    const { t } = useLanguage();
    const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [isDeclarationsModalOpen, setIsDeclarationsModalOpen] = useState(false);

    if (loading && !profile) return <ProfileSkeleton />;
    if (!profile) return <EmptyState label={t('profile.load')} loading={loading} onRefresh={onRefresh} />;

    const studentName = toTitleName(profile.personal?.full_name || '');

    return (
        <View style={styles.profilePage}>
            <LinearGradient colors={gradients.brand} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={styles.profileCover}>
                <UserRound color="rgba(255,255,255,0.10)" size={220} style={styles.profileCoverGlow} />
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
                        <View style={styles.profileHeroPill}>
                            <ShieldCheck color={colors.inverseText} size={12} />
                            <Text style={styles.profileHeroPillText}>{t('profile.active')}</Text>
                        </View>
                        <View style={styles.profileHeroPill}>
                            <GraduationCap color={colors.inverseText} size={12} />
                            <Text style={styles.profileHeroPillText}>{t('profile.degree')}</Text>
                        </View>
                    </View>
                </View>
            </LinearGradient>

            <View style={styles.profileContentStack}>
                <View style={styles.profileGlassCard}>
                    <View style={styles.profileSectionHeader}>
                        <View style={styles.profileSectionIcon}>
                            <UserRound color={colors.brand} size={20} />
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
                                <Mail color={colors.brand} size={20} />
                            </View>
                            <Text style={styles.profileSectionTitle}>{t('profile.contactInfo')}</Text>
                        </View>
                    </View>
                    <ProfileListRow icon={Mail} label={t('profile.email')} value={profile.contact?.email || ''} />
                    <ProfileListRow icon={Phone} label={t('profile.phone')} value={profile.contact?.cellphone || profile.contact?.home_phone || ''} />
                </View>

                <View style={styles.profileGlassCard}>
                    <Pressable onPress={() => setIsLanguageModalOpen(true)} style={({ pressed }) => [styles.profileListRow, { marginTop: 0 }, pressed ? styles.pressedFeedback : null]}>
                        <View style={styles.profileListRowBody}>
                            <View style={styles.profileListIcon}>
                                <Globe color={colors.brand} size={21} />
                            </View>
                            <View style={styles.profileListText}>
                                <Text style={styles.profileListLabel}>{t('profile.languageTitle')}</Text>
                                <Text style={styles.profileListValue}>{t('profile.languageDescription')}</Text>
                            </View>
                        </View>
                        <ChevronRight color={colors.textMuted} size={20} />
                    </Pressable>

                    <Pressable onPress={() => setIsDeclarationsModalOpen(true)} style={({ pressed }) => [styles.profileListRow, pressed ? styles.pressedFeedback : null]}>
                        <View style={styles.profileListRowBody}>
                            <View style={styles.profileListIcon}>
                                <FileText color={colors.brand} size={21} />
                            </View>
                            <View style={styles.profileListText}>
                                <Text style={styles.profileListLabel}>{t('declarations.title')}</Text>
                                <Text style={styles.profileListValue}>{t('declarations.subtitle')}</Text>
                            </View>
                        </View>
                        <ChevronRight color={colors.textMuted} size={20} />
                    </Pressable>
                </View>

                <View style={styles.profileActions}>
                    <Pressable onPress={() => setIsPlanModalOpen(true)} style={({ pressed }) => [styles.profilePrimaryAction, pressed ? styles.pressedFeedback : null]}>
                        <LinearGradient colors={gradients.brand} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={styles.profilePrimaryActionGradient}>
                            <Crown color={colors.inverseText} size={20} />
                            <Text style={styles.profilePrimaryActionText}>{t('profile.planTitle')}</Text>
                        </LinearGradient>
                    </Pressable>
                    <Pressable onPress={() => void onLogout()} style={({ pressed }) => [styles.profileDangerAction, pressed ? styles.pressedFeedback : null]}>
                        <LogOut color={colors.danger} size={20} />
                        <Text style={styles.profileDangerActionText}>{t('profile.logout')}</Text>
                    </Pressable>
                </View>

                <LanguageSettingsModal onClose={() => setIsLanguageModalOpen(false)} visible={isLanguageModalOpen} />
                <DeclarationsModal onClose={() => setIsDeclarationsModalOpen(false)} visible={isDeclarationsModalOpen} />
                <PlanModal
                    onClose={() => setIsPlanModalOpen(false)}
                    onCreateCardCheckout={onCreateCardCheckout}
                    onCreatePixCheckout={onCreatePixCheckout}
                    onGetBillingPlan={onGetBillingPlan}
                    onGetCheckoutStatus={onGetCheckoutStatus}
                    onGetMercadoPagoPublicKey={onGetMercadoPagoPublicKey}
                    visible={isPlanModalOpen}
                />
            </View>
        </View>
    );
}

function ProfileInfoBlock({ icon: Icon, label, value }: { icon: typeof Fingerprint; label: string; value: string }) {
    return (
        <View style={styles.profileInfoBlock}>
            <View style={styles.profileInfoAccent} />
            <View style={styles.profileInfoLabelRow}>
                <Icon color={colors.brand} size={16} />
                <Text numberOfLines={1} style={styles.profileInfoLabel}>{label}</Text>
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
                    <Icon color={colors.brand} size={21} />
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
        <View style={styles.profilePage}>
            <LinearGradient colors={gradients.brand} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={styles.profileCover}>
                <View style={styles.profileCoverContent}>
                    <SkeletonCircle size={112} style={{ backgroundColor: 'rgba(255,255,255,0.16)', marginBottom: 18 }} />
                    <SkeletonBlock height={22} style={{ backgroundColor: 'rgba(255,255,255,0.16)', marginBottom: 8, width: 180 }} />
                    <SkeletonBlock height={14} style={{ backgroundColor: 'rgba(255,255,255,0.16)', width: 140 }} />
                </View>
            </LinearGradient>

            <View style={styles.profileContentStack}>
                <View style={styles.profileGlassCard}>
                    <View style={styles.profileSectionHeader}>
                        <SkeletonCircle size={36} />
                        <SkeletonBlock height={16} style={{ width: 150 }} />
                    </View>
                    <View style={styles.profileAcademicGrid}>
                        <SkeletonBlock height={64} style={{ flexBasis: '30%', flexGrow: 1, minWidth: 96 }} />
                        <SkeletonBlock height={64} style={{ flexBasis: '30%', flexGrow: 1, minWidth: 96 }} />
                        <SkeletonBlock height={64} style={{ flexBasis: '30%', flexGrow: 1, minWidth: 96 }} />
                    </View>
                </View>

                <View style={styles.profileGlassCard}>
                    <View style={styles.profileSectionHeader}>
                        <SkeletonCircle size={36} />
                        <SkeletonBlock height={16} style={{ width: 160 }} />
                    </View>
                    {[0, 1].map((index) => (
                        <View key={index} style={styles.profileListRow}>
                            <View style={styles.profileListRowBody}>
                                <SkeletonCircle size={44} />
                                <View style={{ gap: 6 }}>
                                    <SkeletonBlock height={11} style={{ width: 90 }} />
                                    <SkeletonBlock height={14} style={{ width: 160 }} />
                                </View>
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}
