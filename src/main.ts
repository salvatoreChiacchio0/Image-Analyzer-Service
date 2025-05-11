import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PostUploadConsumer } from './kafka/post-upload.consumer';
import { UserInteractionConsumer } from './kafka/user-interaction.consumer';
import * as dotenv from 'dotenv';
import { RecommendationConsumer } from './kafka/recommendation.consumer';
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Start both Kafka consumers
  const postConsumer = app.get(PostUploadConsumer);
  const userInteractionConsumer = app.get(UserInteractionConsumer);
  const reccomendationConsumer = app.get(RecommendationConsumer);
  
  await Promise.all([
    postConsumer.start(),
    userInteractionConsumer.start(),
    reccomendationConsumer.start(),
  ]);
  
  await app.listen(3000);
}
bootstrap();