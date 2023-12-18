import {Injectable} from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as fs from 'fs'
import axios from 'axios';
dotenv.config();

@Injectable()
export class AmoService {
    token_file_path = '.info';
    const
    phoneID = 644421
    emailID = 644423;
    private readonly amoApiUrl = `https://${process.env.SUBDOMAIN}.amocrm.ru/api/v4`;
    private readonly clientId = process.env.CLIENT_ID;
    private readonly clientSecret = process.env.CLIENT_SECRET;
    private readonly redirectUri = process.env.REDIRECT_URL;
    private accessToken: string | null = null;
    private refreshToken: string | null = null;
    private expiresIn: number | null = null;

//получение токена и различные проверки
    async getAccessToken(): Promise<string> {
        //проверка на наличие файла с refresh_token`ом
        if (fs.existsSync(this.token_file_path) && !this.is_set_access_token()) {
            this.refreshToken = fs.readFileSync(this.token_file_path).toString();
            await this.refreshAccessToken();
            return this.accessToken;
        }
        //проверка на существование access_token`а
        if (this.is_set_access_token()) {
            //проверка на жизнеспособность токена и получение нового, если этот не живой
            if (Date.now() >= this.expiresIn) {
                await this.refreshAccessToken();
            }
        } else {
            await this.getRefreshToken()
        }
        return this.accessToken;
    }
//метод для проверки токенов на существования
    is_set_access_token(): boolean {
        return (this.accessToken != null && this.refreshToken != null);
    }
//метод для получения refresh token`а при помощи authorization code
    async getRefreshToken(): Promise<any> {
        const tokenUrl = `https://${process.env.SUBDOMAIN}.amocrm.ru/oauth2/access_token`;
        const requestBody = {
            client_id: this.clientId,
            client_secret: this.clientSecret,
            grant_type: 'authorization_code',
            code: process.env.AUTH_TOKEN,
            redirect_uri: this.redirectUri,
        };

        try {
            const response = await axios.post(tokenUrl, requestBody);
            let data = response.data;
            this.accessToken = data.access_token;
            this.refreshToken = data.refresh_token;
            //получение нового refresh токена и запись его в файл(файл создается, если не был найден)
            fs.writeFileSync(this.token_file_path, this.refreshToken, {flag: 'w'})
            this.expiresIn = Date.now() + data.expires_in;
        } catch (error) {
            console.error('Error getting access token:', error.response ? error.response.data : error.message);
            throw error;
        }
    }
//Получение нового access и refresh token`a при помощи старого refresh token`a
    async refreshAccessToken(): Promise<any> {
        if (!this.refreshToken) {
            throw new Error('Refresh token is missing.');
        }

        const tokenUrl = `https://${process.env.SUBDOMAIN}.amocrm.ru/oauth2/access_token`;
        const requestBody = {
            client_id: this.clientId,
            client_secret: this.clientSecret,
            grant_type: 'refresh_token',
            refresh_token: this.refreshToken,
            redirect_uri: this.redirectUri,
        };

        try {
            const response = await axios.post(tokenUrl, requestBody);
            this.accessToken = response.data.access_token;
            this.refreshToken = response.data.refresh_token;
            fs.writeFileSync(this.token_file_path, this.refreshToken, {flag: 'w'})
            this.expiresIn = Date.now() + response.data.expires_in;
            return response.data;
        } catch (error) {
            console.error('Error refreshing access token:', error.response ? error.response.data : error.message);
            throw error;
        }

    }
//Метод для получения и обработки данных контакта
    async processAmoData(name: string, email: string, phone: string): Promise<string> {
        const contactUrlphone = `${this.amoApiUrl}/contacts?query=${phone}`;
        const contactUrlemail = `${this.amoApiUrl}/contacts?query=${email}`;
        const header = {
            headers: {
                Authorization: `Bearer ${this.accessToken}`,
            },
        };
        //Очень кривая проверка на полученные http коды
        let contactResponse = await axios.get(contactUrlphone, header);
        let contactResponse2 = await axios.get(contactUrlemail, header);
        if (contactResponse.status == 200 || contactResponse2.status == 200) {

            !contactResponse.data['_embedded'] ? contactResponse = contactResponse2 : contactResponse = contactResponse;
            let fields = contactResponse.data['_embedded']['contacts'][0]['custom_fields_values'];

            let tmp = 0;
            for (let i = 0; i < fields.length; i++) {
                if (fields[i]['field_id'] == this.phoneID) {
                    if (fields[i]['values'][0]['value'] != phone) {

                        tmp++;
                        contactResponse.data['_embedded']['contacts'][0]['custom_fields_values'][i]['values'][0]['value'] = phone
                    }
                }
                if (fields[i]['field_id'] == this.emailID) {
                    if (fields[i]['values'][0]['value'] != email) {

                        tmp++;
                        contactResponse.data['_embedded']['contacts'][0]['custom_fields_values'][i]['values'][0]['value'] = email
                    }
                }

            }
            if (tmp == 0) {
                return contactResponse.data['_embedded']['contacts'][0]
            } else {
                try {
                    await axios.patch(`${this.amoApiUrl}/contacts/${contactResponse.data['_embedded']['contacts'][0]['id']}`, contactResponse.data['_embedded']['contacts'][0], header)
                    return contactResponse.data['_embedded']['contacts'][0]
                } catch (e) {
                    return e.response.data;
                }
            }
        } else {
            if (contactResponse.status == 204) {
                const resp = await axios.get(contactUrlemail, header)
                if (resp.status == 204) {
                    const requestBody = [{
                        name: name,
                        custom_fields_values: [
                            {
                                field_id: this.phoneID,
                                values: [{
                                    value: phone
                                }]
                            },
                            {
                                field_id: this.emailID,
                                values: [{
                                    value: email
                                }]
                            }
                        ]
                    }]
                    try {
                        let response = await axios.post(`${this.amoApiUrl}/contacts`, requestBody, header);
                        return response.data['_embedded']['contacts'][0]
                    } catch (e) {
                        return e.response ? e.response.data : e.message
                    }
                } else {
                    if (resp.status == 200) {

                        return resp.data['_embedded']['contacts'][0]
                    }
                }
            } else {
                throw new Error('Неизвестная ошибка');
            }
        }
    }

}
