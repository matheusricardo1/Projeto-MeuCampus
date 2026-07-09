export type CardBrickTokenResult = {
    token: string;
    paymentMethodId: string;
    issuerId?: string;
    installments: number;
};

export type MercadoPagoCardBrickProps = {
    publicKey: string;
    amount: number;
    onToken: (result: CardBrickTokenResult) => void;
    onError: (message: string) => void;
};
