import { Injectable } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { ImageInfo } from './interfaces/image-info.interface';

@Injectable()
export class GcsService {
  private storage = new Storage();
  private bucketName = process.env.GCS_BUCKET_NAME || '';

  async downloadImage(imageUrl: string): Promise<ImageInfo> {
    const url = new URL(imageUrl);
    const filePath = url.pathname.substring(1); // Remove leading "/"
    if (!this.bucketName) {
      throw new Error('GCS_BUCKET_NAME is not defined in the environment variables.');
    }
    const file = this.storage.bucket(this.bucketName).file(filePath);

    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();

    return {
      buffer,
      contentType: metadata.contentType || 'image/jpeg',
    };
  }
}