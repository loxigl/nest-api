import {Module} from '@nestjs/common';
import {AmoController} from './amo/amo.controller';
import {AmoService} from './amo/amo.service';

@Module({
    imports: [],
    controllers: [AmoController],
    providers: [AmoService],
})
export class AppModule {
}
