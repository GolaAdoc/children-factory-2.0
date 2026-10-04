import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_ACCESS_SECRET;
        if (!secret || secret.length < 32) {
          throw new Error('JWT_ACCESS_SECRET must be at least 32 characters long');
        }
        const ttl = Number(process.env.JWT_ACCESS_TTL_SECONDS || 900);
        return {
          secret,
          signOptions: {
            algorithm: 'HS256',
            expiresIn: ttl,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PrismaService],
})
export class AuthModule {}
