import { Injectable, Logger } from '@nestjs/common';
import { Neo4jService } from '../neo4j/neo4j.service';

@Injectable()
export class RecomendedService {
  private readonly logger = new Logger(RecomendedService.name);

  constructor(private readonly neo4jService: Neo4jService) {}

  async recommendPosts(userId: string, limit: number = 10) {
    try {
      const posts = await this.neo4jService.recommendPostsForUser(userId, limit);
      this.logger.log(`Recommended ${posts.length} posts for user ${userId}`);
      return posts;
    } catch (error) {
      this.logger.error(`Failed to recommend posts for user ${userId}`, error);
      throw error;
    }
  }

  async recommendSimilarUsers(userId: string, limit: number = 5) {
    try {
      const users = await this.neo4jService.recommendSimilarUsers(userId, limit);
      this.logger.log(`Recommended ${users.length} similar users for user ${userId}`);
      return users;
    } catch (error) {
      this.logger.error(`Failed to recommend users for user ${userId}`, error);
      throw error;
    }
  }
}
