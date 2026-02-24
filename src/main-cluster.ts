import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as cluster from 'cluster';
import * as os from 'os';

async function bootstrap() {
  if (cluster.isPrimary) {
    const numCPUs = process.env.CLUSTER_WORKERS
      ? parseInt(process.env.CLUSTER_WORKERS)
      : os.cpus().length;

    console.log(`Primary process ${process.pid} is running`);
    console.log(`Forking ${numCPUs} workers...`);

    // Fork workers
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
      console.log(
        `Worker ${worker.process.pid} died (${signal || code}). Restarting...`,
      );
      cluster.fork();
    });

    cluster.on('online', (worker) => {
      console.log(`Worker ${worker.process.pid} is online`);
    });
  } else {
    const app = await NestFactory.create(AppModule);
    app.enableCors();
    app.setGlobalPrefix('event-service');

    const options = new DocumentBuilder()
      .setTitle('Event Management')
      .setDescription('CRUD API')
      .setVersion('1.0')
      .addApiKey(
        { type: 'apiKey', name: 'Authorization', in: 'header' },
        'access-token',
      )
      .build();

    const document = SwaggerModule.createDocument(app, options);
    SwaggerModule.setup('api/swagger-docs', app, document);

    const port = process.env.PORT || 3000;
    await app.listen(port);
    console.log(`Worker ${process.pid} started on port ${port}`);
  }
}

bootstrap();
