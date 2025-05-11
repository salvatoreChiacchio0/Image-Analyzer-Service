import { Injectable, Logger } from '@nestjs/common';
import { Kafka, logLevel, RetryOptions } from 'kafkajs';
import { RecomendedService } from '../recomended/recomended.service';

interface RecommendationRequest {
  userId: string;
  type: 'POSTS' | 'USERS';
  limit?: number;
}

@Injectable()
export class RecommendationConsumer {
  private readonly logger = new Logger(RecommendationConsumer.name);
  private readonly kafka: Kafka;
  private readonly consumer;

  constructor(private readonly recommendedService: RecomendedService) {
    this.kafka = new Kafka({
      clientId: 'recommendation-consumer',
      brokers: [process.env.KAFKA_BROKERS || 'localhost:29092'],
      logLevel: logLevel.ERROR,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      } as RetryOptions,
    });

    this.consumer = this.kafka.consumer({ 
      groupId: 'recommendation-consumer-group',
    });
  }

  async start() {
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: 'recommendation-request-topic',
      fromBeginning: false,
    });

    this.logger.log('✅ Recommendation consumer connected and subscribed');

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        this.logger.log(`📩 Received message on topic ${topic}`);
        try {
          const payload = JSON.parse(message.value.toString()) as RecommendationRequest;

          const limit = payload.limit ?? 10;
          let recommendations;

          if (payload.type === 'POSTS') {
            recommendations = await this.recommendedService.recommendPosts(payload.userId, limit);
          } else if (payload.type === 'USERS') {
            recommendations = await this.recommendedService.recommendSimilarUsers(payload.userId, limit);
          } else {
            this.logger.warn(`⚠️ Unknown recommendation type: ${payload.type}`);
            return;
          }

          this.logger.log(`✅ Recommendations for ${payload.userId}: ${JSON.stringify(recommendations)}`);
          // Qui puoi anche inviarle ad un altro topic, websocket, DB, etc.
        } catch (err) {
          this.logger.error('❌ Failed to process recommendation request', err);
        }
      },
    });
  }
}
