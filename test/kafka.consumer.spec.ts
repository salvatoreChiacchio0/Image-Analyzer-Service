import { Test, TestingModule } from '@nestjs/testing';
import { KafkaConsumer } from '../src/kafka/post-upload.consumer';
import { VisionService } from '../src/vision/vision.service';
import { GcsService } from '../src/gcs/gcs.service';
import { Neo4jService } from '../src/neo4j/neo4j.service';
import { Kafka } from 'kafkajs';

jest.mock('kafkajs');

describe('KafkaConsumer', () => {
  let service: KafkaConsumer;
  let visionService: VisionService;
  let gcsService: GcsService;
  let neo4jService: Neo4jService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KafkaConsumer,
        {
          provide: VisionService,
          useValue: {
            analyzeImage: jest.fn(),
          },
        },
        {
          provide: GcsService,
          useValue: {
            downloadImage: jest.fn(),
          },
        },
        {
          provide: Neo4jService,
          useValue: {
            updateInterestGraph: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<KafkaConsumer>(KafkaConsumer);
    visionService = module.get<VisionService>(VisionService);
    gcsService = module.get<GcsService>(GcsService);
    neo4jService = module.get<Neo4jService>(Neo4jService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('start', () => {
    it('should connect to Kafka and subscribe to topic', async () => {
      const mockConsumer = {
        connect: jest.fn(),
        subscribe: jest.fn(),
        run: jest.fn(),
      };

      (Kafka as jest.Mock).mockImplementation(() => ({
        consumer: () => mockConsumer,
      }));

      await service.start();

      expect(mockConsumer.connect).toHaveBeenCalled();
      expect(mockConsumer.subscribe).toHaveBeenCalledWith({
        topic: 'photo-upload',
        fromBeginning: false,
      });
    });
  });

  describe('processMessageWithRetry', () => {
    it('should process valid message successfully', async () => {
      const mockMessage = {
        value: JSON.stringify({
          userId: '123',
          imageUrl: 'test-url',
        }),
      };

      const mockBuffer = Buffer.from('test');
      const mockResult = { labels: ['test'] };

      (gcsService.downloadImage as jest.Mock).mockResolvedValue({ buffer: mockBuffer });
      (visionService.analyzeImage as jest.Mock).mockResolvedValue(mockResult);
      (neo4jService.updateInterestGraph as jest.Mock).mockResolvedValue(undefined);

      await service['processMessageWithRetry'](mockMessage);

      expect(gcsService.downloadImage).toHaveBeenCalledWith('test-url');
      expect(visionService.analyzeImage).toHaveBeenCalledWith(mockBuffer);
      expect(neo4jService.updateInterestGraph).toHaveBeenCalledWith('123', ['test']);
    });

    it('should retry on failure', async () => {
      const mockMessage = {
        value: JSON.stringify({
          userId: '123',
          imageUrl: 'test-url',
        }),
      };

      (gcsService.downloadImage as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ buffer: Buffer.from('test') });

      (visionService.analyzeImage as jest.Mock).mockResolvedValue({ labels: ['test'] });
      (neo4jService.updateInterestGraph as jest.Mock).mockResolvedValue(undefined);

      await service['processMessageWithRetry'](mockMessage);

      expect(gcsService.downloadImage).toHaveBeenCalledTimes(2);
    });
  });

  describe('validateMessage', () => {
    it('should validate correct message format', async () => {
      const mockMessage = {
        value: JSON.stringify({
          userId: '123',
          imageUrl: 'test-url',
        }),
      };

      const result = await service['validateMessage'](mockMessage);
      expect(result).toBe(true);
    });

    it('should reject invalid message format', async () => {
      const mockMessage = {
        value: JSON.stringify({
          userId: '123',
          // missing imageUrl
        }),
      };

      const result = await service['validateMessage'](mockMessage);
      expect(result).toBe(false);
    });
  });
}); 