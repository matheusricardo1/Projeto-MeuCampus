export const colors = {
    canvas: '#F6F7F9',
    surface: '#FFFFFF',
    surfaceMuted: '#F1F4F3',
    surfaceSubtle: '#F8FAF9',
    border: '#D9E0DD',
    borderStrong: '#C3CCC8',
    text: '#172B26',
    textMuted: '#5C6B66',
    textSubtle: '#7A8783',
    inverseText: '#FFFFFF',
    brand: '#0B6B52',
    brandDark: '#0B3D32',
    brandMuted: '#DDEFE8',
    brandSubtle: '#EEF7F3',
    info: '#2563EB',
    infoSubtle: '#EAF1FF',
    success: '#15803D',
    successSubtle: '#E7F6EC',
    warning: '#B45309',
    warningSubtle: '#FFF4D7',
    danger: '#B42318',
    dangerSubtle: '#FFF0ED',
    dangerBorder: '#FECACA',
    overlayOnBrand: 'rgba(255,255,255,0.12)',
    overlayBorderOnBrand: 'rgba(255,255,255,0.16)'
} as const;

export const gradients = {
    app: [colors.canvas, colors.canvas, colors.canvas] as const,
    brand: ['#0B3D32', '#0B6B52'] as const,
    surface: [colors.surface, colors.surfaceSubtle] as const
} as const;

export const spacing = {
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    10: 40
} as const;

export const radii = {
    xs: 4,
    sm: 6,
    md: 8,
    lg: 10,
    pill: 999
} as const;

export const fonts = {
    sans: 'System',
    medium: 'System'
} as const;

export const typography = {
    eyebrow: {
        fontFamily: fonts.medium,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0
    },
    title: {
        fontFamily: fonts.medium,
        fontSize: 20,
        fontWeight: '700',
        lineHeight: 26
    },
    body: {
        fontFamily: fonts.sans,
        fontSize: 14,
        lineHeight: 20
    },
    label: {
        fontFamily: fonts.medium,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0
    }
} as const;

export const shadows = {
    none: {
        elevation: 0,
        shadowOpacity: 0
    },
    surface: {
        elevation: 0,
        shadowColor: '#101828',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0,
        shadowRadius: 0
    }
} as const;
