import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, type KeyboardEvent, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, EyeOff, KeyRound, LockKeyhole } from 'lucide-react-native';
import { colors, gradients } from '@/presentation/design-system';
import type { Workspace } from '@/presentation/views/workspace.types';
import { Field } from '@/presentation/views/components';
import { formatCpf, onlyDigits, useResponsiveLayout } from '@/presentation/views/workspace.utils';
import { styles } from '@/presentation/views/workspace.styles';

export function LoginPage({ workspace }: { workspace: Workspace }) {
    const [user, setUser] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [keyboardOpen, setKeyboardOpen] = useState(false);
    const [focusedInputOffset, setFocusedInputOffset] = useState(0);
    const layout = useResponsiveLayout();
    const insets = useSafeAreaInsets();
    const scrollRef = useRef<ScrollView>(null);
    const cpfFieldRef = useRef<View>(null);
    const passwordFieldRef = useRef<View>(null);
    const focusedFieldRef = useRef<'cpf' | 'password' | null>(null);
    const keyboardVisibleRef = useRef(false);
    const keyboardTopRef = useRef(0);
    const isNativeMobile = Platform.OS !== 'web';
    const lockFocusedInputIntoView = useCallback((field: 'cpf' | 'password' | null = focusedFieldRef.current) => {
        if (!isNativeMobile || !keyboardVisibleRef.current || !field || keyboardTopRef.current <= 0) return;

        const fieldRef = field === 'cpf' ? cpfFieldRef : passwordFieldRef;

        requestAnimationFrame(() => {
            fieldRef.current?.measureInWindow((_x, y, _width, height) => {
                const inputBottom = y + height;
                const overlap = inputBottom + 72 - keyboardTopRef.current;
                setFocusedInputOffset(overlap > 0 ? -overlap : 0);
            });
        });
    }, [isNativeMobile]);
    const focusField = useCallback((field: 'cpf' | 'password') => {
        focusedFieldRef.current = field;
        lockFocusedInputIntoView(field);
    }, [lockFocusedInputIntoView]);

    useEffect(() => {
        if (!isNativeMobile) return undefined;

        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const showSubscription = Keyboard.addListener(showEvent, (event: KeyboardEvent) => {
            keyboardVisibleRef.current = true;
            keyboardTopRef.current = event.endCoordinates.screenY;
            setKeyboardOpen(true);
            lockFocusedInputIntoView();
        });
        const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
            keyboardVisibleRef.current = false;
            keyboardTopRef.current = 0;
            setKeyboardOpen(false);
            setFocusedInputOffset(0);
        });

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, [isNativeMobile, lockFocusedInputIntoView]);

    return (
        <SafeAreaView style={styles.loginScreen}>
            <LinearGradient colors={gradients.app} style={StyleSheet.absoluteFill} />
            <View style={styles.loginContainer}>
                <ScrollView
                    ref={scrollRef}
                    contentContainerStyle={[
                        styles.loginScrollContent,
                        !layout.isTablet ? styles.loginScrollContentMobile : null,
                        {
                            paddingBottom: Math.max(12, insets.bottom + 12),
                            paddingHorizontal: layout.pagePadding,
                            paddingTop: Math.max(12, insets.top + 12)
                        }
                    ]}
                    keyboardShouldPersistTaps="handled"
                    scrollEnabled={!isNativeMobile || !keyboardOpen}
                    showsVerticalScrollIndicator={Platform.OS === 'web'}
                    style={styles.loginScroll}
                >
                    <View style={[styles.loginCard, layout.isTablet ? styles.loginCardWide : null, { maxWidth: layout.loginMaxWidth, transform: [{ translateY: focusedInputOffset }] }]}>
                        <LinearGradient colors={gradients.brand} style={[styles.loginShowcase, layout.isTablet ? styles.loginShowcaseWide : null]}>
                            <View style={styles.loginMark}>
                                <LockKeyhole color={colors.brandMuted} size={32} />
                            </View>
                            <View style={styles.loginHeaderText}>
                                <Text style={styles.eyebrow}>Acesso eCampus</Text>
                                <Text style={styles.loginTitle}>Meu Campus</Text>
                                <Text style={styles.loginSubtitle}>Acesse suas informacoes academicas com seguranca.</Text>
                            </View>

                            <View style={styles.loginTrustCard}>
                                <Text style={styles.loginFeatureLabel}>Privacidade e seguranca</Text>
                                <Text style={styles.loginFeatureValue}>Sua senha nao fica salva. Ela e usada apenas para autenticar no eCampus.</Text>
                            </View>
                        </LinearGradient>

                        <View style={[styles.loginForm, layout.isTablet ? styles.loginFormWide : null]}>
                            <View style={styles.loginFormHeader}>
                                <Text style={styles.loginFormTitle}>Entrar</Text>
                                <Text style={styles.loginFormText}>Use sua conta institucional para acessar o painel.</Text>
                            </View>

                            <View ref={cpfFieldRef}>
                                <Field label="CPF">
                                    <TextInput
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        inputMode="numeric"
                                        maxLength={14}
                                        onChangeText={(value) => setUser(formatCpf(value))}
                                        onFocus={() => focusField('cpf')}
                                        placeholder="000.000.000-00"
                                        placeholderTextColor={colors.textSubtle}
                                        style={styles.textInput}
                                        value={user}
                                    />
                                </Field>
                            </View>

                            <View ref={passwordFieldRef}>
                                <Field label="Senha">
                                    <View style={styles.passwordWrapper}>
                                        <TextInput
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            onChangeText={setPassword}
                                            onFocus={() => focusField('password')}
                                            placeholder="Sua senha"
                                            placeholderTextColor={colors.textSubtle}
                                            secureTextEntry={!showPassword}
                                            style={[styles.textInput, styles.passwordInput]}
                                            value={password}
                                        />
                                        <Pressable onPress={() => setShowPassword((current) => !current)} style={styles.passwordToggle}>
                                            {showPassword ? <EyeOff color={colors.textMuted} size={18} /> : <Eye color={colors.textMuted} size={18} />}
                                        </Pressable>
                                    </View>
                                </Field>
                            </View>

                            {workspace.error ? (
                                <View style={styles.errorBanner}>
                                    <Text style={styles.errorText}>{workspace.error}</Text>
                                </View>
                            ) : null}

                            <Pressable
                                disabled={workspace.isLoading}
                                onPress={() => void workspace.login({ password, user: onlyDigits(user) })}
                                style={styles.primaryButton}
                            >
                                {workspace.isLoading ? <ActivityIndicator color={colors.inverseText} /> : <KeyRound color={colors.inverseText} size={18} />}
                                <Text style={styles.primaryButtonText}>{workspace.isLoading ? 'Entrando...' : 'Entrar'}</Text>
                            </Pressable>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}
