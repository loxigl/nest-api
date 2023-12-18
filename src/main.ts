import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
//сборка приложения и запуск прослушивателя на 3030 порту
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3030);
}
bootstrap();
