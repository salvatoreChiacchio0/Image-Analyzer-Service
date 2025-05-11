import { Injectable, Logger } from '@nestjs/common';
import neo4j, { Driver, Session } from 'neo4j-driver';

@Injectable()
export class Neo4jService {
  private driver: Driver;
  private readonly logger = new Logger(Neo4jService.name);

  constructor() {
    const uri = process.env.NEO4J_URI;
    const username = process.env.NEO4J_USERNAME;
    const password = process.env.NEO4J_PASSWORD;

    if (!uri || !username || !password) {
      throw new Error('Missing Neo4j configuration');
    }

    this.logger.log(`Connecting to Neo4j...`);
    this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password), {
      encrypted: 'ENCRYPTION_OFF',
    });
  }

  async updateInterestWeight(
    userId: string,
    tag: string,
    weightChange: number,
  ): Promise<void> {
    const session: Session = this.driver.session();
    try {
      await session.run(
        `
        MERGE (u:User {id: $userId})
        MERGE (t:Tag {name: $tag})
        MERGE (u)-[r:INTERESTED_IN]->(t)
        ON CREATE SET r.weight = $weightChange, r.lastUpdated = datetime()
        ON MATCH SET r.weight = r.weight + $weightChange, r.lastUpdated = datetime()
        `,
        { userId, tag, weightChange },
      );
    } finally {
      await session.close();
    }
  }

  async createUserPostInteraction(
    userId: string,
    postId: string,
    interactionType: string,
    weight: number,
  ): Promise<void> {
    const session: Session = this.driver.session();
    try {
      await session.run(
        `
        MERGE (u:User {id: $userId})
        MERGE (p:Post {id: $postId})
        MERGE (u)-[r:INTERACTED_WITH {type: $interactionType}]->(p)
        ON CREATE SET r.weight = $weight, r.timestamp = timestamp()
        ON MATCH SET r.weight = r.weight + $weight, r.timestamp = timestamp()
        `,
        { userId, postId, interactionType, weight },
      );
    } finally {
      await session.close();
    }
  }

  async createPostAndLinkToUserAndTags(userId: string, postId: string, tags: string[]): Promise<void> {
  const session = this.driver.session();
  try {
    await session.run(
      `
      MATCH (u:User {id: $userId})
      MERGE (p:Post {id: $postId})
      MERGE (u)-[:CREATED]->(p)
      WITH p
      UNWIND $tags AS tag
      MERGE (t:Tag {name: tag})
      MERGE (p)-[:HAS_TAG]->(t)
      `,
      { userId, postId, tags }
    );
  } finally {
    await session.close();
  }
}


  async applyTimeDecay(
    userId: string,
    decayFactor: number = 0.95,
  ): Promise<void> {
    const session: Session = this.driver.session();
    try {
      await session.run(
        `
        MATCH (u:User {id: $userId})-[r:INTERESTED_IN]->(:Tag)
        SET r.weight = r.weight * $decayFactor
        `,
        { userId, decayFactor },
      );
    } finally {
      await session.close();
    }
  }

  async normalizeInterestVector(userId: string): Promise<void> {
    const getWeightsQuery = `
      MATCH (u:User {id: $userId})-[r:INTERESTED_IN]->(:Tag)
      RETURN collect(r.weight) AS weights
    `;
    const result = await this.read(getWeightsQuery, { userId });
    const weights: number[] = result.records[0].get('weights');
    const norm = Math.sqrt(weights.reduce((sum, w) => sum + w * w, 0));

    if (norm === 0) return;

    const updateQuery = `
      MATCH (u:User {id: $userId})-[r:INTERESTED_IN]->(:Tag)
      SET r.weight = r.weight / $norm
    `;
    await this.write(updateQuery, { userId, norm });
  }

  // Utilità per lettura
  async read(query: string, params: Record<string, any>) {
    const session = this.driver.session();
    try {
      return await session.run(query, params);
    } finally {
      await session.close();
    }
  }

  // Utilità per scrittura
  async write(query: string, params: Record<string, any>) {
    const session = this.driver.session();
    try {
      return await session.writeTransaction((tx) => tx.run(query, params));
    } finally {
      await session.close();
    }
  }

  async recommendSimilarUsers(userId: string, limit: number = 5) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
      MATCH (u1:User {id: $userId})-[r1:INTERESTED_IN]->(t:Tag)<-[r2:INTERESTED_IN]-(u2:User)
      WHERE u1.id <> u2.id
      WITH u2.id AS similarUserId, 
           sum(r1.weight * r2.weight) AS dotProduct,
           sqrt(sum(r1.weight^2)) AS norm1,
           sqrt(sum(r2.weight^2)) AS norm2
      WITH similarUserId, dotProduct / (norm1 * norm2) AS similarity
      RETURN similarUserId, similarity
      ORDER BY similarity DESC
      LIMIT $limit
      `,
        { userId, limit },
      );

      const recc = result.records.map((record) => ({
        userId: record.get('similarUserId'),
        similarity: record.get('similarity'),
      }));
      this.logger.log(
        `Recommended ${recc.length} similar users for user ${userId}`,
      );
      return recc;
    } finally {
      await session.close();
    }
  }

  async recommendPostsForUser(userId: string, limit: number = 10) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
      MATCH (u:User {id: $userId})-[r:INTERESTED_IN]->(t:Tag)<-[:HAS_TAG]-(p:Post)
      OPTIONAL MATCH (u)-[i:INTERACTED_WITH]->(p)
      WHERE i IS NULL  // Esclude già visti/interagiti
      RETURN p.id AS postId, sum(r.weight) AS score
      ORDER BY score DESC
      LIMIT $limit
      `,
        { userId, limit },
      );

      return result.records.map((record) => ({
        postId: record.get('postId'),
        score: record.get('score'),
      }));
    } finally {
      await session.close();
    }
  }

  async updateInterestGraph(userId: string, tags: string[], weightChange: number): Promise<void> {
  const session = this.driver.session();
  try {
    await session.run(
      `
      MATCH (u:User {id: $userId})
      UNWIND $tags AS tag
      MERGE (t:Tag {name: tag})
      MERGE (u)-[r:INTERESTED_IN]->(t)
      ON CREATE SET r.weight = $weightChange, r.lastUpdated = datetime()
      ON MATCH SET r.weight = r.weight + $weightChange, r.lastUpdated = datetime()
      `,
      { userId, tags, weightChange }
    );
  } finally {
    await session.close();
  }
}

}
