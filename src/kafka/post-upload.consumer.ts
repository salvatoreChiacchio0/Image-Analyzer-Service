import { Injectable, Logger } from '@nestjs/common';
import { Kafka, logLevel, RetryOptions } from 'kafkajs';
import { VisionService } from '../vision/vision.service';
import { Neo4jService } from '../neo4j/neo4j.service';
import { MongoDBService } from '../mongodb/mongodb.service';
import { AnalyzeResultDto } from '../vision/dto/analyze-result.dto';

@Injectable()
export class PostUploadConsumer {
  private readonly logger = new Logger(PostUploadConsumer.name);
  private readonly kafka: Kafka;
  private readonly consumer;
  private readonly CONNECTION_RETRIES = 10;
  private readonly CONNECTION_RETRY_DELAY = 5000; // 5 seconds

  constructor(
    private readonly visionService: VisionService,
    private readonly neo4jService: Neo4jService,
    private readonly mongoDBService: MongoDBService,
  ) {
    this.kafka = new Kafka({
      clientId: 'image-analyzer',
      brokers: [process.env.KAFKA_BROKERS || 'localhost:29092'],
      logLevel: logLevel.ERROR,
      retry: {
        initialRetryTime: 100,
        retries: 8
      } as RetryOptions,
    });

    this.consumer = this.kafka.consumer({ 
      groupId: process.env.KAFKA_CONSUMER_GROUP || 'post-consumer-group-client',
      maxWaitTimeInMs: 5000,
      sessionTimeout: 30000,
    });
  }



  private async processMessage(message: any, retryCount = 0): Promise<void> {
      const event = message;
      this.logger.log(`Processing photo event for user ${event.userId}`);

      // Convert base64 to buffer
      const base64Data = event.imageUrl.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      this.logger.log(`Buffer size: ${buffer.length} bytes, before processing`);
      const result: AnalyzeResultDto = await this.visionService.analyzeImage(buffer);
      /*const result =  {
        labels: ['nature', 'landscape', 'sunset','mountains'], // Mocked result for testing
      }*/
      this.logger.log(`Keyword retrieved from post: ${JSON.stringify(result.labels)}`);
      // Update both Neo4j and MongoDB
      await Promise.all([
        this.neo4jService.updateInterestGraph(event.userId, result.labels, 2.0),
        this.mongoDBService.updatePostMetadata(event.photoId, result.labels),
        this.neo4jService.createPostAndLinkToUserAndTags(event.userId, event.photoId, result.labels),
      ]);

      this.logger.log('Analysis complete and databases updated');
    
  }

  async start() {
    let retryCount = 0;
    
    while (retryCount < this.CONNECTION_RETRIES) {
      try {
        // Connect to MongoDB first
        await this.mongoDBService.connect();
        
        await this.consumer.connect();

        await this.consumer.subscribe({ 
          topic: 'photo-upload', 
          fromBeginning: false 
        });
        this.logger.log('✅ Successfully subscribed to Kafka - Post Photo Upload');
        await this.consumer.run({
          eachMessage: async ({ topic, partition, message }) => {
            this.logger.log(`📥 Received new photo upload event from topic ${topic} (partition: ${partition})`);
        
            if (!message?.value) {
              this.logger.error('❌ Message value is empty or undefined');
              return;
            }
        
            try {
              const data = JSON.parse(message.value.toString());
              //this.logger.log(`Parsed data: ${JSON.stringify(data)}`);
        
              await this.processMessage(data);
            } catch (error) {
              this.logger.error(`❌ Failed to parse message: ${error.message}`);
            }
          },
        });

        this.logger.log('✅ Kafka consumer started and listening for photo upload events');
        return;
      } catch (error) {
        retryCount++;
        this.logger.error(`❌ Failed to connect to Kafka (attempt ${retryCount}/${this.CONNECTION_RETRIES}): ${error.message}`);
        
        if (retryCount === this.CONNECTION_RETRIES) {
          this.logger.error('❌ Failed to start Kafka consumer after all retries');
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, this.CONNECTION_RETRY_DELAY));
      }
    }
  }

  async stop() {
    try {
      await this.consumer.disconnect();
      await this.mongoDBService.disconnect();
      this.logger.log('Kafka consumer and MongoDB connection stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping services:', error);
      throw error;
    }
  }
}