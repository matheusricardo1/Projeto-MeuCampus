import type { ComponentType } from 'react';
import { Platform } from 'react-native';
import type { MercadoPagoCardBrickProps } from './mercadopago-card-brick.types';

/**
 * Metro resolves the platform-specific sibling (`.web.tsx` / `.native.tsx`)
 * before this plain file, so this implementation only runs as a fallback
 * for tools (like `tsc`) that don't do Metro's platform-suffix resolution.
 * The `require` stays lazy so the untaken platform's module body — e.g. the
 * `react-native-webview` import in `.native.tsx` — never executes.
 */
export function MercadoPagoCardBrick(props: MercadoPagoCardBrickProps) {
    const Impl: ComponentType<MercadoPagoCardBrickProps> = Platform.OS === 'web'
        ? require('./mercadopago-card-brick.web').MercadoPagoCardBrick
        : require('./mercadopago-card-brick.native').MercadoPagoCardBrick;

    return <Impl {...props} />;
}
