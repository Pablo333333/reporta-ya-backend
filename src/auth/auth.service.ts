import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { JwtPayload } from './strategies/jwt.strategy';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{ accessToken: string }> {
    const exists = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
    });

    if (exists) {
      throw new ConflictException('El correo electrónico ya está registrado');
    }

    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const rol = await this.prisma.rol.findUnique({
      where: { nombre: dto.rol },
    });

    if (!rol) {
      throw new ConflictException(`El rol "${dto.rol}" no está configurado en el sistema`);
    }

    const usuario = await this.prisma.usuario.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        rolId: rol.id,
      },
    });

    return this.signToken(usuario.id, usuario.email, rol.nombre, usuario.territorioId);
  }

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    this.logger.debug(`[LOGIN] Intento de login — email: "${dto.email}"`);

    const usuario = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
      include: { rol: true },
    });

    if (!usuario) {
      this.logger.warn(`[LOGIN] Usuario NO encontrado en BD para email: "${dto.email}"`);
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    this.logger.debug(
      `[LOGIN] Usuario encontrado — id: ${usuario.id}, rol: ${usuario.rol.nombre}, ` +
      `hash almacenado (primeros 20 chars): "${usuario.password.substring(0, 20)}…"`,
    );

    const passwordMatch = await bcrypt.compare(dto.password, usuario.password);
    this.logger.debug(`[LOGIN] bcrypt.compare resultado: ${passwordMatch}`);

    if (!passwordMatch) {
      this.logger.warn(`[LOGIN] Contraseña NO coincide para "${dto.email}"`);
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    this.logger.log(`[LOGIN] Login exitoso — ${usuario.email} (${usuario.rol.nombre})`);
    return this.signToken(usuario.id, usuario.email, usuario.rol.nombre, usuario.territorioId);
  }

  private signToken(
    userId: string,
    email: string,
    rol: string,
    territorioId: string | null,
  ): { accessToken: string } {
    const payload: JwtPayload = { 
      sub: userId, 
      email, 
      rol: rol as JwtPayload['rol'],
      territorioId,
    };
    return { accessToken: this.jwtService.sign(payload) };
  }
}
