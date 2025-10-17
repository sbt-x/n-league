import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  /**
   * 初回アクセス時にUUIDを生成し、JWTトークンとして返す
   *
   * @return JWTトークン
   */
  issueUserToken(): string {
    const TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

    const uuid = uuidv4();
    const token = this.jwtService.sign({ uuid }, { expiresIn: TTL_SECONDS });

    return token;
  }

  /**
   * トークンを検証し、payload.uuid を返す（無効なら null）
   */
  verifyUserToken(token: string): string | null {
    try {
      const payload: any = this.jwtService.verify(token);
      return payload?.uuid ?? null;
    } catch (e) {
      return null;
    }
  }

  /**
   * トークンから必須の UUID を取得。無効なら例外を投げる
   */
  requireUuidFromToken(token: string): string {
    const uuid = this.verifyUserToken(token);
    if (!uuid) throw new Error("Invalid token");
    return uuid;
  }

  /**
   * 指定された member オブジェクトが token の所有者かどうかを判定
   */
  isTokenOwnerOfMember(token: string, member: any): boolean {
    const uuid = this.verifyUserToken(token);
    if (!uuid) return false;
    return member?.uuid === uuid;
  }
}
