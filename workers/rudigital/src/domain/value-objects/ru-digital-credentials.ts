export interface RuDigitalCredentials {
    cpf: string;
    /** The `session_token` JWT cookie value, once authenticated. */
    token?: string;
    /** The chosen university restaurant (`restaurante_default_id` cookie), if any. */
    restaurantId?: string;
}
