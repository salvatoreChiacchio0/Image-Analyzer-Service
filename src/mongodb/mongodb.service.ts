import { Injectable, Logger } from '@nestjs/common';
import { MongoClient, ObjectId } from 'mongodb';

@Injectable()
export class MongoDBService {
  private readonly logger = new Logger(MongoDBService.name);
  private client: MongoClient;
  private db: any;

  constructor() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    this.client = new MongoClient(uri);
  }

  async connect() {
    try {
      await this.client.connect();
      this.db = this.client.db('AP_BE');
      this.logger.log('Connected to MongoDB AP_BE database');
    } catch (error) {
      this.logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async updatePostMetadata(photoId: string, labels: string[]) {
    try {
      const result = await this.db.collection('posts').updateOne(
        { _id: new ObjectId(photoId) },
        { 
          $set: { 
            'metadata.keywords': labels,
            'metadata.analyzedAt': new Date()
          } 
        }
      );

      if (result.matchedCount === 0) {
        this.logger.warn(`No post found with id ${photoId}`);
        return false;
      }

      this.logger.log(`Updated metadata for post ${photoId} with labels: ${labels.join(', ')}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update post metadata for ${photoId}:`, error);
      throw error;
    }
  }

  async disconnect() {
    try {
      await this.client.close();
      this.logger.log('Disconnected from MongoDB');
    } catch (error) {
      this.logger.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }
} 