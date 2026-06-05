import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ZoomService } from './zoom.adapter';

@Injectable()
export class PathwayZoomService extends ZoomService {
  constructor(configService: ConfigService) {
    super(configService, 'PATHWAY_');
  }
}
