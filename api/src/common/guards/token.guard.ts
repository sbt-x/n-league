import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { TokenService } from "../../token/token.service";

@Injectable()
export class TokenGuard implements CanActivate {
  constructor(private readonly tokenService: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { uuid?: string }>();
    const auth = req.headers["authorization"] as string | undefined;
    const token = auth?.replace(/^Bearer\s+/i, "");
    if (!token) throw new UnauthorizedException("Authorization token required");
    const uuid = this.tokenService.verifyUserToken(token);
    if (!uuid) throw new UnauthorizedException("Invalid token");
    // attach uuid for controllers/services
    (req as any).uuid = uuid;
    return true;
  }
}
