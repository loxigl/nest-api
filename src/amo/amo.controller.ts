import {Controller, Get, Query} from '@nestjs/common';
import {AmoService} from "./amo.service";
import axios from "axios";


@Controller('amo')
export class AmoController {
    constructor(private readonly appService: AmoService) {
    }

    @Get()
    get() {
        return process.cwd()
    }
//получение access токена для доступа к api
    @Get('get_access_token')
    async get_token() {
        return this.appService.getAccessToken().then(function (token) {
            return token;
        })
    }
//Ендпоинт для получения контактов и создания сделки
    @Get('contacts')
    async processAmoData(
        //обязательные параметры
        @Query('name') name: string,
        @Query('email') email: string,
        @Query('phone') phone: string,
    ): Promise<string> {
        const response = await this.appService.processAmoData(name, email, phone)
        const header = {
            headers: {
                Authorization: `Bearer ${await this.get_token()}`,
            },
        };
        //создание body для запроса с случайными именем и ценой, а так же с добавлением контакта полученного ранее
        const body = [{
            "name": `Сделка для ${name} № ${Math.floor(Math.random() * 10000)}`,
            "price": Math.floor(Math.random() * 1000000),
            "_embedded": {"contacts": [response]}
        }]
        try {
             await axios.post(`https://${process.env.SUBDOMAIN}.amocrm.ru/api/v4/leads/complex`, body, header);
             return 'OK'
        } catch (e) {
            return e.response.data;
        }

    }


}
