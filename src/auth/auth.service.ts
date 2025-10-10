import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}
  generateAppToken(user: any): string {
    const payload = {
      sub: user.id,
      userId: user.id
    }
    return this.jwtService.sign(payload)
  }
}
