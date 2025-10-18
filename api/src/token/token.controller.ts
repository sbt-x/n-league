import { Controller, Get } from "@nestjs/common";
import { TokenService } from "./token.service";

@Controller("token")
export class TokenController {
  constructor(private readonly tokenService: TokenService) {}

  /**
   * JWT発行API: GET /token
   */
  @Get()
  issueToken() {
    return this.tokenService.issueUserToken();
  }
}
