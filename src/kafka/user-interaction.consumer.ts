import { Injectable, Logger } from '@nestjs/common';
import { Kafka, logLevel, RetryOptions } from 'kafkajs';
import { Neo4jService } from '../neo4j/neo4j.service';

interface UserInteractionEvent {
  userId: string;
  postId: string;
  tag: string[];
  interactionType: 'LIKE' | 'COMMENT' | 'DISLIKE' | 'HIDE' | 'POST';
  timestamp: number;
}

@Injectable()
export class UserInteractionConsumer {
  private readonly logger = new Logger(UserInteractionConsumer.name);
  private readonly kafka: Kafka;
  private readonly consumer;
  private readonly CONNECTION_RETRY_DELAY = 5000; // 5 seconds

  private readonly WEIGHT_CHANGES = {
    LIKE: 0.5,
    COMMENT: 1.0,
    HIDE: -1.0,
    DISLIKE: -0.5,
    POST: 2.0,
  };

  constructor(private readonly neo4jService: Neo4jService) {
    this.kafka = new Kafka({
      clientId: 'user-interaction-consumer',
      brokers: [process.env.KAFKA_BROKERS || 'localhost:29092'],
      logLevel: logLevel.ERROR,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      } as RetryOptions,
    });

    this.consumer = this.kafka.consumer({
      groupId: 'user-interaction-group',
      maxWaitTimeInMs: 5000,
      sessionTimeout: 30000,
    });
  }

  private async validateMessage(message: any): Promise<boolean> {
    if (!message.value) {
      this.logger.error('Received message with null or undefined value');
      return false;
    }

    try {
      const event = JSON.parse(message.value.toString()) as UserInteractionEvent;
      if (!event.userId || !event.tag || !event.interactionType || !event.timestamp) {
        this.logger.error('Invalid message format: missing required fields');
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error('Failed to parse message:', error);
      return false;
    }
  }

  private async onUserLike(message: any): Promise<void> {
    try {
      const event = JSON.parse(message.value.toString()) as UserInteractionEvent;
      this.logger.log(`Processing ${event.interactionType} event for user ${event.userId}`);

      const weightChange = this.WEIGHT_CHANGES[event.interactionType];
      this.logger.log(`Weight change for ${event.interactionType}: ${weightChange}`);

      for (const tag of event.tag) {
        await this.neo4jService.updateInterestWeight(event.userId, tag, weightChange);
      }

      this.logger.log(`Updated interest weights for user ${event.userId}`);

      // Interazione User → Post
      await this.neo4jService.createUserPostInteraction(
        event.userId,
        event.postId,
        event.interactionType,
        weightChange
      );

      const eventAge = Date.now() - event.timestamp;
      if (eventAge > 60 * 1000) {
        const decayFactor = Math.pow(0.95, Math.floor(eventAge / (60 * 1000)));
        await this.neo4jService.applyTimeDecay(event.userId, decayFactor);
      }

      await this.neo4jService.normalizeInterestVector(event.userId);

      this.logger.log('Interaction processed and Neo4j updated');
    } catch (error) {
      try {
        const event = JSON.parse(message.value.toString()) as UserInteractionEvent;
        this.logger.error(`User Interaction event ${event.interactionType} failed`, error);
      } catch {
        this.logger.error('Failed to parse message value', error);
      }
    }
  }

  async start() {
    try {
      await this.consumer.connect();
      await this.consumer.subscribe({
        topic: 'user-interaction-topic',
        fromBeginning: false,
      });

      this.logger.log('✅ Successfully subscribed to Kafka - User Interaction Consumer');

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          this.logger.log(`📥 Received new user interaction event from topic ${topic}`);

          if (!(await this.validateMessage(message))) {
            this.logger.error('❌ Invalid message format received');
            return;
          }

          await this.onUserLike(message);
        },
      });

      this.logger.log('✅ Kafka consumer started and listening for user interaction events');
    } catch (error) {
      this.logger.error(`❌ Failed to connect to Kafka: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, this.CONNECTION_RETRY_DELAY));
    }
  }
}
