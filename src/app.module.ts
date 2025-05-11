import { Module } from '@nestjs/common';
import { VisionService } from './vision/vision.service';
import { KafkaConsumer } from './kafka/kafka.consumer';
import { UserInteractionConsumer } from './kafka/user-interaction.consumer';
import { Neo4jService } from './neo4j/neo4j.service';
import { MongoDBService } from './mongodb/mongodb.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [    
  ConfigModule.forRoot({
    isGlobal: true,
  })
],
  controllers: [],
  providers: [
    VisionService,
    KafkaConsumer,
    UserInteractionConsumer,
    Neo4jService,
    MongoDBService
  ],
})
export class AppModule {}