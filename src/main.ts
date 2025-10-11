import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { readFileSync } from 'fs'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Enable CORS for all origins in development (or specify your IPs)
  app.enableCors({
    origin: true, // Allow all origins in development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  )

  // Setup Swagger OpenAPI docs
  const config = new DocumentBuilder()
    .setTitle('Famemely API')
    .setDescription('Authentication and basic APIs for Famemely')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'jwt'
    )
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api', app, document)

  // Listen on all network interfaces (0.0.0.0) to allow device connections
  await app.listen(3001, '0.0.0.0')
  console.log('🚀 Backend running on http://0.0.0.0:3001')
  console.log('📱 Accessible at http://192.168.3.105:3001')
}
bootstrap()
