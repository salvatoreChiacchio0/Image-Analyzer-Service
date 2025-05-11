import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { KafkaConsumer } from './kafka/kafka.consumer';
import { UserInteractionConsumer } from './kafka/user-interaction.consumer';
import * as dotenv from 'dotenv';
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Start both Kafka consumers
  const kafkaConsumer = app.get(KafkaConsumer);
  const userInteractionConsumer = app.get(UserInteractionConsumer);
  
  await Promise.all([
    kafkaConsumer.start(),
    userInteractionConsumer.start()
  ]);
  
  await app.listen(3000);
}
bootstrap();