import { Injectable, Logger } from '@nestjs/common';
import neo4j, { Driver, Session } from 'neo4j-driver';
import { ConfigService } from '@nestjs/config';



@Injectable()
export class Neo4jService {
  private driver: Driver;
  private readonly logger = new Logger(Neo4jService.name);

  constructor() {
    const uri = process.env.NEO4J_URI;
    const username = process.env.NEO4J_USERNAME;
    const password = process.env.NEO4J_PASSWORD;

    console.log(uri,username,password );
    
    //console.log(uri, username, password);
    if (!uri || !username || !password) {
      throw new Error('Missing Neo4j configuration');
    }
    this.logger.log(`Connecting to Neo4j...`);
    this.driver = neo4j.driver(
      uri,
      neo4j.auth.basic(username, password),
      { encrypted: 'ENCRYPTION_OFF' }
    );
    this.logger.log(`Connected to Neo4j`,this.driver.getServerInfo());
  }




  async updateInterestGraph(userId: string, tags: string[], weightChange:number): Promise<void> {
    const session: Session = this.driver.session();
    
  
    try {
      for (const tag of tags) {
        await session.run(
          `
          MATCH (u:User {id: $userId})
          MERGE (t:Tag {name: $tag})
          MERGE (u)-[r:INTERESTED_IN]->(t)
          ON CREATE SET r.weight = $weightChange, r.lastUpdated = datetime()
          ON MATCH SET r.weight = r.weight + $weightChange, r.lastUpdated = datetime()
          `,
          { userId, tag, weightChange }
        );
      }
    } finally {
      await session.close();
    }
  }

  async updateInterestWeight(userId: string, tag: string, weightChange: number): Promise<void> {
    const session: Session = this.driver.session();
    try {
      await session.run(
        `
        MERGE (u:User {id: $userId})
        MERGE (t:Tag {name: $tag})
        MERGE (u)-[r:INTERESTED_IN]->(t)
        ON CREATE SET r.weight = $weightChange
        ON MATCH SET r.weight = r.weight + $weightChange
        `,
        { userId, tag, weightChange }
      );
    } finally {
      await session.close();
    }
  }
  

  async applyTimeDecay(userId: string, decayFactor: number = 0.95): Promise<void> {
    const session: Session = this.driver.session();
    try {
      await session.run(
        `
        MATCH (u:User {id: $userId})-[r:INTERESTED_IN]->(t:Tag)
        SET r.weight = r.weight * $decayFactor
        `,
        { userId, decayFactor }
      );
    } finally {
      await session.close();
    }
  }
  async normalizeInterestVector(userId: string): Promise<void> {
    const getWeightsQuery = `
      MATCH (u:User {id: $userId})-[r:INTERESTED_IN]->(t:Tag)
      RETURN collect(r.weight) AS weights
    `;
  
    const result = await this.read(getWeightsQuery, { userId });
    const weights: number[] = result.records[0].get('weights');
    const norm = Math.sqrt(weights.reduce((sum, w) => sum + w * w, 0));
  
    if (norm === 0) return;
  
    const updateQuery = `
      MATCH (u:User {id: $userId})-[r:INTERESTED_IN]->(t:Tag)
      SET r.weight = r.weight / $norm
    `;
    await this.write(updateQuery, { userId, norm });
  }

  
  async read(query: string, params: Record<string, any>) {
    const session = this.driver.session();
    try {
      return await session.run(query, params);
    } finally {
      await session.close();
    }
  }
  
  async write(query: string, params: Record<string, any>) {
    const session = this.driver.session();
    try {
      return await session.writeTransaction(tx => tx.run(query, params));
    } finally {
      await session.close();
    }
  }
}