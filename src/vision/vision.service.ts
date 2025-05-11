import { Injectable, Logger } from '@nestjs/common';
import { v1 } from '@google-cloud/vision';
import { AnalyzeResultDto } from './dto/analyze-result.dto';

@Injectable()
export class VisionService {
  private client = new v1.ImageAnnotatorClient();
  
  private readonly logger = new Logger(VisionService.name);

  async analyzeImage(buffer: Buffer): Promise<AnalyzeResultDto> {
    this.logger.log('Analyzing image...');
    const [result] = await this.client.annotateImage({
      image: { content: buffer },
      features: [
        { type: 'LABEL_DETECTION', maxResults: 5 },
        { type: 'LANDMARK_DETECTION', maxResults: 1 },
        { type: 'TEXT_DETECTION', maxResults: 1 },
        { type: 'OBJECT_LOCALIZATION', maxResults: 5 },
      ],
    });
    return this.parseResult(result);
  }

  private parseResult(result: any): AnalyzeResultDto {
    const labels = result.labelAnnotations?.map((a) => a.description) || [];
    const landmarks = result.landmarkAnnotations?.map((a) => a.description) || [];
    const texts = result.textAnnotations?.map((a) => a.description) || [];
    const objects = result.localizedObjectAnnotations?.map((o) => o.name) || [];

    const finalLabel = [...new Set([...labels, ...objects])].slice(0, 5)
    finalLabel.push(...landmarks)
    return {
      labels:finalLabel,
      landmarks,
      texts,
      hashtags: this.generateHashtags(labels),
    };
  }

  private generateHashtags(labels: string[]): string[] {
    return labels.slice(0, 3).map(tag => `#${tag.replace(/\s+/g, '')}`);
  }
}