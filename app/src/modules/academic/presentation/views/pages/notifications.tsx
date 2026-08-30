import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BellOff, CheckCheck, Info, Menu } from 'lucide-react-native';
import { useLanguage } from '@/shared/i18n/language-provider';
import type { Translate } from '@/shared/i18n/languages';
import { styles } from '@/modules/academic/presentation/views/workspace.styles';
import { useEcampusAnnouncements } from '@/modules/academic/presentation/hooks/use-ecampus-announcements';
import { stripHtmlToText } from '@/modules/academic/presentation/views/workspace.utils';
import { SkeletonBlock } from '@/modules/academic/presentation/views/components';
import type { EcampusAnnouncement } from '@/modules/academic/domain/entities/ecampus-announcement';

export function NotificationsPage() {
    const { t } = useLanguage();
    const { announcements, isLoading } = useEcampusAnnouncements();
    const todayLabel = formatTodayLabel();
    const today = announcements.filter((item) => item.postedDate === todayLabel);
    const previous = announcements.filter((item) => item.postedDate !== todayLabel);

    return (
        <View style={styles.notificationsPage}>
            <View style={styles.notificationsTopRow}>
                <View style={styles.notificationsTitleRow}>
                    <View style={styles.notificationsMenuIcon}>
                        <Menu color="#003215" size={22} />
                    </View>
                    <Text style={styles.notificationsTitle}>{t('notifications.title')}</Text>
                </View>
                <Pressable style={({ pressed }) => [styles.notificationsReadButton, pressed ? styles.pressedFeedback : null]}>
                    <CheckCheck color="#003215" size={17} />
                    <Text style={styles.notificationsReadButtonText}>{t('notifications.markRead')}</Text>
                </Pressable>
            </View>

            <View style={styles.notificationsSection}>
                <Text style={styles.notificationsSectionLabel}>{t('notifications.today')}</Text>
                {isLoading && announcements.length === 0 ? (
                    <AnnouncementsSkeleton />
                ) : today.length > 0 ? (
                    today.map((item, index) => <AnnouncementCard item={item} key={`${item.title}-${index}`} t={t} />)
                ) : (
                    <View style={styles.notificationsEmptyCard}>
                        <View style={styles.notificationsEmptyIcon}>
                            <BellOff color="#414941" size={42} />
                        </View>
                        <Text style={styles.notificationsEmptyTitle}>{t('notifications.emptyTitle')}</Text>
                        <Text style={styles.notificationsEmptyText}>{t('notifications.emptyText')}</Text>
                    </View>
                )}
            </View>

            <View style={styles.notificationsSection}>
                <Text style={styles.notificationsSectionLabel}>{t('notifications.previous')}</Text>
                {!isLoading && previous.length > 0 ? (
                    previous.map((item, index) => <AnnouncementCard item={item} key={`${item.title}-${index}`} t={t} />)
                ) : !isLoading ? (
                    <View style={styles.notificationsHintCard}>
                        <View style={styles.notificationsHintIcon}>
                            <Info color="#003215" size={22} />
                        </View>
                        <View style={styles.notificationsHintText}>
                            <Text style={styles.notificationsHintTitle}>{t('notifications.emptyHistoryTitle')}</Text>
                            <Text style={styles.notificationsHintDescription}>{t('notifications.emptyHistoryDescription')}</Text>
                        </View>
                    </View>
                ) : null}
            </View>
        </View>
    );
}

function AnnouncementCard({ item, t }: { item: EcampusAnnouncement; t: Translate }) {
    const [expanded, setExpanded] = useState(false);
    const bodyText = stripHtmlToText(item.bodyHtml);

    return (
        <Pressable
            onPress={() => setExpanded((current) => !current)}
            style={({ pressed }) => [styles.notificationsAnnouncementCard, pressed ? styles.pressedFeedback : null]}
        >
            <View style={styles.notificationsAnnouncementHeader}>
                <Text style={styles.notificationsAnnouncementTitle}>{item.title}</Text>
                {item.postedDate ? <Text style={styles.notificationsAnnouncementDate}>{item.postedDate}</Text> : null}
            </View>
            <Text numberOfLines={expanded ? undefined : 3} style={styles.notificationsAnnouncementBody}>{bodyText}</Text>
            <Text style={styles.notificationsAnnouncementToggle}>{expanded ? t('notifications.readLess') : t('notifications.readMore')}</Text>
        </Pressable>
    );
}

function AnnouncementsSkeleton() {
    return (
        <>
            {[0, 1].map((index) => (
                <View key={index} style={[styles.notificationsAnnouncementCard, { gap: 10 }]}>
                    <SkeletonBlock height={16} style={{ width: '70%' }} />
                    <SkeletonBlock height={13} style={{ width: '100%' }} />
                    <SkeletonBlock height={13} style={{ width: '90%' }} />
                </View>
            ))}
        </>
    );
}

function formatTodayLabel(): string {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${now.getFullYear()}`;
}
