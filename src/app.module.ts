import { Module } from '@nestjs/common';
import { VisionService } from './vision/vision.service';
import { PostUploadConsumer } from './kafka/post-upload.consumer';
import { UserInteractionConsumer } from './kafka/user-interaction.consumer';
import { Neo4jService } from './neo4j/neo4j.service';
import { MongoDBService } from './mongodb/mongodb.service';
import { ConfigModule } from '@nestjs/config';
import { RecommendationConsumer } from './kafka/recommendation.consumer';
import { RecomendedService } from './recomended/recomended.service';

@Module({
  imports: [    
  ConfigModule.forRoot({
    isGlobal: true,
  })
],
  controllers: [],
  providers: [
    VisionService,
    PostUploadConsumer,
    UserInteractionConsumer,
    Neo4jService,
    MongoDBService,
    RecomendedService,
    RecommendationConsumer
  ],
})
export class AppModule {}