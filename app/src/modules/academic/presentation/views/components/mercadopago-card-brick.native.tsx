import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import { colors, spacing } from '@/shared/design-system';
import type { CardBrickTokenResult, MercadoPagoCardBrickProps } from './mercadopago-card-brick.types';

const DEFAULT_API_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://127.0.0.1:3001';

// The Card Payment Brick's secure iframe validates its parent origin, so the
// WebView needs a real (not opaque/about:blank) origin — inline HTML has
// none by default. Using the API's own origin as baseUrl gives it one; it
// doesn't need to actually serve this HTML.
const WEBVIEW_BASE_URL = process.env.EXPO_PUBLIC_ECAMPUS_API_URL
    || process.env.NEXT_PUBLIC_ECAMPUS_API_URL
    || DEFAULT_API_BASE_URL;

type BrickMessage =
    | { type: 'token'; token: string; paymentMethodId: string; issuerId?: string; installments: number }
    | { type: 'error'; message: string }
    | { type: 'ready' };

export function MercadoPagoCardBrick({ publicKey, amount, onToken, onError }: MercadoPagoCardBrickProps) {
    const [isReady, setIsReady] = useState(false);
    const hasResolvedRef = useRef(false);
    const html = useMemo(() => buildBrickHtml(publicKey, amount), [publicKey, amount]);

    const handleMessage = (event: WebViewMessageEvent) => {
        let payload: BrickMessage | null = null;
        try {
            payload = JSON.parse(event.nativeEvent.data);
        } catch {
            return;
        }

        if (!payload) return;

        if (payload.type === 'ready') {
            setIsReady(true);
            return;
        }

        if (hasResolvedRef.current) return;

        if (payload.type === 'token') {
            hasResolvedRef.current = true;
            const result: CardBrickTokenResult = {
                token: payload.token,
                paymentMethodId: payload.paymentMethodId,
                ...(payload.issuerId ? { issuerId: payload.issuerId } : {}),
                installments: payload.installments
            };
            onToken(result);
        } else if (payload.type === 'error') {
            onError(payload.message);
        }
    };

    return (
        <View style={{ minHeight: 420, width: '100%' }}>
            {!isReady ? (
                <View style={{ alignItems: 'center', paddingVertical: spacing[4], position: 'absolute', width: '100%' }}>
                    <ActivityIndicator color={colors.brand} />
                </View>
            ) : null}
            <WebView
                mixedContentMode="compatibility"
                onMessage={handleMessage}
                originWhitelist={['*']}
                source={{ baseUrl: WEBVIEW_BASE_URL, html }}
                style={{ backgroundColor: 'transparent', flex: 1, minHeight: 420, opacity: isReady ? 1 : 0 }}
            />
        </View>
    );
}

function buildBrickHtml(publicKey: string, amount: number): string {
    return `<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <style>
        body { margin: 0; padding: 0; font-family: -apple-system, sans-serif; }
        #cardPaymentBrick_container { width: 100%; }
    </style>
</head>
<body>
    <div id="cardPaymentBrick_container"></div>
    <script src="https://sdk.mercadopago.com/js/v2"></script>
    <script>
        function post(message) {
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify(message));
            }
        }

        try {
            var mp = new MercadoPago("${escapeForScript(publicKey)}", { locale: "pt-BR" });
            mp.bricks().create("cardPayment", "cardPaymentBrick_container", {
                initialization: { amount: ${JSON.stringify(amount)} },
                customization: {
                    paymentMethods: { minInstallments: 1, maxInstallments: 1 }
                },
                callbacks: {
                    onReady: function () { post({ type: "ready" }); },
                    onError: function (error) {
                        post({ type: "error", message: (error && error.message) || "Dados do cartao invalidos." });
                    },
                    onSubmit: function (cardFormData) {
                        return new Promise(function (resolve, reject) {
                            if (!cardFormData || !cardFormData.token || !cardFormData.payment_method_id) {
                                post({ type: "error", message: "Nao foi possivel validar os dados do cartao." });
                                reject();
                                return;
                            }
                            post({
                                type: "token",
                                token: cardFormData.token,
                                paymentMethodId: cardFormData.payment_method_id,
                                issuerId: cardFormData.issuer_id,
                                installments: cardFormData.installments || 1
                            });
                            resolve();
                        });
                    }
                }
            });
        } catch (e) {
            post({ type: "error", message: "Nao foi possivel carregar o formulario de pagamento." });
        }
    </script>
</body>
</html>`;
}

function escapeForScript(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/</g, '\\u003C');
}
