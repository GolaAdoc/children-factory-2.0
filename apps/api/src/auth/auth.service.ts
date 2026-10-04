import { ConflictException, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto, LoginDto } from './auth.dto';

const ARGON_OPTS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash!: string;
  private ttl!: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {
    this.ttl = Number(process.env.JWT_ACCESS_TTL_SECONDS || 900);
  }

  async onModuleInit() {
    this.dummyHash = await argon2.hash('p4-dummy-not-a-real-password', ARGON_OPTS);
  }

  async signup(dto: SignupDto) {
    const email = dto.email.trim().toLowerCase();
    const passwordHash = await argon2.hash(dto.password, ARGON_OPTS);
    try {
      const user = await this.prisma.user.create({
        data: { email, passwordHash, name: dto.name.trim(), phoneNumber: dto.phoneNumber, isGuest: false },
        select: { id: true, email: true, name: true, role: true },
      });
      return this.session(user);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Unable to create account with the provided details');
      }
      throw e;
    }
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const rows = await this.prisma.$queryRaw<Array<{id:string;email:string;name:string|null;role:string;passwordHash:string|null}>>`
      SELECT id, email, name, role, password_hash AS "passwordHash" FROM users WHERE lower(email) = ${email} LIMIT 1`;
    const u = rows[0];
    const ok = await this.verify(u?.passwordHash ?? this.dummyHash, dto.password);
    if (!u || !u.passwordHash || !ok) throw new UnauthorizedException('Invalid email or password');
    return this.session({ id: u.id, email: u.email, name: u.name, role: u.role });
  }

  private async verify(hash: string, pw: string) {
    try {
      return await argon2.verify(hash, pw);
    } catch {
      return false;
    }
  }

  private session(u: { id: string; email: string | null; name: string | null; role: string }) {
    const accessToken = this.jwt.sign({ sub: u.id, role: u.role });
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.ttl,
      user: u,
    };
  }

  async getMe(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) throw new UnauthorizedException('Unauthorized');
    return user;
  }
}
