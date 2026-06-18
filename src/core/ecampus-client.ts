// src/core/ecampus-client.ts
import axios, { type AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { logger } from './logger';

export class EcampusClient {
    public readonly BASE_URL = 'https://ecampus.ufam.edu.br/ecampus';
    public session: AxiosInstance;
    public jar: CookieJar;
    public isAuthenticated: boolean = false;

    constructor() {
        this.jar = new CookieJar();
        
        const client = axios.create({
            baseURL: this.BASE_URL,
            withCredentials: true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        
        this.session = wrapper(client);
        this.session.defaults.jar = this.jar;
    }

    exportCookies(): object {
        return this.jar.toJSON() ?? {};
    }

    importCookies(cookieDict: object): void {
        this.jar = CookieJar.fromJSON(cookieDict as any) || new CookieJar();
        this.session.defaults.jar = this.jar;
        logger.info("Cookies loaded into the session.");
    }

    async isSessionAlive(): Promise<boolean> {
        const urlCheck = '/home/index';
        try {
            const response = await this.session.get(urlCheck, { maxRedirects: 0, validateStatus: (status) => status < 400 });
            
            if (response.status === 200 && !response.data.includes('loginValida')) {
                this.isAuthenticated = true;
                logger.info("Session is alive and valid.");
                return true;
            } else {
                this.isAuthenticated = false;
                logger.warning("Session has expired or is invalid.");
                return false;
            }
        } catch (error) {
            this.isAuthenticated = false;
            logger.warning("Session check failed or expired.");
            return false;
        }
    }
}
