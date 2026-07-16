import { Pressable, Text, View } from 'react-native';
import { BellOff, CheckCheck, Info, Menu } from 'lucide-react-native';
import { useLanguage } from '@/shared/i18n/language-provider';
import { styles } from '@/modules/academic/presentation/views/workspace.styles';

export function NotificationsPage() {
    const { t } = useLanguage();

    return (
        <View style={styles.notificationsPage}>
            <View style={styles.notificationsTopRow}>
                <View style={styles.notificationsTitleRow}>
                    <View style={styles.notificationsMenuIcon}>
                        <Menu color="#0B6B52" size={22} />
                    </View>
                    <Text style={styles.notificationsTitle}>{t('notifications.title')}</Text>
                </View>
                <Pressable style={({ pressed }) => [styles.notificationsReadButton, pressed ? styles.pressedFeedback : null]}>
                    <CheckCheck color="#0B6B52" size={17} />
                    <Text style={styles.notificationsReadButtonText}>{t('notifications.markRead')}</Text>
                </Pressable>
            </View>

            <View style={styles.notificationsSection}>
                <Text style={styles.notificationsSectionLabel}>{t('notifications.today')}</Text>
                <View style={styles.notificationsEmptyCard}>
                    <View style={styles.notificationsEmptyIcon}>
                        <BellOff color="#414941" size={42} />
                    </View>
                    <Text style={styles.notificationsEmptyTitle}>{t('notifications.emptyTitle')}</Text>
                    <Text style={styles.notificationsEmptyText}>{t('notifications.emptyText')}</Text>
                </View>
            </View>

            <View style={styles.notificationsSection}>
                <Text style={styles.notificationsSectionLabel}>{t('notifications.previous')}</Text>
                <View style={styles.notificationsHintCard}>
                    <View style={styles.notificationsHintIcon}>
                        <Info color="#0B6B52" size={22} />
                    </View>
                    <View style={styles.notificationsHintText}>
                        <Text style={styles.notificationsHintTitle}>{t('notifications.emptyHistoryTitle')}</Text>
                        <Text style={styles.notificationsHintDescription}>{t('notifications.emptyHistoryDescription')}</Text>
                    </View>
                </View>
            </View>
        </View>
    );
}
