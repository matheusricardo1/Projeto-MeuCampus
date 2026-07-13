import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, ShieldAlert } from 'lucide-react-native';
import { colors, fonts, radii, spacing } from '@/shared/design-system';
import { adminLogin } from '@/modules/admin/infrastructure/admin-api';
import { setAdminToken } from '@/modules/admin/infrastructure/admin-token-store';

export function AdminLoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        if (!email.trim() || !password || isSubmitting) return;

        setIsSubmitting(true);
        setError(null);
        try {
            const token = await adminLogin(email.trim(), password);
            setAdminToken(token);
            router.replace('/admin/dashboard');
        } catch {
            setError('Email ou senha invalidos.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <View style={styles.screen}>
            <View style={styles.card}>
                <View style={styles.iconBadge}>
                    <ShieldAlert color={colors.brandDark} size={22} />
                </View>
                <Text style={styles.title}>Painel do dono</Text>
                <Text style={styles.subtitle}>Acesso restrito. Entre com sua credencial de admin.</Text>

                <View style={styles.field}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        onChangeText={setEmail}
                        onSubmitEditing={() => void submit()}
                        placeholder="voce@exemplo.com"
                        placeholderTextColor={colors.textSubtle}
                        style={styles.input}
                        value={email}
                    />
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Senha</Text>
                    <TextInput
                        onChangeText={setPassword}
                        onSubmitEditing={() => void submit()}
                        placeholder="********"
                        placeholderTextColor={colors.textSubtle}
                        secureTextEntry
                        style={styles.input}
                        value={password}
                    />
                </View>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Pressable
                    disabled={!email.trim() || !password || isSubmitting}
                    onPress={() => void submit()}
                    style={({ pressed }) => [
                        styles.submitButton,
                        (!email.trim() || !password || isSubmitting) ? styles.submitButtonDisabled : null,
                        pressed ? styles.pressedFeedback : null
                    ]}
                >
                    {isSubmitting ? <ActivityIndicator color={colors.inverseText} /> : (
                        <>
                            <Lock color={colors.inverseText} size={16} />
                            <Text style={styles.submitButtonText}>Entrar</Text>
                        </>
                    )}
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        alignItems: 'center',
        backgroundColor: colors.brandDark,
        flex: 1,
        justifyContent: 'center',
        padding: spacing[5]
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: radii.md + 8,
        gap: spacing[3],
        maxWidth: 380,
        padding: spacing[6],
        width: '100%'
    },
    iconBadge: {
        alignItems: 'center',
        backgroundColor: colors.brandSubtle,
        borderRadius: radii.pill,
        height: 44,
        justifyContent: 'center',
        marginBottom: spacing[1],
        width: 44
    },
    title: {
        color: colors.brandDark,
        fontFamily: fonts.medium,
        fontSize: 22,
        fontWeight: '800'
    },
    subtitle: {
        color: colors.textMuted,
        fontFamily: fonts.sans,
        fontSize: 13,
        lineHeight: 18,
        marginBottom: spacing[2]
    },
    field: {
        gap: spacing[1]
    },
    label: {
        color: colors.textMuted,
        fontFamily: fonts.medium,
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase'
    },
    input: {
        backgroundColor: colors.surfaceSubtle,
        borderColor: colors.border,
        borderRadius: radii.md,
        borderWidth: 1,
        color: colors.text,
        fontFamily: fonts.sans,
        fontSize: 15,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[3]
    },
    error: {
        color: colors.danger,
        fontFamily: fonts.medium,
        fontSize: 13,
        fontWeight: '700'
    },
    submitButton: {
        alignItems: 'center',
        backgroundColor: colors.brandDark,
        borderRadius: radii.md,
        flexDirection: 'row',
        gap: spacing[2],
        justifyContent: 'center',
        marginTop: spacing[2],
        minHeight: 50
    },
    submitButtonDisabled: {
        opacity: 0.5
    },
    submitButtonText: {
        color: colors.inverseText,
        fontFamily: fonts.medium,
        fontSize: 15,
        fontWeight: '800'
    },
    pressedFeedback: {
        opacity: 0.75
    }
});
